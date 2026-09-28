import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Pause,
  Play,
  RefreshCw,
  Trophy,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

import {
  cloudflareR2,
  type GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  DiamondCounter,
} from "../components/DiamondCounter";

import {
  DiamondFlyReward,
} from "../components/DiamondFlyReward";

import {
  formatGamePaise,
} from "../services/genzGames";

import {
  showGenZGamesRewardedAd,
} from "../services/admob";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  genZGamesApi,
} from "../services/genZGamesApi";

import type {
  CompleteKnifeHitRunResponse,
} from "../services/genZGamesApi";

import {
  playGameSound,
  playTone,
} from "../audioManager";

import {
  KNIFE_HIT_DIAMONDS_PER_LEVEL,
  KNIFE_HIT_LEVELS_PER_BATCH,
  KNIFE_HIT_MAX_REVIVES,
  KNIFE_HIT_REWARD_PAISE_PER_LEVEL,
  KNIFE_HIT_TICK_MS,
  getKnifeHitBatchEndLevel,
} from "../games/knifeHit/knifeHitConstants";

import {
  advanceKnifeHitTick,
  applyKnifeHitThrow,
  createInitialKnifeHitLevelState,
  restartKnifeHitLevel,
} from "../games/knifeHit/knifeHitEngine";

import type {
  KnifeHitLevelAttempt,
  KnifeHitLocalProgress,
  SavedGenZKnifeHitRun,
} from "../games/knifeHit/knifeHitTypes";

import {
  clearGenZKnifeHitRun,
  createDefaultKnifeHitProgress,
  createKnifeHitRunId,
  createKnifeHitSeed,
  loadGenZKnifeHitProgress,
  loadGenZKnifeHitRun,
  saveGenZKnifeHitProgress,
  saveGenZKnifeHitRun,
  selectKnifeHitBatch,
  updateKnifeHitPersonalBest,
} from "../games/knifeHit/knifeHitStorage";


interface GenZKnifeHitProps {
  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onBack:
    () => void;
}


type ScreenState =
  | "HOME"
  | "GAME"
  | "LEVEL_CLEAR"
  | "GAME_OVER"
  | "RESULT";


interface LevelClearInfo {
  level:
    number;

  completedCount:
    number;
}


const SAVE_EVERY_TICKS =
  30;


const createActiveAttempt =
  (
    level:
      number,

    attemptNumber:
      number,
  ): KnifeHitLevelAttempt => ({
    level,

    attemptNumber,

    throwEvents:
      [],

    outcome:
      "ACTIVE",

    endTick:
      null,
  });


const getLatestActiveAttemptIndex =
  (
    attempts:
      KnifeHitLevelAttempt[],
  ) => {

    for (
      let index =
        attempts.length -
        1;
      index >=
        0;
      index -=
        1
    ) {

      if (
        attempts[index]
          ?.outcome ===
        "ACTIVE"
      ) {
        return index;
      }
    }


    return -1;
  };


const finalizeCurrentAttempt =
  (
    run:
      SavedGenZKnifeHitRun,

    outcome:
      "CLEARED" |
      "FAILED",

    endTick:
      number,
  ) => {

    const index =
      getLatestActiveAttemptIndex(
        run.attempts,
      );


    if (
      index <
      0
    ) {
      return run;
    }


    const attempts =
      run.attempts.map(
        (
          attempt,
          attemptIndex,
        ) =>
          attemptIndex ===
          index
            ? {
                ...attempt,

                outcome,

                endTick,
              }
            : attempt,
      );


    return {
      ...run,

      attempts,
    };
  };


const getNextAttemptNumber =
  (
    attempts:
      KnifeHitLevelAttempt[],

    level:
      number,
  ) => {

    let highest =
      0;


    attempts.forEach(
      attempt => {

        if (
          attempt.level ===
          level
        ) {
          highest =
            Math.max(
              highest,
              attempt.attemptNumber,
            );
        }
      },
    );


    return highest +
      1;
  };


const clamp =
  (
    value:
      number,

    min:
      number,

    max:
      number,
  ) =>
    Math.max(
      min,
      Math.min(
        max,
        value,
      ),
    );


export const GenZKnifeHit:
React.FC<
  GenZKnifeHitProps
> = ({
  summary,
  onSummaryChange,
  onBack,
}) => {

  const {
    currentUser,
    addToast,
  } =
    useAuth();


  const [
    screen,
    setScreen,
  ] =
    useState<
      ScreenState
    >(
      "HOME",
    );


  const [
    run,
    setRun,
  ] =
    useState<
      SavedGenZKnifeHitRun |
      null
    >(
      null,
    );


  const runRef =
    useRef<
      SavedGenZKnifeHitRun |
      null
    >(
      null,
    );


  const [
    progress,
    setProgress,
  ] =
    useState<
      KnifeHitLocalProgress
    >(
      createDefaultKnifeHitProgress,
    );


  const [
    waitingForTap,
    setWaitingForTap,
  ] =
    useState(
      false,
    );


  const [
    isPaused,
    setIsPaused,
  ] =
    useState(
      false,
    );


  const [
    starting,
    setStarting,
  ] =
    useState(
      false,
    );


  const [
    reviving,
    setReviving,
  ] =
    useState(
      false,
    );


  const [
    claiming,
    setClaiming,
  ] =
    useState(
      false,
    );


  const [
    completionError,
    setCompletionError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    claimResult,
    setClaimResult,
  ] =
    useState<
      CompleteKnifeHitRunResponse |
      null
    >(
      null,
    );


  const [
    showDiamondFly,
    setShowDiamondFly,
  ] =
    useState(
      false,
    );


  const [
    levelClearInfo,
    setLevelClearInfo,
  ] =
    useState<
      LevelClearInfo |
      null
    >(
      null,
    );


  const [
    hitFlash,
    setHitFlash,
  ] =
    useState(
      false,
    );


  const [
    successFlash,
    setSuccessFlash,
  ] =
    useState(
      false,
    );


  const lastFrameTimeRef =
    useRef(
      0,
    );


  const accumulatorRef =
    useRef(
      0,
    );


  const lastLocalSaveTickRef =
    useRef(
      0,
    );


  const claimInFlightRef =
    useRef(
      false,
    );


  const persistRun =
    useCallback(
      (
        nextRun:
          SavedGenZKnifeHitRun |
          null,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        if (
          !nextRun ||
          nextRun.status ===
            "SETTLED"
        ) {
          clearGenZKnifeHitRun(
            currentUser.id,
          );

          return;
        }


        saveGenZKnifeHitRun(
          currentUser.id,
          nextRun,
        );
      },
      [
        currentUser,
      ],
    );


  const saveProgress =
    useCallback(
      (
        nextProgress:
          KnifeHitLocalProgress,
      ) => {

        setProgress(
          nextProgress,
        );


        if (
          currentUser
        ) {
          saveGenZKnifeHitProgress(
            currentUser.id,
            nextProgress,
          );
        }
      },
      [
        currentUser,
      ],
    );


  const updatePersonalBest =
    useCallback(
      (
        score:
          number,

        highestLevel:
          number,
      ) => {

        setProgress(
          current => {

            const next =
              updateKnifeHitPersonalBest(
                current,
                score,
                highestLevel,
              );


            if (
              currentUser
            ) {
              saveGenZKnifeHitProgress(
                currentUser.id,
                next,
              );
            }


            return next;
          },
        );
      },
      [
        currentUser,
      ],
    );


  /*
   * =====================================================
   * RESTORE LOCAL PROGRESS + ACTIVE RUN
   * =====================================================
   */
  useEffect(() => {

    if (
      !currentUser
    ) {
      setProgress(
        createDefaultKnifeHitProgress(),
      );

      setRun(
        null,
      );

      runRef.current =
        null;

      return;
    }


    const savedProgress =
      loadGenZKnifeHitProgress(
        currentUser.id,
      );


    setProgress(
      savedProgress,
    );


    const savedRun =
      loadGenZKnifeHitRun(
        currentUser.id,
      );


    if (
      !savedRun ||
      savedRun.rewardClaimed ||
      savedRun.status ===
        "SETTLED"
    ) {
      clearGenZKnifeHitRun(
        currentUser.id,
      );

      setRun(
        null,
      );

      runRef.current =
        null;

      return;
    }


    setRun(
      savedRun,
    );

    runRef.current =
      savedRun;

    lastLocalSaveTickRef.current =
      savedRun.levelState.tick;

  }, [
    currentUser,
  ]);


  /*
   * Server unlock state is authoritative.
   * Local progress is still useful for best score and resume UI.
   */
  useEffect(() => {

    if (
      !currentUser ||
      !summary
    ) {
      return;
    }


    setProgress(
      current => {

        const serverHighest =
          Math.max(
            1,
            summary
              .knifeHit
              .highestUnlockedBatchStart,
          );


        const next:
          KnifeHitLocalProgress = {
          ...current,

          highestUnlockedBatchStart:
            serverHighest,

          bestScore:
            Math.max(
              current.bestScore,
              summary
                .knifeHit
                .bestScore,
            ),

          highestLevelCleared:
            Math.max(
              current
                .highestLevelCleared,
              summary
                .knifeHit
                .highestLevelCleared,
            ),

          selectedBatchStart:
            current
              .selectedBatchStart >
            serverHighest
              ? serverHighest
              : current
                  .selectedBatchStart,
        };


        saveGenZKnifeHitProgress(
          currentUser.id,
          next,
        );


        return next;
      },
    );

  }, [
    currentUser,
    summary,
  ]);


  /*
   * =====================================================
   * APP BACKGROUND SAVE
   * =====================================================
   */
  useEffect(() => {

    const handleVisibility =
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {
          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;

          return;
        }


        const current =
          runRef.current;


        if (
          current
        ) {
          persistRun(
            current,
          );
        }
      };


    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );


    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };

  }, [
    persistRun,
  ]);


  const handleGameBack =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          current &&
          current.status !==
            "SETTLED"
        ) {
          persistRun(
            current,
          );
        }


        setIsPaused(
          false,
        );

        setWaitingForTap(
          false,
        );

        setScreen(
          "HOME",
        );
      },
      [
        persistRun,
      ],
    );


  /*
   * =====================================================
   * ANDROID BACK
   * =====================================================
   */
  useEffect(() => {

    return registerNativeBackHandler(
      () => {

        if (
          screen !==
          "HOME"
        ) {
          handleGameBack();
          return;
        }


        onBack();
      },
    );

  }, [
    screen,
    handleGameBack,
    onBack,
  ]);


  /*
   * =====================================================
   * PAGE SCROLL / TOUCH LOCK
   * =====================================================
   */
  useEffect(() => {

    window.scrollTo({
      top:
        0,

      left:
        0,

      behavior:
        "auto",
    });


    const previousOverflow =
      document.body.style.overflow;

    const previousTouchAction =
      document.body.style.touchAction;


    if (
      screen ===
      "GAME"
    ) {
      document.body.style.overflow =
        "hidden";

      document.body.style.touchAction =
        "none";
    }


    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.body.style.touchAction =
        previousTouchAction;
    };

  }, [
    screen,
  ]);


  const authoritativeHighestBatch =
    summary
      ? Math.max(
          1,
          summary
            .knifeHit
            .highestUnlockedBatchStart,
        )
      : Math.max(
          1,
          progress
            .highestUnlockedBatchStart,
        );


  const batchOptions =
    useMemo(
      () => {

        const options:
          number[] =
          [];


        for (
          let start =
            1;
          start <=
            authoritativeHighestBatch;
          start +=
            KNIFE_HIT_LEVELS_PER_BATCH
        ) {
          options.push(
            start,
          );
        }


        return options;
      },
      [
        authoritativeHighestBatch,
      ],
    );


  const selectedBatchStart =
    Math.min(
      progress
        .selectedBatchStart,
      authoritativeHighestBatch,
    );


  const selectedBatchEnd =
    getKnifeHitBatchEndLevel(
      selectedBatchStart,
    );


  const completedCount =
    run
      ?.completedLevels
      .length ??
    0;


  const pendingPaise =
    completedCount *
    KNIFE_HIT_REWARD_PAISE_PER_LEVEL;


  const pendingDiamonds =
    completedCount *
    KNIFE_HIT_DIAMONDS_PER_LEVEL;


  const revivesRemaining =
    Math.max(
      0,
      KNIFE_HIT_MAX_REVIVES -
        (
          run
            ?.revivesUsed ??
          0
        ),
    );


  const displayScore =
    run
      ? run.runScore +
        (
          run.levelState
            .isGameOver
            ? 0
            : run.levelState
                .levelScore
        )
      : 0;


  const bestScore =
    Math.max(
      progress.bestScore,
      summary
        ?.knifeHit
        .bestScore ??
        0,
      displayScore,
    );


  const selectBatch =
    useCallback(
      (
        batchStart:
          number,
      ) => {

        const next =
          selectKnifeHitBatch(
            {
              ...progress,

              highestUnlockedBatchStart:
                authoritativeHighestBatch,
            },
            batchStart,
          );


        saveProgress(
          next,
        );


        playTone(
          520,
          "triangle",
          0.05,
          0.24,
        );
      },
      [
        progress,
        authoritativeHighestBatch,
        saveProgress,
      ],
    );


  /*
   * =====================================================
   * START A NEW FIVE-LEVEL REWARD RUN
   * =====================================================
   */
  const startNewRun =
    useCallback(
      async () => {

        if (
          !currentUser ||
          starting ||
          claiming ||
          (
            run &&
            run.status !==
              "SETTLED"
          )
        ) {
          return;
        }


        setStarting(
          true,
        );

        setCompletionError(
          null,
        );

        setClaimResult(
          null,
        );

        setShowDiamondFly(
          false,
        );

        setLevelClearInfo(
          null,
        );


        try {

          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {
            addToast(
              "Watch the full ad to unlock this 5-level Knife Hit run.",
              "info",
            );

            return;
          }


          const seed =
            createKnifeHitSeed();

          const now =
            Date.now();

          const batchStart =
            selectedBatchStart;

          const batchEnd =
            getKnifeHitBatchEndLevel(
              batchStart,
            );

          const levelState =
            createInitialKnifeHitLevelState(
              seed,
              batchStart,
            );


          const nextRun:
            SavedGenZKnifeHitRun = {
            version:
              1,

            runId:
              createKnifeHitRunId(),

            seed,

            batchStartLevel:
              batchStart,

            batchEndLevel:
              batchEnd,

            currentLevel:
              batchStart,

            completedLevels:
              [],

            revivesUsed:
              0,

            attempts: [
              createActiveAttempt(
                batchStart,
                1,
              ),
            ],

            levelState,

            runScore:
              0,

            status:
              "ACTIVE",

            endReason:
              null,

            rewardClaimed:
              false,

            startedAt:
              now,

            updatedAt:
              now,
          };


          setRun(
            nextRun,
          );

          runRef.current =
            nextRun;

          persistRun(
            nextRun,
          );

          lastLocalSaveTickRef.current =
            0;

          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;

          setIsPaused(
            false,
          );

          setWaitingForTap(
            true,
          );

          setScreen(
            "GAME",
          );


          playTone(
            520,
            "triangle",
            0.10,
            0.30,
          );

        } finally {
          setStarting(
            false,
          );
        }
      },
      [
        currentUser,
        starting,
        claiming,
        run,
        selectedBatchStart,
        addToast,
        persistRun,
      ],
    );


  const resumeRun =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          current.status ===
            "SETTLED"
        ) {
          return;
        }


        setCompletionError(
          null,
        );

        lastFrameTimeRef.current =
          0;

        accumulatorRef.current =
          0;

        setIsPaused(
          false,
        );


        if (
          current.status ===
          "READY_TO_SETTLE"
        ) {
          setScreen(
            "RESULT",
          );

          return;
        }


        if (
          current.levelState
            .isGameOver
        ) {
          setWaitingForTap(
            false,
          );

          setScreen(
            "GAME_OVER",
          );

          return;
        }


        setWaitingForTap(
          true,
        );

        setScreen(
          "GAME",
        );
      },
      [],
    );


  const pauseGame =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          screen !==
            "GAME" ||
          waitingForTap ||
          isPaused ||
          !current ||
          current.status !==
            "ACTIVE" ||
          current.levelState
            .isGameOver ||
          current.levelState
            .isLevelComplete
        ) {
          return;
        }


        accumulatorRef.current =
          0;

        lastFrameTimeRef.current =
          0;

        persistRun(
          current,
        );

        setIsPaused(
          true,
        );
      },
      [
        screen,
        waitingForTap,
        isPaused,
        persistRun,
      ],
    );


  const resumePausedGame =
    useCallback(
      () => {

        if (
          !isPaused
        ) {
          return;
        }


        accumulatorRef.current =
          0;

        lastFrameTimeRef.current =
          0;

        setIsPaused(
          false,
        );
      },
      [
        isPaused,
      ],
    );


  /*
   * =====================================================
   * THROW
   * =====================================================
   */
  const throwKnife =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          screen !==
            "GAME" ||
          waitingForTap ||
          isPaused ||
          !current ||
          current.status !==
            "ACTIVE" ||
          current.levelState
            .isGameOver ||
          current.levelState
            .isLevelComplete ||
          current.levelState
            .pendingThrow !==
            null ||
          current.levelState
            .knivesLeft <=
            0
        ) {
          return;
        }


        const activeAttemptIndex =
          getLatestActiveAttemptIndex(
            current.attempts,
          );


        if (
          activeAttemptIndex <
          0
        ) {
          return;
        }


        const nextState =
          applyKnifeHitThrow(
            current.levelState,
          );


        if (
          nextState ===
          current.levelState
        ) {
          return;
        }


        const attempts =
          current.attempts.map(
            (
              attempt,
              index,
            ) =>
              index ===
              activeAttemptIndex
                ? {
                    ...attempt,

                    throwEvents: [
                      ...attempt
                        .throwEvents,

                      {
                        tick:
                          current
                            .levelState
                            .tick,
                      },
                    ],
                  }
                : attempt,
          );


        const nextRun:
          SavedGenZKnifeHitRun = {
          ...current,

          attempts,

          levelState:
            nextState,

          updatedAt:
            Date.now(),
        };


        setRun(
          nextRun,
        );

        runRef.current =
          nextRun;

        persistRun(
          nextRun,
        );


        playTone(
          620,
          "square",
          0.07,
          0.28,
        );
      },
      [
        screen,
        waitingForTap,
        isPaused,
        persistRun,
      ],
    );


  const handleArenaPress =
    useCallback(
      () => {

        if (
          screen !==
            "GAME" ||
          isPaused
        ) {
          return;
        }


        if (
          waitingForTap
        ) {
          setWaitingForTap(
            false,
          );

          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;

          playTone(
            460,
            "triangle",
            0.05,
            0.24,
          );

          return;
        }


        throwKnife();
      },
      [
        screen,
        isPaused,
        waitingForTap,
        throwKnife,
      ],
    );


  /*
   * =====================================================
   * DETERMINISTIC FIXED-TICK LOOP
   * =====================================================
   */
  useEffect(() => {

    if (
      screen !==
      "GAME"
    ) {
      lastFrameTimeRef.current =
        0;

      accumulatorRef.current =
        0;

      return;
    }


    let frameId =
      0;


    const frame =
      (
        time:
          number,
      ) => {

        const previousTime =
          lastFrameTimeRef.current;


        if (
          previousTime ===
          0
        ) {
          lastFrameTimeRef.current =
            time;

          frameId =
            requestAnimationFrame(
              frame,
            );

          return;
        }


        const delta =
          Math.min(
            100,
            Math.max(
              0,
              time -
                previousTime,
            ),
          );


        lastFrameTimeRef.current =
          time;


        if (
          waitingForTap ||
          isPaused
        ) {
          accumulatorRef.current =
            0;

          frameId =
            requestAnimationFrame(
              frame,
            );

          return;
        }


        accumulatorRef.current +=
          delta;


        let working =
          runRef.current;


        if (
          !working ||
          working.status !==
            "ACTIVE" ||
          working.levelState
            .isGameOver ||
          working.levelState
            .isLevelComplete
        ) {
          accumulatorRef.current =
            0;

          frameId =
            requestAnimationFrame(
              frame,
            );

          return;
        }


        let changed =
          false;

        let terminal:
          "COLLISION" |
          "CLEAR" |
          null =
          null;

        let clearedLevel =
          0;


        while (
          accumulatorRef.current >=
            KNIFE_HIT_TICK_MS &&
          working.status ===
            "ACTIVE"
        ) {

          const previousAttachedKnifeCount =
            working
              .levelState
              .attachedKnives
              .length;


          const previousCollectedAppleCount =
            working
              .levelState
              .apples
              .filter(
                apple =>
                  apple.collected,
              )
              .length;


          const tickResult =
            advanceKnifeHitTick(
              working.levelState,
              working.seed,
            );


          const attachedKnifeAdded =
            tickResult
              .state
              .attachedKnives
              .length >
            previousAttachedKnifeCount;


          const collectedApple =
            tickResult
              .state
              .apples
              .filter(
                apple =>
                  apple.collected,
              )
              .length >
            previousCollectedAppleCount;


          if (
            !tickResult.collision &&
            attachedKnifeAdded
          ) {

            if (
              collectedApple
            ) {

              playGameSound(
                "knife-apple-hit",
              );

            } else {

              playGameSound(
                "knife-wood-hit",
              );
            }
          }


          working = {
            ...working,

            levelState:
              tickResult.state,
          };


          accumulatorRef.current -=
            KNIFE_HIT_TICK_MS;

          changed =
            true;


          if (
            tickResult.collision
          ) {

            working =
              finalizeCurrentAttempt(
                working,
                "FAILED",
                tickResult
                  .state
                  .tick,
              );


            if (
              working.revivesUsed >=
              KNIFE_HIT_MAX_REVIVES
            ) {
              working = {
                ...working,

                status:
                  "READY_TO_SETTLE",

                endReason:
                  "OUT_OF_REVIVES",

                updatedAt:
                  Date.now(),
              };
            }


            terminal =
              "COLLISION";

            break;
          }


          if (
            tickResult.levelCleared
          ) {

            clearedLevel =
              working.currentLevel;


            working =
              finalizeCurrentAttempt(
                working,
                "CLEARED",
                tickResult
                  .state
                  .tick,
              );


            const completedLevels =
              working
                .completedLevels
                .includes(
                  clearedLevel,
                )
                ? working
                    .completedLevels
                : [
                    ...working
                      .completedLevels,
                    clearedLevel,
                  ];


            const nextRunScore =
              working.runScore +
              tickResult
                .state
                .levelScore;


            if (
              clearedLevel ===
              working.batchEndLevel
            ) {
              working = {
                ...working,

                completedLevels,

                runScore:
                  nextRunScore,

                status:
                  "READY_TO_SETTLE",

                endReason:
                  "BATCH_COMPLETE",

                updatedAt:
                  Date.now(),
              };

            } else {

              const nextLevel =
                clearedLevel +
                1;


              working = {
                ...working,

                currentLevel:
                  nextLevel,

                completedLevels,

                attempts: [
                  ...working
                    .attempts,

                  createActiveAttempt(
                    nextLevel,
                    1,
                  ),
                ],

                levelState:
                  createInitialKnifeHitLevelState(
                    working.seed,
                    nextLevel,
                  ),

                runScore:
                  nextRunScore,

                updatedAt:
                  Date.now(),
              };
            }


            terminal =
              "CLEAR";

            break;
          }
        }


        if (
          changed
        ) {
          setRun(
            working,
          );

          runRef.current =
            working;


          const tick =
            working.levelState.tick;


          if (
            terminal ||
            Math.abs(
              tick -
                lastLocalSaveTickRef
                  .current,
            ) >=
              SAVE_EVERY_TICKS
          ) {
            persistRun(
              working,
            );

            lastLocalSaveTickRef.current =
              tick;
          }
        }


        if (
          terminal ===
          "COLLISION"
        ) {
          setWaitingForTap(
            false,
          );

          setIsPaused(
            false,
          );

          setHitFlash(
            true,
          );

          window.setTimeout(
            () =>
              setHitFlash(
                false,
              ),
            220,
          );

          playGameSound(
            "knife-metal-hit",
          );

          setScreen(
            "GAME_OVER",
          );
        }


        if (
          terminal ===
          "CLEAR"
        ) {
          setWaitingForTap(
            false,
          );

          setIsPaused(
            false,
          );

          setSuccessFlash(
            true,
          );

          window.setTimeout(
            () =>
              setSuccessFlash(
                false,
              ),
            260,
          );


          setLevelClearInfo({
            level:
              clearedLevel,

            completedCount:
              working
                .completedLevels
                .length,
          });


          updatePersonalBest(
            working.runScore,
            clearedLevel,
          );


          playGameSound(
            "game-complete",
          );

          setScreen(
            "LEVEL_CLEAR",
          );
        }


        frameId =
          requestAnimationFrame(
            frame,
          );
      };


    frameId =
      requestAnimationFrame(
        frame,
      );


    return () => {
      cancelAnimationFrame(
        frameId,
      );

      lastFrameTimeRef.current =
        0;

      accumulatorRef.current =
        0;
    };

  }, [
    screen,
    waitingForTap,
    isPaused,
    persistRun,
    updatePersonalBest,
  ]);


  /*
   * After a normal level clear, prepare the next level but keep
   * it frozen until the player taps to continue.
   */
  useEffect(() => {

    if (
      screen !==
        "LEVEL_CLEAR" ||
      !run ||
      run.status !==
        "ACTIVE"
    ) {
      return;
    }


    const timer =
      window.setTimeout(
        () => {
          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;

          setWaitingForTap(
            true,
          );

          setScreen(
            "GAME",
          );
        },
        900,
      );


    return () =>
      window.clearTimeout(
        timer,
      );

  }, [
    screen,
    run,
  ]);


  /*
   * =====================================================
   * REVIVE: TWO ADS MAX PER FIVE-LEVEL RUN
   * =====================================================
   */
  const handleRewardRevive =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          reviving ||
          current.status !==
            "ACTIVE" ||
          !current.levelState
            .isGameOver ||
          current.revivesUsed >=
            KNIFE_HIT_MAX_REVIVES
        ) {
          return;
        }


        const runId =
          current.runId;


        setReviving(
          true,
        );


        try {

          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {
            addToast(
              "Watch the full ad to use this revive.",
              "info",
            );

            return;
          }


          const latest =
            runRef.current;


          if (
            !latest ||
            latest.runId !==
              runId ||
            latest.status !==
              "ACTIVE" ||
            !latest.levelState
              .isGameOver ||
            latest.revivesUsed >=
              KNIFE_HIT_MAX_REVIVES
          ) {
            return;
          }


          const attemptNumber =
            getNextAttemptNumber(
              latest.attempts,
              latest.currentLevel,
            );


          const nextRun:
            SavedGenZKnifeHitRun = {
            ...latest,

            revivesUsed:
              latest.revivesUsed +
              1,

            attempts: [
              ...latest.attempts,

              createActiveAttempt(
                latest.currentLevel,
                attemptNumber,
              ),
            ],

            levelState:
              restartKnifeHitLevel(
                latest.seed,
                latest.currentLevel,
              ),

            updatedAt:
              Date.now(),
          };


          setRun(
            nextRun,
          );

          runRef.current =
            nextRun;

          persistRun(
            nextRun,
          );

          lastLocalSaveTickRef.current =
            0;

          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;

          setIsPaused(
            false,
          );

          setWaitingForTap(
            true,
          );

          setScreen(
            "GAME",
          );


          playTone(
            760,
            "triangle",
            0.14,
            0.34,
          );

        } finally {
          setReviving(
            false,
          );
        }
      },
      [
        reviving,
        addToast,
        persistRun,
      ],
    );


  const endFailedRun =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          current.status !==
            "ACTIVE" ||
          !current.levelState
            .isGameOver
        ) {
          return;
        }


        const nextRun:
          SavedGenZKnifeHitRun = {
          ...current,

          status:
            "READY_TO_SETTLE",

          endReason:
            current.revivesUsed >=
            KNIFE_HIT_MAX_REVIVES
              ? "OUT_OF_REVIVES"
              : "USER_END",

          updatedAt:
            Date.now(),
        };


        setRun(
          nextRun,
        );

        runRef.current =
          nextRun;

        persistRun(
          nextRun,
        );

        setCompletionError(
          null,
        );

        setScreen(
          "RESULT",
        );
      },
      [
        persistRun,
      ],
    );


  /*
   * =====================================================
   * ONE BACKEND SETTLEMENT CALL AT END OF THE RUN
   * =====================================================
   */
  const completeRun =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !currentUser ||
          !current ||
          current.status !==
            "READY_TO_SETTLE" ||
          current.rewardClaimed ||
          !current.endReason ||
          claiming ||
          claimInFlightRef.current
        ) {
          return;
        }


        const endReason =
          current.endReason;


        claimInFlightRef.current =
          true;

        setClaiming(
          true,
        );

        setCompletionError(
          null,
        );


        try {

          const elapsedSeconds =
            Math.max(
              1,
              Math.min(
                86400,
                Math.floor(
                  (
                    Date.now() -
                    current.startedAt
                  ) /
                    1000,
                ),
              ),
            );


          const result =
            await genZGamesApi
              .completeKnifeHitRun({
                runId:
                  current.runId,

                seed:
                  current.seed,

                batchStartLevel:
                  current
                    .batchStartLevel,

                attempts:
                  current.attempts.map(
                    attempt => ({
                      level:
                        attempt.level,

                      attemptNumber:
                        attempt
                          .attemptNumber,

                      throwEvents:
                        attempt
                          .throwEvents
                          .map(
                            event => ({
                              tick:
                                event.tick,
                            }),
                          ),
                    }),
                  ),

                endReason,

                elapsedSeconds,
              });


          setClaimResult(
            result,
          );


          const latest =
            runRef.current;


          if (
            latest &&
            latest.runId ===
              current.runId
          ) {

            const settledRun:
              SavedGenZKnifeHitRun = {
              ...latest,

              status:
                "SETTLED",

              rewardClaimed:
                true,

              updatedAt:
                Date.now(),
            };


            setRun(
              settledRun,
            );

            runRef.current =
              settledRun;

            persistRun(
              null,
            );
          }


          const nextProgress:
            KnifeHitLocalProgress = {
            ...progress,

            highestUnlockedBatchStart:
              Math.max(
                1,
                result
                  .highestUnlockedBatchStart,
              ),

            bestScore:
              Math.max(
                progress.bestScore,
                result.bestScore,
              ),

            highestLevelCleared:
              Math.max(
                progress
                  .highestLevelCleared,
                result
                  .highestLevelCleared,
              ),

            selectedBatchStart:
              Math.min(
                progress
                  .selectedBatchStart,
                Math.max(
                  1,
                  result
                    .highestUnlockedBatchStart,
                ),
              ),
          };


          saveProgress(
            nextProgress,
          );


          if (
            result.diamondsGranted >
            0
          ) {
            setShowDiamondFly(
              true,
            );
          }


          /*
           * ==================================================
           * REFRESH SHARED GENZGAMES SUMMARY
           * ==================================================
           *
           * A verified Knife Hit settlement can update:
           *
           * - Knife Hit progression
           * - Game Balance
           * - Diamonds
           * - Daily Streak
           * - Day 7 streak wallet payout
           *
           * One Knife Hit run may verify multiple completed
           * levels, so always reload the authoritative backend
           * summary after settlement.
           */

          const nextSummary =
            await cloudflareR2
              .getGenZGamesSummary();


          onSummaryChange(
            nextSummary,
          );


          if (
            result.rewardGranted
          ) {
            addToast(
              `${formatGamePaise(
                result.rewardPaise,
              )} + ${result.diamondsGranted} diamonds added to your wallet!`,
              "success",
            );

          } else {
            addToast(
              "This Knife Hit run was already settled.",
              "info",
            );
          }


          setScreen(
            "RESULT",
          );

        } catch (
          error
        ) {
          console.error(
            "Unable to verify Knife Hit reward:",
            error,
          );

          setCompletionError(
            "Unable to verify your reward. Your finished run is saved locally.",
          );

          persistRun(
            current,
          );

          addToast(
            "Knife Hit reward verification failed.",
            "error",
          );

          setScreen(
            "RESULT",
          );

        } finally {
          claimInFlightRef.current =
            false;

          setClaiming(
            false,
          );
        }
      },
      [
        currentUser,
        claiming,
        progress,
        saveProgress,
        onSummaryChange,
        addToast,
        persistRun,
      ],
    );


  useEffect(() => {

    if (
      !run ||
      run.status !==
        "READY_TO_SETTLE" ||
      run.rewardClaimed ||
      claiming ||
      completionError
    ) {
      return;
    }


    void completeRun();

  }, [
    run,
    claiming,
    completionError,
    completeRun,
  ]);


  /*
   * =====================================================
   * KEYBOARD
   * =====================================================
   */
  useEffect(() => {

    const onKeyDown =
      (
        event:
          KeyboardEvent,
      ) => {

        if (
          event.repeat
        ) {
          return;
        }


        if (
          event.key ===
            " " ||
          event.key ===
            "ArrowUp"
        ) {
          if (
            screen ===
            "GAME"
          ) {
            event.preventDefault();
            handleArenaPress();
          }

          return;
        }


        if (
          event.key.toLowerCase() ===
            "p" &&
          screen ===
            "GAME"
        ) {
          event.preventDefault();

          if (
            isPaused
          ) {
            resumePausedGame();
          } else {
            pauseGame();
          }

          return;
        }


        if (
          event.key ===
          "Escape"
        ) {
          event.preventDefault();

          if (
            screen ===
            "HOME"
          ) {
            onBack();
          } else {
            handleGameBack();
          }
        }
      };


    window.addEventListener(
      "keydown",
      onKeyDown,
    );


    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );

  }, [
    screen,
    isPaused,
    handleArenaPress,
    pauseGame,
    resumePausedGame,
    handleGameBack,
    onBack,
  ]);


  const wheelRotationDeg =
    (
      run
        ?.levelState
        .wheelAngleMilliDeg ??
      0
    ) /
    1000;


  const flyingProgress =
    useMemo(
      () => {

        const state =
          run
            ?.levelState;


        if (
          !state ||
          !state.pendingThrow
        ) {
          return 0;
        }


        const duration =
          state
            .pendingThrow
            .impactTick -
          state
            .pendingThrow
            .launchedAtTick;


        if (
          duration <=
          0
        ) {
          return 1;
        }


        return clamp(
          (
            state.tick -
            state
              .pendingThrow
              .launchedAtTick
          ) /
            duration,
          0,
          1,
        );
      },
      [
        run?.levelState,
      ],
    );


  const levelMarkers =
    useMemo(
      () => {

        if (
          !run
        ) {
          return [];
        }


        return Array.from(
          {
            length:
              KNIFE_HIT_LEVELS_PER_BATCH,
          },
          (
            _,
            index,
          ) =>
            run.batchStartLevel +
            index,
        );
      },
      [
        run,
      ],
    );


  const renderKnife =
    (
      className =
        "",
    ) => (
      <div
        className={`gkh-knife ${className}`}
      >
        <div className="gkh-knife-blade" />
        <div className="gkh-knife-guard" />
        <div className="gkh-knife-handle" />
      </div>
    );


  const renderArena =
    () => {

      const state =
        run
          ?.levelState;


      if (
        !run ||
        !state
      ) {
        return null;
      }


      return (
        <div
          className={`gkh-arena ${
            hitFlash
              ? "gkh-hit"
              : ""
          } ${
            successFlash
              ? "gkh-success"
              : ""
          }`}
          onPointerDown={
            event => {
              event.preventDefault();
              handleArenaPress();
            }
          }
        >
          <div className="gkh-run-row">

            <div className="gkh-level-progress">
              {levelMarkers.map(
                level => {

                  const done =
                    run
                      .completedLevels
                      .includes(
                        level,
                      );

                  const current =
                    run.currentLevel ===
                    level;


                  return (
                    <div
                      key={
                        level
                      }
                      className={`gkh-level-dot ${
                        done
                          ? "done"
                          : ""
                      } ${
                        current
                          ? "current"
                          : ""
                      }`}
                    >
                      {done
                        ? "✓"
                        : level}
                    </div>
                  );
                },
              )}
            </div>


            <div className="gkh-run-earnings">
              <small>
                Run Earnings
              </small>

              <strong>
                {formatGamePaise(
                  pendingPaise,
                )}
                {" + "}
                {pendingDiamonds}
                💎
              </strong>
            </div>

          </div>


          <div className="gkh-wheel-zone">
            <div className="gkh-wheel-shadow" />

            <div
              className="gkh-wheel-rotor"
              style={{
                transform:
                  `translate(-50%, -50%) rotate(${wheelRotationDeg}deg)`,
              }}
            >
              <div className="gkh-wheel-face">
                <div className="gkh-wheel-ring" />
                <div className="gkh-wheel-core">GZ</div>
              </div>


              {state.attachedKnives.map(
                (
                  knife,
                  index,
                ) => (
                  <div
                    key={`${knife.relAngleMilliDeg}-${index}`}
                    className="gkh-orbit-item gkh-attached-knife"
                    style={{
  transform:
    `translate(-50%, -50%) rotate(${knife.relAngleMilliDeg / 1000}deg) translateY(-87px)`,
}}
                  >
                    {renderKnife(
                      "gkh-knife-small",
                    )}
                  </div>
                ),
              )}


              {state.apples.map(
                (
                  apple,
                  index,
                ) =>
                  !apple.collected && (
                    <div
                      key={`${apple.relAngleMilliDeg}-${index}`}
                      className="gkh-orbit-item gkh-apple"
                      style={{
                        transform:
                          `translate(-50%, -50%) rotate(${apple.relAngleMilliDeg / 1000}deg) translateY(-92px) rotate(${-apple.relAngleMilliDeg / 1000}deg)`,
                      }}
                    >
                      🍎
                    </div>
                  ),
              )}
            </div>
          </div>


          <div className="gkh-knife-stack">
            {Array.from({
              length:
                state.knivesLeft,
            }).map(
              (
                _,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="gkh-stack-knife"
                >
                  {renderKnife(
                    "gkh-knife-mini",
                  )}
                </div>
              ),
            )}
          </div>


          <div
            className="gkh-flying-knife"
            style={{
              /*
               * Start near the player's hand and finish
               * exactly at the lower edge of the target.
               */
              top:
                `calc(${(
                  1 -
                  flyingProgress
                ) * 100}% + ${
                  flyingProgress *
                    326 -
                  (
                    1 -
                    flyingProgress
                  ) *
                    128
                }px)`,

              transform:
                "translate(-50%, -50%)",

              opacity:
                state.pendingThrow
                  ? 1
                  : 0,
            }}
          >
            {renderKnife()}
          </div>


          {!state.pendingThrow &&
            screen ===
              "GAME" &&
            !waitingForTap &&
            !isPaused && (
            <div className="gkh-ready-knife">
              {renderKnife()}
            </div>
          )}


          {screen ===
            "GAME" &&
            waitingForTap && (
            <div className="gkh-center-overlay gkh-pass-through">
              <div className="gkh-ready-card">
                <div className="gkh-ready-icon">🗡️</div>
                <strong>
                  {state.tick ===
                  0
                    ? "Tap to Start"
                    : "Tap to Continue"}
                </strong>
                <span>
                  Wheel stays frozen until you are ready
                </span>
              </div>
            </div>
          )}


          {screen ===
            "GAME" &&
            isPaused && (
            <div
              className="gkh-center-overlay"
              onPointerDown={
                event =>
                  event.stopPropagation()
              }
            >
              <div className="gkh-dialog">
                <Pause size={34} />
                <h2>Paused</h2>
                <p>
                  Your Knife Hit run is frozen safely.
                </p>
                <button
                  className="gkh-primary-btn"
                  onPointerDown={
                    event =>
                      event.stopPropagation()
                  }
                  onClick={
                    event => {
                      event.stopPropagation();
                      resumePausedGame();
                    }
                  }
                >
                  <Play size={18} />
                  Resume
                </button>
              </div>
            </div>
          )}


          {screen ===
            "LEVEL_CLEAR" &&
            levelClearInfo && (
            <div className="gkh-center-overlay">
              <div className="gkh-dialog gkh-clear-dialog">
                <div className="gkh-big-emoji">🎯</div>
                <h2>
                  Level {levelClearInfo.level} Cleared!
                </h2>
                <div className="gkh-earned-line">
                  +{formatGamePaise(
                    KNIFE_HIT_REWARD_PAISE_PER_LEVEL,
                  )} Pending
                </div>
                <div className="gkh-earned-line">
                  +{KNIFE_HIT_DIAMONDS_PER_LEVEL} 💎 Pending
                </div>
                <p>
                  Run total: {formatGamePaise(
                    levelClearInfo.completedCount *
                      KNIFE_HIT_REWARD_PAISE_PER_LEVEL,
                  )} + {levelClearInfo.completedCount *
                    KNIFE_HIT_DIAMONDS_PER_LEVEL} 💎
                </p>

                {run.status ===
                  "READY_TO_SETTLE" && (
                  <div className="gkh-verifying">
                    {claiming
                      ? "Verifying all 5 levels..."
                      : "Finishing reward verification..."}
                  </div>
                )}
              </div>
            </div>
          )}


          {screen ===
            "GAME_OVER" && (
            <div
              className="gkh-center-overlay"
              onPointerDown={
                event =>
                  event.stopPropagation()
              }
            >
              <div className="gkh-dialog">
                <div className="gkh-big-emoji">💥</div>
                <h2>Knife Collision</h2>
                <p>
                  Level {run.currentLevel} stopped. Your already-cleared levels stay safe.
                </p>

                <div className="gkh-mini-stats">
                  <span>
                    Pending {formatGamePaise(
                      pendingPaise,
                    )} + {pendingDiamonds} 💎
                  </span>
                  <span>
                    Revives left {revivesRemaining}
                  </span>
                </div>


                {run.status ===
                  "READY_TO_SETTLE"
                  ? (
                    <div className="gkh-verifying">
                      {claiming
                        ? "Verifying your final reward..."
                        : "Finalizing run..."}
                    </div>
                  )
                  : (
                    <>
                      <button
                        className="gkh-primary-btn"
                        disabled={
                          reviving ||
                          revivesRemaining <=
                            0
                        }
                        onPointerDown={
                          event =>
                            event.stopPropagation()
                        }
                        onClick={
                          event => {
                            event.stopPropagation();
                            void handleRewardRevive();
                          }
                        }
                      >
                        <RefreshCw size={18} />
                        {reviving
                          ? "Opening Ad..."
                          : `Watch Ad & Revive (${revivesRemaining})`}
                      </button>

                      <button
                        className="gkh-secondary-btn"
                        onPointerDown={
                          event =>
                            event.stopPropagation()
                        }
                        onClick={
                          event => {
                            event.stopPropagation();
                            endFailedRun();
                          }
                        }
                      >
                        End Run & Claim {formatGamePaise(
                          pendingPaise,
                        )} + {pendingDiamonds} 💎
                      </button>
                    </>
                  )}
              </div>
            </div>
          )}


          {screen ===
            "GAME" &&
            !waitingForTap &&
            !isPaused && (
            <div className="gkh-gesture">
              Tap / Space to Throw
            </div>
          )}
        </div>
      );
    };


  return (
    <>
      {showDiamondFly &&
        claimResult &&
        claimResult.diamondsGranted >
          0 && (
          <DiamondFlyReward
            amount={
              claimResult
                .diamondsGranted
            }
            onDone={() =>
              setShowDiamondFly(
                false,
              )
            }
          />
        )}


      <div
        className="gkh-root"
        style={{
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        <style>{`
          .gkh-root {
            position: relative;
            width: 100%;

            /*
             * GenZKnifeHit is rendered BELOW the main
             * GenZGames header, so 100svh was making
             * the game extend below the actual visible
             * area and behind the native adaptive ad.
             */
            height: calc(100svh - 64px);
            height: calc(100dvh - 64px);
            min-height: calc(100svh - 64px);

            overflow: hidden;
            box-sizing: border-box;
            color: #fff;
            background:
              radial-gradient(circle at 18% 12%, rgba(255, 132, 83, .18), transparent 28%),
              radial-gradient(circle at 82% 18%, rgba(103, 132, 255, .16), transparent 26%),
              radial-gradient(circle at 50% 108%, rgba(255, 195, 89, .11), transparent 36%),
              linear-gradient(180deg, #18131f 0%, #0f111a 48%, #090a10 100%);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .gkh-root * {
            box-sizing: border-box;
          }

          .gkh-page {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            padding: calc(env(safe-area-inset-top) + 10px) 14px 10px;
          }

          .gkh-home {
            height: 100%;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-width: none;
          }

          .gkh-home::-webkit-scrollbar {
            display: none;
          }

          .gkh-topbar {
            width: min(100%, 560px);
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .gkh-icon-btn {
            width: 44px;
            height: 44px;
            flex: 0 0 44px;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 14px;
            color: #fff;
            background: rgba(255,255,255,.08);
            backdrop-filter: blur(12px);
            display: grid;
            place-items: center;
            box-shadow: 0 10px 26px rgba(0,0,0,.24);
          }

          .gkh-icon-btn:disabled {
            opacity: .42;
          }

          .gkh-game-hud {
            flex: 1;
            min-width: 0;
            height: 44px;
            padding: 5px 8px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 15px;
            background: rgba(255,255,255,.07);
            backdrop-filter: blur(12px);
          }

          .gkh-hud-stat {
            text-align: center;
            line-height: 1;
          }

          .gkh-hud-stat small {
            display: block;
            font-size: 9px;
            opacity: .62;
            text-transform: uppercase;
            letter-spacing: .7px;
          }

          .gkh-hud-stat strong {
            display: block;
            margin-top: 5px;
            font-size: 14px;
          }

          .gkh-hero {
            width: min(100%, 560px);
            margin: 20px auto 0;
            text-align: center;
          }

          .gkh-hero-wheel {
            width: 126px;
            height: 126px;
            margin: 4px auto 12px;
            border-radius: 50%;
            border: 8px solid #6d3e22;
            background:
              repeating-conic-gradient(from 0deg, #9c6035 0 18deg, #7e4929 18deg 36deg);
            box-shadow:
              inset 0 0 0 5px rgba(255,255,255,.08),
              0 20px 44px rgba(0,0,0,.35);
            display: grid;
            place-items: center;
            font-size: 38px;
          }

          .gkh-title {
            margin: 0;
            font-size: clamp(30px, 8vw, 44px);
            font-weight: 950;
            letter-spacing: -1.4px;
          }

          .gkh-subtitle {
            margin: 8px auto 0;
            max-width: 430px;
            color: rgba(255,255,255,.70);
            font-size: 13px;
            line-height: 1.55;
          }

          .gkh-reward-card,
          .gkh-resume-card,
          .gkh-stats-card {
            width: min(100%, 520px);
            margin: 14px auto 0;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 18px;
            background: rgba(255,255,255,.065);
            box-shadow: 0 14px 36px rgba(0,0,0,.20);
            backdrop-filter: blur(12px);
          }

          .gkh-reward-card {
            padding: 13px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .gkh-reward-cell {
            padding: 10px;
            border-radius: 14px;
            background: rgba(255,255,255,.05);
          }

          .gkh-reward-cell small {
            display: block;
            opacity: .62;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: .6px;
          }

          .gkh-reward-cell strong {
            display: block;
            margin-top: 5px;
            font-size: 16px;
          }

          .gkh-section-title {
            width: min(100%, 520px);
            margin: 18px auto 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 800;
          }

          .gkh-section-title span {
            opacity: .58;
            font-size: 11px;
            font-weight: 600;
          }

          .gkh-batches {
            width: min(100%, 520px);
            margin: 0 auto;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 2px 1px 5px;
            scrollbar-width: none;
          }

          .gkh-batches::-webkit-scrollbar {
            display: none;
          }

          .gkh-batch-btn {
            flex: 0 0 auto;
            min-width: 96px;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 14px;
            padding: 10px 12px;
            color: rgba(255,255,255,.76);
            background: rgba(255,255,255,.05);
            font-size: 12px;
            font-weight: 800;
          }

          .gkh-batch-btn.selected {
            color: #1a1207;
            border-color: rgba(255,194,90,.78);
            background: linear-gradient(135deg, #ffd36b, #ff9d54);
            box-shadow: 0 8px 22px rgba(255,157,84,.22);
          }

          .gkh-primary-btn,
          .gkh-secondary-btn {
            width: 100%;
            min-height: 48px;
            border-radius: 15px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .gkh-primary-btn {
            border: none;
            color: #1a1207;
            background: linear-gradient(135deg, #ffd66c 0%, #ff9854 100%);
            box-shadow: 0 12px 30px rgba(255, 153, 84, .22);
          }

          .gkh-primary-btn:disabled {
            opacity: .48;
          }

          .gkh-secondary-btn {
            border: 1px solid rgba(255,255,255,.10);
            color: #fff;
            background: rgba(255,255,255,.065);
          }

          .gkh-actions {
            width: min(100%, 520px);
            margin: 14px auto 0;
            display: grid;
            gap: 9px;
          }

          .gkh-resume-card {
            padding: 13px;
          }

          .gkh-resume-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }

          .gkh-resume-row strong {
            font-size: 14px;
          }

          .gkh-resume-row span {
            opacity: .62;
            font-size: 11px;
          }

          .gkh-stats-card {
            padding: 12px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            text-align: center;
          }

          .gkh-stats-card small {
            display: block;
            opacity: .58;
            font-size: 9px;
            text-transform: uppercase;
          }

          .gkh-stats-card strong {
            display: block;
            margin-top: 5px;
            font-size: 15px;
          }

          .gkh-game-page {
            display: flex;
            flex-direction: column;
          }

          .gkh-arena {
            position: relative;
            width: min(100%, 560px);
            flex: 1;
            min-height: 0;
            margin: 9px auto 0;
            overflow: hidden;
            border-radius: 22px;
            border: 1px solid rgba(255,255,255,.07);
            background:
              radial-gradient(circle at 50% 32%, rgba(255,188,98,.10), transparent 30%),
              linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015));
            box-shadow: inset 0 0 60px rgba(0,0,0,.20);
            touch-action: none;
            user-select: none;
          }

          .gkh-arena.gkh-hit {
            animation:
              gkhCollisionShake
              220ms
              ease-in-out;

            box-shadow:
              inset 0 0 110px rgba(255,55,75,.38),
              0 0 0 3px rgba(255,80,90,.40),
              0 0 30px rgba(255,55,75,.28);
          }

          @keyframes gkhCollisionShake {
            0%,
            100% {
              transform:
                translateX(0);
            }

            20% {
              transform:
                translateX(-7px);
            }

            40% {
              transform:
                translateX(7px);
            }

            60% {
              transform:
                translateX(-5px);
            }

            80% {
              transform:
                translateX(5px);
            }
          }

          .gkh-arena.gkh-success {
            box-shadow:
              inset 0 0 90px rgba(255,196,74,.20),
              0 0 0 2px rgba(255,196,74,.18);
          }

          .gkh-run-row {
            position: absolute;
            z-index: 10;
            top: 12px;
            left: 14px;
            right: 14px;

            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;

            pointer-events: none;
          }


          .gkh-level-progress {
            position: static;
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 0 0 auto;
          }


          .gkh-level-dot {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(255,255,255,.06);
            color: rgba(255,255,255,.64);
            font-size: 11px;
            font-weight: 900;
          }

          .gkh-level-dot.current {
            color: #211404;
            background: #ffc55a;
          }

          .gkh-level-dot.done {
            color: #07180e;
            background: #62e6a3;
          }

                    .gkh-run-earnings {
            min-width: 106px;
            padding: 7px 9px;

            border: 1px solid rgba(255,255,255,.08);
            border-radius: 12px;

            background: rgba(10,10,16,.58);
            backdrop-filter: blur(10px);

            text-align: right;
            line-height: 1.05;
          }


          .gkh-run-earnings small {
            display: block;

            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .6px;

            color: rgba(255,255,255,.52);
          }


          .gkh-run-earnings strong {
            display: block;
            margin-top: 5px;

            white-space: nowrap;

            font-size: 12px;
            font-weight: 950;

            color: #fff;
          }

          .gkh-wheel-zone {
            position: absolute;
            width: 252px;
            height: 252px;
            left: 50%;

            /*
             * Fixed vertical placement keeps the target
             * directly below the batch-progress row instead
             * of drifting toward the middle on tall phones.
             */
            top: 205px;

            transform: translate(-50%, -50%);
          }

          .gkh-wheel-shadow {
            position: absolute;
            left: 24px;
            right: 24px;
            bottom: 14px;
            height: 32px;
            border-radius: 50%;
            background: rgba(0,0,0,.42);
            filter: blur(12px);
          }

          .gkh-wheel-rotor {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 100%;
            height: 100%;
            transform-origin: 50% 50%;
          }

          .gkh-wheel-face {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 174px;
            height: 174px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 8px solid #60351e;
            background:
              radial-gradient(circle at 36% 28%, rgba(255,255,255,.12), transparent 20%),
              repeating-conic-gradient(from 4deg, #a8673a 0 18deg, #834b2b 18deg 36deg);
            box-shadow:
              inset 0 0 0 5px rgba(255,255,255,.06),
              inset 0 -18px 24px rgba(62,31,16,.34),
              0 18px 34px rgba(0,0,0,.36);
          }

          .gkh-wheel-ring {
            position: absolute;
            inset: 14px;
            border: 2px dashed rgba(255,225,185,.20);
            border-radius: 50%;
          }

          .gkh-wheel-core {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 46px;
            height: 46px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: rgba(255,235,204,.75);
            background: rgba(70,36,21,.45);
            font-size: 12px;
            font-weight: 950;
            letter-spacing: 1px;
          }

          .gkh-orbit-item {
            position: absolute;
            left: 50%;
            top: 50%;
            transform-origin: 0 0;
          }

          .gkh-apple {
            font-size: 25px;
            filter: drop-shadow(0 5px 6px rgba(0,0,0,.35));
          }

          .gkh-knife {
            position: relative;
            width: 22px;
            height: 72px;

            /*
             * Blade faces upward toward the target.
             */
            transform: rotate(0deg);

            filter: drop-shadow(0 5px 5px rgba(0,0,0,.28));
          }

          .gkh-knife-blade {
            position: absolute;
            left: 5px;
            top: 0;
            width: 12px;
            height: 31px;
            clip-path: polygon(50% 0, 100% 34%, 82% 100%, 18% 100%, 0 34%);
            background: linear-gradient(90deg, #d7dbe2, #ffffff 48%, #aab0bb);
          }

          .gkh-knife-guard {
            position: absolute;
            left: 0;
            top: 29px;
            width: 22px;
            height: 5px;
            border-radius: 3px;
            background: #e3b65f;
          }

          .gkh-knife-handle {
            position: absolute;
            left: 6px;
            top: 34px;
            width: 10px;
            height: 34px;
            border-radius: 3px 3px 7px 7px;
            background: repeating-linear-gradient(180deg, #33251f 0 5px, #4a342a 5px 9px);
          }

          .gkh-knife-small {
  /*
   * The parent point sits exactly on the wood edge.
   *
   * Anchor the KNIFE GUARD to that point:
   * - blade extends inside the wood
   * - handle extends outside
   * - every angle uses identical insertion depth
   */
  position: absolute;

  left: -11px;
  top: -31px;

  transform:
    rotate(180deg)
    scale(.82);

  /*
   * 11px = horizontal centre of the 22px knife.
   * 31px = centre of the guard.
   *
   * Therefore rotation/scaling happens around the
   * exact point where the knife meets the wood.
   */
  transform-origin:
    11px
    31px;
}

          .gkh-knife-mini {
            transform: rotate(0deg) scale(.48);
            transform-origin: top center;
          }

          .gkh-knife-stack {
            position: absolute;
            left: 14px;
            bottom: 96px;
            display: flex;
            flex-direction: column-reverse;
            height: 126px;
            justify-content: flex-start;
            pointer-events: none;
          }

          .gkh-stack-knife {
            height: 15px;
          }

          .gkh-ready-knife,
          .gkh-flying-knife {
            position: absolute;
            z-index: 7;
            left: 50%;

            /*
             * Player knife stays safely above the
             * adaptive banner area.
             */
            top: calc(100% - 128px);
            bottom: auto;

            transform: translate(-50%, -50%);
            pointer-events: none;
          }

          .gkh-flying-knife {
            transition: transform 16ms linear;
          }

          .gkh-gesture {
            position: absolute;
            z-index: 9;
            left: 50%;
            bottom: 82px;
            transform: translateX(-50%);
            white-space: nowrap;
            font-size: 11px;
            font-weight: 800;
            color: rgba(255,255,255,.58);
            pointer-events: none;
          }

          .gkh-center-overlay {
            position: absolute;
            z-index: 30;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(4,5,9,.46);
            backdrop-filter: blur(5px);
          }

          .gkh-pass-through {
            pointer-events: none;
            background: rgba(4,5,9,.20);
          }

          .gkh-ready-card,
          .gkh-dialog {
            width: min(100%, 340px);
            padding: 20px;
            border-radius: 22px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(24,21,31,.92);
            box-shadow: 0 24px 60px rgba(0,0,0,.42);
            text-align: center;
          }

          .gkh-ready-card {
            padding: 16px 20px;
          }

          .gkh-ready-icon,
          .gkh-big-emoji {
            font-size: 34px;
          }

          .gkh-ready-card strong {
            display: block;
            margin-top: 4px;
            font-size: 20px;
          }

          .gkh-ready-card span {
            display: block;
            margin-top: 5px;
            font-size: 11px;
            opacity: .62;
          }

          .gkh-dialog h2 {
            margin: 8px 0 4px;
            font-size: 24px;
          }

          .gkh-dialog p {
            margin: 6px 0 14px;
            font-size: 12px;
            line-height: 1.5;
            color: rgba(255,255,255,.67);
          }

          .gkh-dialog .gkh-primary-btn,
          .gkh-dialog .gkh-secondary-btn {
            margin-top: 9px;
          }

          .gkh-clear-dialog {
            border-color: rgba(255,199,84,.30);
          }

          .gkh-earned-line {
            margin-top: 6px;
            font-weight: 900;
            color: #ffd36b;
          }

          .gkh-mini-stats {
            display: grid;
            gap: 5px;
            margin: 10px 0;
            font-size: 11px;
            color: rgba(255,255,255,.72);
          }

          .gkh-verifying {
            margin-top: 12px;
            padding: 9px 12px;
            border-radius: 12px;
            background: rgba(255,255,255,.06);
            font-size: 11px;
            font-weight: 800;
            opacity: .74;
          }

          .gkh-result-page {
            height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
          }

          .gkh-result-page::-webkit-scrollbar {
            display: none;
          }

          .gkh-result-card {
            width: min(100%, 500px);
            margin: 28px auto 0;
            padding: 22px;
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,.09);
            background: rgba(255,255,255,.065);
            box-shadow: 0 24px 60px rgba(0,0,0,.30);
            text-align: center;
          }

          .gkh-result-card h1 {
            margin: 8px 0 4px;
            font-size: 28px;
          }

          .gkh-result-card > p {
            color: rgba(255,255,255,.65);
            font-size: 12px;
            line-height: 1.5;
          }

          .gkh-result-rewards {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 9px;
            margin-top: 15px;
          }

          .gkh-result-rewards div {
            padding: 13px;
            border-radius: 15px;
            background: rgba(255,255,255,.06);
          }

          .gkh-result-rewards small {
            display: block;
            opacity: .58;
            font-size: 9px;
            text-transform: uppercase;
          }

          .gkh-result-rewards strong {
            display: block;
            margin-top: 5px;
            font-size: 18px;
          }

          .gkh-error {
            margin-top: 13px;
            padding: 10px 12px;
            border-radius: 13px;
            background: rgba(255,75,95,.12);
            border: 1px solid rgba(255,75,95,.18);
            color: #ffb1bd;
            font-size: 11px;
          }

          @media (max-height: 720px) {
            /*
             * Keep gameplay wheel geometry identical.
             * The deterministic hit visuals then remain
             * aligned on short and tall devices.
             */
            .gkh-hero-wheel {
              width: 104px;
              height: 104px;
            }
          }
        `}</style>


        {screen ===
        "HOME"
          ? (
            <div className="gkh-page gkh-home">
              <div className="gkh-topbar">
                <button
                  className="gkh-icon-btn"
                  onClick={
                    onBack
                  }
                  aria-label="Back to GenZGames"
                >
                  <ArrowLeft size={20} />
                </button>

                <DiamondCounter
                  compact
                  diamonds={
                    summary
                      ?.diamonds
                      .today ??
                    claimResult
                      ?.todayDiamonds ??
                    0
                  }
                />
              </div>


              <div className="gkh-hero">
                <div className="gkh-hero-wheel">🗡️</div>
                <h1 className="gkh-title">Knife Hit</h1>
                <p className="gkh-subtitle">
                  Clear five spinning levels per run. Every cleared level adds ₹0.01 + 2 diamonds to your pending reward, then the backend settles everything once the run ends.
                </p>
              </div>


              <div className="gkh-reward-card">
                <div className="gkh-reward-cell">
                  <small>Per level</small>
                  <strong>
                    {formatGamePaise(
                      KNIFE_HIT_REWARD_PAISE_PER_LEVEL,
                    )} + {KNIFE_HIT_DIAMONDS_PER_LEVEL}💎
                  </strong>
                </div>
                <div className="gkh-reward-cell">
                  <small>Full 5 levels</small>
                  <strong>₹0.05 + 10💎</strong>
                </div>
                <div className="gkh-reward-cell">
                  <small>Revives</small>
                  <strong>{KNIFE_HIT_MAX_REVIVES} per run</strong>
                </div>
                <div className="gkh-reward-cell">
                  <small>Replay</small>
                  <strong>Earn again</strong>
                </div>
              </div>


              <div className="gkh-section-title">
                <strong>Select Levels</strong>
                <span>Unlocked batches can be replayed</span>
              </div>

              <div className="gkh-batches">
                {batchOptions.map(
                  batchStart => {
                    const batchEnd =
                      getKnifeHitBatchEndLevel(
                        batchStart,
                      );

                    return (
                      <button
                        key={
                          batchStart
                        }
                        className={`gkh-batch-btn ${
                          selectedBatchStart ===
                          batchStart
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectBatch(
                            batchStart,
                          )
                        }
                      >
                        {batchStart}–{batchEnd}
                      </button>
                    );
                  },
                )}
              </div>


              {run &&
                run.status !==
                  "SETTLED" && (
                <div className="gkh-resume-card">
                  <div className="gkh-resume-row">
                    <div>
                      <strong>
                        {run.status ===
                        "READY_TO_SETTLE"
                          ? "Finished run waiting for verification"
                          : `Active run: Levels ${run.batchStartLevel}–${run.batchEndLevel}`}
                      </strong>
                      <span>
                        {run.completedLevels.length}/5 levels cleared • {KNIFE_HIT_MAX_REVIVES - run.revivesUsed} revives left
                      </span>
                    </div>
                    <span>
                      {formatGamePaise(
                        run.completedLevels.length *
                          KNIFE_HIT_REWARD_PAISE_PER_LEVEL,
                      )} pending
                    </span>
                  </div>

                  <button
                    className="gkh-primary-btn"
                    onClick={
                      resumeRun
                    }
                  >
                    <Play size={18} />
                    {run.status ===
                    "READY_TO_SETTLE"
                      ? "Verify Reward"
                      : "Resume Run"}
                  </button>
                </div>
              )}


              {!run ||
              run.status ===
                "SETTLED"
                ? (
                  <div className="gkh-actions">
                    <button
                      className="gkh-primary-btn"
                      disabled={
                        starting ||
                        claiming
                      }
                      onClick={() =>
                        void startNewRun()
                      }
                    >
                      <Play size={18} />
                      {starting
                        ? "Opening Rewarded Ad..."
                        : `Watch Ad & Play ${selectedBatchStart}–${selectedBatchEnd}`}
                    </button>
                  </div>
                )
                : null}


              <div className="gkh-stats-card">
                <div>
                  <small>Best score</small>
                  <strong>{bestScore}</strong>
                </div>
                <div>
                  <small>Highest level</small>
                  <strong>
                    {Math.max(
                      progress.highestLevelCleared,
                      summary
                        ?.knifeHit
                        .highestLevelCleared ??
                        0,
                    )}
                  </strong>
                </div>
                <div>
                  <small>Runs settled</small>
                  <strong>
                    {summary
                      ?.knifeHit
                      .completedRuns ??
                      0}
                  </strong>
                </div>
              </div>
            </div>
          )
          : screen ===
            "RESULT"
            ? (
              <div className="gkh-page gkh-result-page">
                <div className="gkh-topbar">
                  <button
                    className="gkh-icon-btn"
                    onClick={
                      handleGameBack
                    }
                    aria-label="Back to Knife Hit home"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <DiamondCounter
                    compact
                    diamonds={
                      summary
                        ?.diamonds
                        .today ??
                      claimResult
                        ?.todayDiamonds ??
                      0
                    }
                  />
                </div>


                <div className="gkh-result-card">
                  <Trophy size={44} />

                  <h1>
                    {claiming
                      ? "Verifying Run..."
                      : completionError
                        ? "Reward Pending"
                        : claimResult
                          ?.completedLevelCount ===
                          KNIFE_HIT_LEVELS_PER_BATCH
                            ? "5 Levels Complete!"
                            : "Run Complete"}
                  </h1>

                  <p>
                    {claiming
                      ? "The backend is replaying your Knife Hit run and calculating the final reward."
                      : completionError
                        ? "Your finished run is still saved. Retry verification without replaying the levels."
                        : `Verified ${claimResult?.completedLevelCount ?? completedCount} level${(claimResult?.completedLevelCount ?? completedCount) === 1 ? "" : "s"}.`}
                  </p>


                  <div className="gkh-result-rewards">
                    <div>
                      <small>Cash added</small>
                      <strong>
                        {formatGamePaise(
                          claimResult
                            ?.rewardPaise ??
                          pendingPaise,
                        )}
                      </strong>
                    </div>
                    <div>
                      <small>Diamonds added</small>
                      <strong>
                        {claimResult
                          ?.diamondsGranted ??
                          pendingDiamonds} 💎
                      </strong>
                    </div>
                  </div>


                  {completionError && (
                    <div className="gkh-error">
                      {completionError}
                    </div>
                  )}


                  <div className="gkh-actions">
                    {completionError &&
                      run?.status ===
                        "READY_TO_SETTLE" && (
                      <button
                        className="gkh-primary-btn"
                        disabled={
                          claiming
                        }
                        onClick={() => {
                          setCompletionError(
                            null,
                          );
                          void completeRun();
                        }}
                      >
                        <RefreshCw size={18} />
                        Retry Verification
                      </button>
                    )}


                    {!completionError &&
                      !claiming &&
                      claimResult && (
                      <>
                        <button
                          className="gkh-primary-btn"
                          onClick={() => {
                            selectBatch(
                              claimResult
                                .batchStartLevel,
                            );
                            setScreen(
                              "HOME",
                            );
                          }}
                        >
                          <RefreshCw size={18} />
                          Replay {claimResult.batchStartLevel}–{claimResult.batchEndLevel}
                        </button>


                        {claimResult
                          .nextBatchStartLevel !==
                          null && (
                          <button
                            className="gkh-secondary-btn"
                            onClick={() => {
                              selectBatch(
                                claimResult
                                  .nextBatchStartLevel ??
                                  claimResult
                                    .batchStartLevel,
                              );
                              setScreen(
                                "HOME",
                              );
                            }}
                          >
                            <Play size={18} />
                            Play {claimResult.nextBatchStartLevel}–{getKnifeHitBatchEndLevel(
                              claimResult
                                .nextBatchStartLevel,
                            )}
                          </button>
                        )}
                      </>
                    )}


                    <button
                      className="gkh-secondary-btn"
                      onClick={
                        handleGameBack
                      }
                    >
                      Knife Hit Home
                    </button>
                  </div>
                </div>
              </div>
            )
            : (
              <div className="gkh-page gkh-game-page">
                <div className="gkh-topbar">
                  <button
                    className="gkh-icon-btn"
                    onPointerDown={
                      event =>
                        event.stopPropagation()
                    }
                    onClick={
                      handleGameBack
                    }
                    aria-label="Back to Knife Hit home"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div className="gkh-game-hud">
                    <div className="gkh-hud-stat">
                      <small>Level</small>
                      <strong>{run?.currentLevel ?? 1}</strong>
                    </div>
                    <div className="gkh-hud-stat">
                      <small>Score</small>
                      <strong>{displayScore}</strong>
                    </div>
                    <div className="gkh-hud-stat">
                      <small>Revives</small>
                      <strong>{revivesRemaining}</strong>
                    </div>
                  </div>

                  {screen ===
                  "GAME"
                    ? (
                      <button
                        className="gkh-icon-btn"
                        disabled={
                          waitingForTap ||
                          isPaused
                        }
                        onPointerDown={
                          event =>
                            event.stopPropagation()
                        }
                        onClick={
                          event => {
                            event.stopPropagation();
                            pauseGame();
                          }
                        }
                        aria-label="Pause"
                      >
                        <Pause size={20} />
                      </button>
                    )
                    : (
                      <DiamondCounter
                        compact
                        diamonds={
                          summary
                            ?.diamonds
                            .today ??
                          0
                        }
                      />
                    )}
                </div>


                {renderArena()}
              </div>
            )}
      </div>
    </>
  );
};


export default GenZKnifeHit;
