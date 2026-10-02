import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Lock,
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
} from "../services/cloudflare/stream";

import type {
  CompleteGenZSnakeRunResponse,
  GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  DiamondFlyReward,
} from "../components/DiamondFlyReward";

import {
  DiamondCounter,
} from "../components/DiamondCounter";

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
  playGameSound,
  playTone,
} from "../audioManager";

import SnakeGameCanvas from "../games/snake/SnakeGameCanvas";

import {
  advanceSnakeTick,
  applySnakeDirection,
  createInitialSnakeState,
  getSnakeProgressPercent,
} from "../games/snake/snakeEngine";

import {
  POWER_UPS,
  SNAKE_COMPLETE_PERCENT,
  SNAKE_DIAMOND_REWARD,
  SNAKE_MAX_LEVEL,
  SNAKE_REWARD_PAISE,
  generateSnakeLevel,
} from "../games/snake/snakeConstants";

import {
  Direction,
  PowerUpType,
  type SavedGenZSnakeRun,
} from "../games/snake/snakeTypes";

import {
  clearGenZSnakeRun,
  createSnakeRunId,
  createSnakeSeed,
  loadGenZSnakeRun,
  saveGenZSnakeRun,
} from "../games/snake/snakeStorage";


interface GenZSnakeProps {
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


type SnakeScreen =
  | "levels"
  | "game";


const BANNER_RESERVE_PX = 
  72; 


const SNAKE_LEVELS_PER_PAGE =
  100;


const SNAKE_LEVEL_PAGE_COUNT =
  Math.ceil(
    SNAKE_MAX_LEVEL /
      SNAKE_LEVELS_PER_PAGE,
  );



const formatReward =
  (
    paise:
      number,
  ) =>
    `₹${(
      paise /
      100
    ).toFixed(
      2,
    )}`;


export const GenZSnake:
React.FC<
  GenZSnakeProps
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
      SnakeScreen
    >(
      "levels",
    );


  const [
    run,
    setRun,
  ] =
    useState<
      SavedGenZSnakeRun |
      null
    >(
      null,
    );

  const [
    startingLevel,
    setStartingLevel,
  ] =
    useState<
      number |
      null
    >(
      null,
    );

      const [
    levelPage,
    setLevelPage,
  ] =
    useState(
      0,
    );

  const [
  claiming,
  setClaiming,
] =
  useState(
    false,
  );


const [
  claimResult,
  setClaimResult,
] =
  useState<
    CompleteGenZSnakeRunResponse |
    null
  >(
    null,
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
  showDiamondFly,
  setShowDiamondFly,
] =
  useState(
    false,
  );


const claimInFlightRef =
  useRef(
    false,
  );

  const highestUnlockedLevel =
  Math.max(
    summary
      ?.snake
      .highestUnlockedLevel ??
      1,

    claimResult
      ?.highestUnlockedLevel ??
      1,
  );

    const levelPageStart =
    levelPage *
      SNAKE_LEVELS_PER_PAGE +
    1;


  const levelPageEnd =
    Math.min(
      SNAKE_MAX_LEVEL,

      levelPageStart +
        SNAKE_LEVELS_PER_PAGE -
        1,
    );


  const [
  boardSize,
  setBoardSize,
] =
  useState(
    () => {

      const viewportWidth =
        typeof window !==
          "undefined"
          ? window.innerWidth
          : 360;


      return Math.max(
        180,

        Math.min(
          viewportWidth -
            28,

          620,
        ),
      );
    },
  );


  const [
    shakeKey,
    setShakeKey,
  ] =
    useState(
      0,
    );


  const [
    collisionAlert,
    setCollisionAlert,
  ] =
    useState(
      false,
    );


  const collisionAlertTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const [
    completionFxKey,
    setCompletionFxKey,
  ] =
    useState(
      0,
    );


  const [
    levelPulseKey,
    setLevelPulseKey,
  ] =
    useState(
      0,
    );


  const boardHostRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );


  const runRef =
    useRef<
      SavedGenZSnakeRun |
      null
    >(
      null,
    );


  const animationFrameRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const lastMoveTimeRef =
    useRef(
      0,
    );


  const touchStartRef =
    useRef<{
      x:
        number;

      y:
        number;
    } | null>(
      null,
    );


  const previousGameOverRef =
    useRef(
      false,
    );


  const previousCompletedRef =
    useRef(
      false,
    );


   const previousScoreRef =
    useRef(
      0,
    );


  const finalRecordRunIdRef =
    useRef<
      string |
      null
    >(
      null,
    );


  useEffect(() => {

    runRef.current =
      run;

  }, [
    run,
  ]);


  useEffect(() => {

    return () => {

      if (
        collisionAlertTimerRef
          .current !==
        null
      ) {

        window.clearTimeout(
          collisionAlertTimerRef
            .current,
        );
      }
    };

  }, []);


  useEffect(() => {

  if (
    !currentUser
  ) {

    setRun(
      null,
    );


    return;
  }


  const saved =
    loadGenZSnakeRun(
      currentUser.id,
    );


  if (
  saved &&
  !saved.gameState.isGameOver
) {

  /*
   * Compatibility with a run saved by the
   * previous version where 50% was treated
   * as terminal completion.
   */
  const legacyMilestoneTick =
    saved.rewardMilestoneTick ??
    (
      saved.gameState.isCompleted
        ? saved.gameState.tick
        : null
    );


  const restoredRun:
    SavedGenZSnakeRun = {
      ...saved,

      rewardMilestoneTick:
        legacyMilestoneTick,

      gameState: {
        ...saved.gameState,

        /*
         * 50% is no longer terminal.
         */
        isCompleted:
          false,
      },

      updatedAt:
        Date.now(),
    };


  setRun(
    restoredRun,
  );


  runRef.current =
    restoredRun;


  return;
}


if (
  saved
) {

  clearGenZSnakeRun(
    currentUser.id,
  );
}

}, [
  currentUser,
]);


  /*
   * =====================================================
   * ANDROID BACK
   * =====================================================
   *
   * Active game -> level screen
   * Level screen -> GenZGames home
   *
   * Active run remains locally saved when leaving
   * the gameplay view.
   */
  useEffect(() => {

    return registerNativeBackHandler(
      () => {

        if (
          screen ===
          "game"
        ) {

          setScreen(
            "levels",
          );


          return;
        }


        onBack();
      },
    );

  }, [
    screen,
    onBack,
  ]);


  /*
   * =====================================================
   * RESPONSIVE BOARD SIZE
   * =====================================================
   *
   * IMPORTANT:
   *
   * We measure the ACTUAL board host after layout.
   *
   * We do not depend on window.innerWidth.
   *
   * This fixes the old Mini Games issue where the
   * first opening could calculate the board before
   * the phone layout had settled.
   */
  useLayoutEffect(() => {

  if (
    screen !==
    "game"
  ) {
    return;
  }


  let disposed =
    false;


  const timerIds:
    number[] =
    [];


  const frameIds:
    number[] =
    [];


  const recalculate =
    () => {

      if (
        disposed
      ) {
        return;
      }


      const host =
        boardHostRef.current;


      if (
        !host
      ) {
        return;
      }


      const rect =
  host
    .getBoundingClientRect();


/*
 * IMPORTANT:
 *
 * Do not use visualViewport.width for
 * Snake board sizing.
 *
 * After a rewarded ad closes Android can
 * temporarily report a stale/smaller
 * visualViewport width even though the
 * actual React layout is already full width.
 *
 * The board host itself is the reliable
 * source because it is rendered inside the
 * final game layout.
 */
const hostWidth =
  Math.max(
    host.clientWidth,
    rect.width,
  );


const hostHeight =
  Math.max(
    host.clientHeight,
    rect.height,
  );


/*
 * Keep a tiny safety margin so the glowing
 * board border never touches/clips against
 * the host edges.
 */
const availableWidth =
  Math.max(
    0,
    hostWidth -
      4,
  );


const availableHeight =
  Math.max(
    0,
    hostHeight -
      4,
  );


const nextSize =
  Math.floor(
    Math.min(
      availableWidth,
      availableHeight,
      620,
    ),
  );


      if (
        nextSize <
        120
      ) {
        return;
      }


      setBoardSize(
        previous =>
          previous ===
            nextSize
            ? previous
            : nextSize,
      );
    };


  const queueFrame =
    () => {

      const frameId =
        window
          .requestAnimationFrame(
            () => {

              recalculate();
            },
          );


      frameIds.push(
        frameId,
      );
    };


  const queueDelayedMeasurement =
    (
      delay:
        number,
    ) => {

      const timerId =
        window.setTimeout(
          () => {

            recalculate();

            queueFrame();
          },
          delay,
        );


      timerIds.push(
        timerId,
      );
    };


  /*
   * First synchronous measurement.
   */
  recalculate();


  /*
   * First browser paint.
   */
  queueFrame();


  /*
   * Android WebView / rewarded-ad closing
   * can settle in several stages.
   *
   * Continue rechecking long enough that
   * the first opening receives exactly the
   * same board dimensions as reopening it.
   */
  queueDelayedMeasurement(
    60,
  );

  queueDelayedMeasurement(
    180,
  );

  queueDelayedMeasurement(
    350,
  );

  queueDelayedMeasurement(
    700,
  );

  queueDelayedMeasurement(
    1200,
  );


  const observer =
    typeof ResizeObserver !==
    "undefined"
      ? new ResizeObserver(
          () => {

            recalculate();
          },
        )
      : null;


  const observedHost =
  boardHostRef.current;


if (
  observedHost
) {

  observer?.observe(
    observedHost,
  );
}


  const handleViewportChange =
    () => {

      recalculate();

      queueFrame();
    };


  const handleVisibilityChange =
    () => {

      if (
        document
          .visibilityState !==
        "visible"
      ) {
        return;
      }


      /*
       * Native ad closed / app returned
       * to foreground.
       */
      recalculate();


      queueDelayedMeasurement(
        80,
      );

      queueDelayedMeasurement(
        250,
      );
    };


  window.addEventListener(
    "resize",
    handleViewportChange,
  );


  window.addEventListener(
    "orientationchange",
    handleViewportChange,
  );


  window
    .visualViewport
    ?.addEventListener(
      "resize",
      handleViewportChange,
    );


  window
    .visualViewport
    ?.addEventListener(
      "scroll",
      handleViewportChange,
    );


  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );


  return () => {

    disposed =
      true;


    observer?.disconnect();


    window.removeEventListener(
      "resize",
      handleViewportChange,
    );


    window.removeEventListener(
      "orientationchange",
      handleViewportChange,
    );


    window
      .visualViewport
      ?.removeEventListener(
        "resize",
        handleViewportChange,
      );


    window
      .visualViewport
      ?.removeEventListener(
        "scroll",
        handleViewportChange,
      );


    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );


    for (
      const timerId
      of timerIds
    ) {

      window.clearTimeout(
        timerId,
      );
    }


    for (
      const frameId
      of frameIds
    ) {

      window.cancelAnimationFrame(
        frameId,
      );
    }
  };

}, [
  screen,
]);


  const persistRun =
    useCallback(
      (
        nextRun:
          SavedGenZSnakeRun |
          null,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        if (
          !nextRun
        ) {

          clearGenZSnakeRun(
            currentUser.id,
          );


          return;
        }


        saveGenZSnakeRun(
          currentUser.id,
          nextRun,
        );
      },
      [
        currentUser,
      ],
    );


  /*
   * Save every few deterministic ticks.
   *
   * This is localStorage only.
   *
   * Zero Firebase reads/writes.
   */
  useEffect(() => {

    if (
      !run
    ) {
      return;
    }


    if (
  run.gameState.tick %
    5 ===
    0 ||
  run.gameState.isGameOver ||
  (
    run.rewardMilestoneTick !==
      null &&
    run.rewardMilestoneTick !==
      undefined &&
    run.rewardMilestoneTick ===
      run.gameState.tick
  )
) {

  persistRun(
    run,
  );
}

  }, [
    run,
    persistRun,
  ]);


  /*
   * Save immediately when the app/tab leaves
   * the foreground.
   */
  useEffect(() => {

    const handleVisibility =
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {
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


  const startLevel =
    useCallback(
      async (
        level:
          number,
      ) => {

        if (
          !currentUser ||
          startingLevel !==
            null
        ) {
          return;
        }


        if (
          level >
          highestUnlockedLevel
        ) {

          addToast(
            "Complete the previous Snake level first.",
            "info",
          );


          return;
        }


        setStartingLevel(
          level,
        );

        setClaimResult(
  null,
);


setCompletionError(
  null,
);


setShowDiamondFly(
  false,
);


        try {

          /*
           * Every NEW Snake run requires one
           * fully rewarded ad.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to start the Snake run.",
              "info",
            );


            return;
          }


          const seed =
            createSnakeSeed();


          const created =
            createInitialSnakeState(
              level,
              seed,
            );


          const now =
            Date.now();


          const nextRun:
            SavedGenZSnakeRun = {

              version:
                1,

              runId:
                createSnakeRunId(),

              seed,

              randomStep:
                created.randomStep,

              level:
                created.state.levelId,

              gameState:
                created.state,

              directionEvents:
                [],

              rewardMilestoneTick:
               null,

              rewardClaimed:
                false,

              startedAt:
                now,

              updatedAt:
                now,
            };


                    setLevelPage(
            Math.floor(
              (
                level -
                1
              ) /
                SNAKE_LEVELS_PER_PAGE,
            ),
          );


          setRun(
            nextRun,
          );


          runRef.current =
            nextRun;


          persistRun(
            nextRun,
          );


          lastMoveTimeRef.current =
            0;


          previousGameOverRef.current =
            false;


          previousCompletedRef.current =
            false;


          previousScoreRef.current =
            0;


          setScreen(
            "game",
          );


          playTone(
            520,
            "triangle",
            0.10,
            0.28,
          );

        } finally {

          setStartingLevel(
            null,
          );
        }
      },
      [
        currentUser,
        startingLevel,
        highestUnlockedLevel,
        addToast,
        persistRun,
      ],
    );


  const resumeSavedRun =
  useCallback(
    () => {

      if (
  !run ||
  run.gameState.isGameOver
) {
  return;
}


      /*
       * A completed run stays paused.
       * Opening it will trigger/retry
       * backend verification.
       */
      setRun(
        previous =>
          previous
            ? {
                ...previous,

                gameState: {
  ...previous.gameState,

  isPaused:
    false,

  isCompleted:
    false,
},

                updatedAt:
                  Date.now(),
              }
            : previous,
      );


      lastMoveTimeRef.current =
        0;


      setScreen(
        "game",
      );


      playTone(
        420,
        "sine",
        0.08,
        0.26,
      );

    },
    [
      run,
    ],
  );


  const changeDirection =
    useCallback(
      (
        direction:
          Direction,
      ) => {

        setRun(
          previous => {

            if (
  !previous ||
  previous.gameState.isPaused ||
  previous.gameState.isGameOver
) {
  return previous;
}


            const nextState =
              applySnakeDirection(
                previous.gameState,
                direction,
              );


            if (
              nextState.nextDirection ===
              previous.gameState.nextDirection
            ) {
              return previous;
            }


            /*
             * Direction applies to the NEXT movement tick.
             */
            const eventTick =
              previous.gameState.tick +
              1;


            const events = [
              ...previous.directionEvents,
            ];


            const lastEvent =
              events[
                events.length -
                1
              ];


            /*
             * Multiple fast gestures before the next
             * movement tick:
             *
             * keep only the final direction for that tick.
             */
            if (
              lastEvent &&
              lastEvent.tick ===
                eventTick
            ) {

              events[
                events.length -
                  1
              ] = {
                tick:
                  eventTick,

                direction:
                  nextState.nextDirection,
              };

            } else {

              events.push({
                tick:
                  eventTick,

                direction:
                  nextState.nextDirection,
              });
            }


            return {
              ...previous,

              gameState:
                nextState,

              directionEvents:
                events,

              updatedAt:
                Date.now(),
            };
          },
        );

      },
      [],
    );


  /*
   * =====================================================
   * KEYBOARD CONTROLS
   * =====================================================
   */
  useEffect(() => {

    if (
      screen !==
      "game"
    ) {
      return;
    }


    const handleKeyDown =
      (
        event:
          KeyboardEvent,
      ) => {

        if (
          event.key ===
          "ArrowUp"
        ) {

          event.preventDefault();

          changeDirection(
            Direction.UP,
          );
        }


        if (
          event.key ===
          "ArrowDown"
        ) {

          event.preventDefault();

          changeDirection(
            Direction.DOWN,
          );
        }


        if (
          event.key ===
          "ArrowLeft"
        ) {

          event.preventDefault();

          changeDirection(
            Direction.LEFT,
          );
        }


        if (
          event.key ===
          "ArrowRight"
        ) {

          event.preventDefault();

          changeDirection(
            Direction.RIGHT,
          );
        }
      };


    window.addEventListener(
      "keydown",
      handleKeyDown,
    );


    return () => {

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };

  }, [
    screen,
    changeDirection,
  ]);


  /*
   * =====================================================
   * GAME LOOP
   * =====================================================
   */
  useEffect(() => {

    if (
      screen !==
      "game"
    ) {
      return;
    }


    let mounted =
      true;


    const frame =
      (
        time:
          number,
      ) => {

        if (
          !mounted
        ) {
          return;
        }


        const current =
          runRef.current;


        if (
  current &&
  !current.gameState.isPaused &&
  !current.gameState.isGameOver
) {

          const config =
            generateSnakeLevel(
              current.level,
            );


          const speed =
            current.gameState.activePowerUp ===
              PowerUpType.SLOW_MO
              ? config.initialSpeed *
                  1.8
              : config.initialSpeed;


          if (
            lastMoveTimeRef.current ===
            0
          ) {

            lastMoveTimeRef.current =
              time;
          }


          if (
            time -
              lastMoveTimeRef.current >=
            speed
          ) {

            lastMoveTimeRef.current =
              time;


            setRun(
              previous => {

                if (
  !previous ||
  previous.gameState.isPaused ||
  previous.gameState.isGameOver
) {
  return previous;
}


                const result =
                  advanceSnakeTick(
                    previous.gameState,
                    previous.seed,
                    previous.randomStep,
                  );


                const rewardMilestoneTick =
  previous.rewardMilestoneTick ??
  (
    result.completed
      ? result.state.tick
      : null
  );


const nextRun:
  SavedGenZSnakeRun = {
    ...previous,

    gameState:
      result.state,

    randomStep:
      result.randomStep,

    /*
     * Store ONLY the first 50% tick.
     *
     * Even if gameplay continues to
     * 70%, 90% or 100%, this value
     * never changes.
     */
    rewardMilestoneTick,

    updatedAt:
      Date.now(),
};


                runRef.current =
                  nextRun;


                return nextRun;
              },
            );
          }
        }


        animationFrameRef.current =
          window.requestAnimationFrame(
            frame,
          );
      };


    animationFrameRef.current =
      window.requestAnimationFrame(
        frame,
      );


    return () => {

      mounted =
        false;


      if (
        animationFrameRef.current !==
        null
      ) {

        window.cancelAnimationFrame(
          animationFrameRef.current,
        );


        animationFrameRef.current =
          null;
      }
    };

  }, [
    screen,
  ]);


  /*
   * =====================================================
   * GAMEPLAY SOUND / FX
   * =====================================================
   */
  useEffect(() => {

    const state =
      run
        ?.gameState;


    if (
      !state
    ) {
      return;
    }


    if (
      state.score >
      previousScoreRef.current
    ) {

      const gained =
        state.score -
        previousScoreRef.current;


      if (
        gained >=
        5
      ) {

        playGameSound(
          "snake-special-food",
        );

      } else {

        playGameSound(
          "snake-food",
        );
      }
    }


    previousScoreRef.current =
      state.score;


    if (
      state.isGameOver &&
      !previousGameOverRef.current
    ) {

      setShakeKey(
        previous =>
          previous +
          1,
      );


      setCollisionAlert(
        true,
      );


      if (
        collisionAlertTimerRef
          .current !==
        null
      ) {

        window.clearTimeout(
          collisionAlertTimerRef
            .current,
        );
      }


      collisionAlertTimerRef
        .current =
        window.setTimeout(
          () => {

            setCollisionAlert(
              false,
            );


            collisionAlertTimerRef
              .current =
              null;
          },
          420,
        );


      playGameSound(
        "game-failed",
      );


      if (
        typeof navigator !==
          "undefined" &&
        "vibrate" in
          navigator
      ) {

        navigator.vibrate?.(
          [
            40,
            40,
            60,
          ],
        );
      }


      const currentRun =
  runRef.current;


if (
  currentUser &&
  currentRun
) {

  /*
   * Submit the full deterministic run for
   * the all-time Snake high-score table.
   *
   * This gives no reward and does not affect
   * normal Snake progression.
   */
  if (
    finalRecordRunIdRef.current !==
      currentRun.runId
  ) {

    finalRecordRunIdRef.current =
      currentRun.runId;


    void cloudflareR2
      .submitGenZSnakeFinalRecord({
        seed:
          currentRun.seed,

        level:
          currentRun.level,

        tickCount:
          currentRun
            .gameState
            .tick,

        directionEvents:
          currentRun
            .directionEvents,
      })
      .catch(
        error => {

          console.error(
            "Unable to submit Snake final record:",
            error,
          );


          /*
           * Allow another attempt if this failed.
           */
          if (
            finalRecordRunIdRef.current ===
              currentRun.runId
          ) {

            finalRecordRunIdRef.current =
              null;
          }
        },
      );
  }


  const rewardPending =
    currentRun.rewardMilestoneTick !==
      null &&
    currentRun.rewardMilestoneTick !==
      undefined &&
    !currentRun.rewardClaimed;


  if (
    rewardPending
  ) {

    persistRun(
      currentRun,
    );

  } else {

    clearGenZSnakeRun(
      currentUser.id,
    );
  }
}
    }


    previousGameOverRef.current =
      state.isGameOver;


    const milestoneReached =
  run
    ?.rewardMilestoneTick !==
      null &&
  run
    ?.rewardMilestoneTick !==
      undefined;


if (
  milestoneReached &&
  !previousCompletedRef.current
) {

      setCompletionFxKey(
        previous =>
          previous +
          1,
      );


      setLevelPulseKey(
        previous =>
          previous +
          1,
      );


      playGameSound(
        "game-complete",
      );
    }


    previousCompletedRef.current =
  milestoneReached;

  }, [
  run?.gameState,
  run?.rewardMilestoneTick,
  currentUser,
  persistRun,
]);

  const completeRun =
  useCallback(
    async () => {

      const currentRun =
  runRef.current;


const milestoneTick =
  currentRun
    ?.rewardMilestoneTick ??
  null;


if (
  !currentUser ||
  !currentRun ||
  milestoneTick ===
    null ||
  currentRun.rewardClaimed ||
  claiming ||
  claimInFlightRef.current
) {

  return;
}

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
                  currentRun.startedAt
                ) /
                  1000,
              ),
            ),
          );

          const milestoneDirectionEvents =
  currentRun
    .directionEvents
    .filter(
      event =>
        event.tick <=
        milestoneTick,
    );


        /*
         * This is the ONLY reward Cloud
         * Function call for a successful
         * Snake run.
         */
        const result =
          await cloudflareR2
            .completeGenZSnakeRun({
              runId:
                currentRun.runId,

              seed:
                currentRun.seed,

              level:
                currentRun.level,

              tickCount:
  milestoneTick,

directionEvents:
  milestoneDirectionEvents,

              elapsedSeconds,
            });


        setClaimResult(
          result,
        );


        const latestRun =
  runRef.current;


if (
  latestRun &&
  latestRun.runId ===
    currentRun.runId
) {

  const claimedRun:
    SavedGenZSnakeRun = {
      ...latestRun,

      rewardClaimed:
        true,

      updatedAt:
        Date.now(),
  };


  setRun(
    claimedRun,
  );


  runRef.current =
    claimedRun;


  /*
   * Keep the active rewarded run saved.
   * The player is still playing.
   */
  if (
    !claimedRun
      .gameState
      .isGameOver
  ) {

    persistRun(
      claimedRun,
    );

  } else {

    clearGenZSnakeRun(
      currentUser.id,
    );
  }
}


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
         * A verified Snake completion can update:
         *
         * - Snake progression
         * - Game Balance
         * - Diamonds
         * - Daily Streak
         * - Day 7 streak wallet payout
         *
         * Fetch the authoritative backend summary instead
         * of rebuilding only Snake locally.
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
            `${formatReward(
              result.rewardPaise,
            )} + ${result.diamondsGranted} diamonds earned!`,
            "success",
          );

        } else {

          addToast(
            "This Snake run was already verified.",
            "info",
          );
        }

      } catch (
        error
      ) {

        console.error(
          "Unable to verify Snake completion:",
          error,
        );


        setCompletionError(
          "Unable to verify this Snake reward. Tap Retry Verification.",
        );


        addToast(
          "Snake completion verification failed.",
          "error",
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
  onSummaryChange,
  addToast,
  persistRun,
],
  );

  useEffect(() => {

  if (
  !run ||
  run.rewardMilestoneTick ===
    null ||
  run.rewardMilestoneTick ===
    undefined ||
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


  const togglePause =
    () => {

      setRun(
        previous => {

          if (
  !previous ||
  previous.gameState.isGameOver
) {
  return previous;
}


          const next = {
            ...previous,

            gameState: {
              ...previous.gameState,

              isPaused:
                !previous.gameState.isPaused,
            },

            updatedAt:
              Date.now(),
          };


          runRef.current =
            next;


          persistRun(
            next,
          );


          return next;
        },
      );
    };


  const leaveGame =
    () => {

      const current =
        runRef.current;


      if (
  current &&
  !current.gameState.isGameOver
) {

        const pausedRun = {
          ...current,

          gameState: {
            ...current.gameState,

            isPaused:
              true,
          },

          updatedAt:
            Date.now(),
        };


        setRun(
          pausedRun,
        );


        runRef.current =
          pausedRun;


        persistRun(
          pausedRun,
        );
      }


      setScreen(
        "levels",
      );
    };


  const clearFinishedRun =
    () => {

      if (
        currentUser
      ) {

        clearGenZSnakeRun(
          currentUser.id,
        );
      }


      setRun(
  null,
);


runRef.current =
  null;


setClaimResult(
  null,
);


setCompletionError(
  null,
);


setShowDiamondFly(
  false,
);


setScreen(
  "levels",
);
    };


  const playAgain =
    async () => {

      const level =
        run
          ?.level ??
        1;


      if (
        currentUser
      ) {

        clearGenZSnakeRun(
          currentUser.id,
        );
      }


      setRun(
        null,
      );


      runRef.current =
        null;


      await startLevel(
        level,
      );
    };


  const playNextLevel =
    async () => {

      const nextLevel =
        Math.min(
          SNAKE_MAX_LEVEL,
          (
            run
              ?.level ??
            1
          ) +
            1,
        );


      if (
        currentUser
      ) {

        clearGenZSnakeRun(
          currentUser.id,
        );
      }


      setRun(
        null,
      );


      runRef.current =
        null;


      await startLevel(
        nextLevel,
      );
    };


  const progress =
    run
      ? getSnakeProgressPercent(
          run.gameState,
        )
      : 0;


  const currentPowerUp =
    useMemo(
      () => {

        if (
          !run
            ?.gameState
            .activePowerUp
        ) {
          return null;
        }


        return (
          POWER_UPS.find(
            power =>
              power.type ===
              run.gameState
                .activePowerUp,
          ) ??
          null
        );
      },
      [
        run?.gameState
          .activePowerUp,
      ],
    );


    const visibleLevels =
    useMemo(
      () => {

        return Array.from(
          {
            length:
              levelPageEnd -
              levelPageStart +
              1,
          },
          (
            _,
            index,
          ) =>
            levelPageStart +
            index,
        );
      },
      [
        levelPageStart,
        levelPageEnd,
      ],
    );


  const handleTouchStart =
    (
      event:
        React.TouchEvent<HTMLDivElement>,
    ) => {

      const touch =
        event.touches[
          0
        ];


      if (
        !touch
      ) {
        return;
      }


      touchStartRef.current = {
        x:
          touch.clientX,

        y:
          touch.clientY,
      };
    };


  const handleTouchEnd =
    (
      event:
        React.TouchEvent<HTMLDivElement>,
    ) => {

      const start =
        touchStartRef.current;


      const touch =
        event.changedTouches[
          0
        ];


      touchStartRef.current =
        null;


      if (
        !start ||
        !touch
      ) {
        return;
      }


      const dx =
        touch.clientX -
        start.x;


      const dy =
        touch.clientY -
        start.y;


      const minimumSwipe =
        24;


      if (
        Math.max(
          Math.abs(
            dx,
          ),
          Math.abs(
            dy,
          ),
        ) <
        minimumSwipe
      ) {
        return;
      }


      if (
        Math.abs(
          dx,
        ) >
        Math.abs(
          dy,
        )
      ) {

        changeDirection(
          dx >
            0
            ? Direction.RIGHT
            : Direction.LEFT,
        );


        return;
      }


      changeDirection(
        dy >
          0
          ? Direction.DOWN
          : Direction.UP,
      );
    };


  /*
   * =====================================================
   * LEVEL SCREEN
   * =====================================================
   */
  if (
    screen ===
    "levels"
  ) {

    return (
      <div
        className="
          h-[100svh]
          w-full
          overflow-hidden
          app-bg
          app-text
        "
        style={{
          paddingBottom:
            `calc(env(safe-area-inset-bottom) + ${BANNER_RESERVE_PX}px)`,
        }}
      >
        <div
          className="
            mx-auto
            flex
            h-full
            w-full
            max-w-3xl
            flex-col
            overflow-hidden
          "
        >
          <div
            className="
              shrink-0
              px-4
              pt-[calc(env(safe-area-inset-top)+12px)]
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <button
                type="button"
                onClick={
                  onBack
                }
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  app-surface
                  border
                  app-border
                  active:scale-95
                "
              >
                <ArrowLeft
                  className="
                    h-5
                    w-5
                  "
                />
              </button>


              <div
                className="
                  text-center
                "
              >
                <p
                  className="
                    text-[9px]
                    font-black
                    uppercase
                    tracking-[0.28em]
                    text-orange-500
                  "
                >
                  GenZGames
                </p>

                <h1
                  className="
                    text-xl
                    font-black
                  "
                >
                  Snake
                </h1>
              </div>


              <div
  className="
    flex
    shrink-0
    items-center
    gap-1.5
  "
>
  <div
    className="
      rounded-xl
      border
      border-[#FF4E00]/20
      bg-[#FF4E00]/10
      px-2.5
      py-2
    "
  >
    <p
      className="
        text-[7px]
        font-black
        uppercase
        text-[#FF4E00]
      "
    >
      Balance
    </p>

    <p
      className="
        text-[10px]
        font-black
      "
    >
      {formatGamePaise(
        summary
          ?.balancePaise ??
        claimResult
          ?.balancePaise ??
        0,
      )}
    </p>
  </div>


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
            </div>
          </div>


          <div
            className="
              flex-1
              overflow-y-auto
              px-4
              pb-6
              pt-4
            "
          >
            <div
              className="
                rounded-[30px]
                bg-gradient-to-br
                from-orange-500
                to-amber-400
                p-5
                text-white
                shadow-lg
              "
            >
              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-black
                      uppercase
                      tracking-[0.24em]
                      text-white/70
                    "
                  >
                    Reach {SNAKE_COMPLETE_PERCENT}% Growth
                  </p>

                  <h2
                    className="
                      mt-2
                      text-2xl
                      font-black
                    "
                  >
                    Grow. Survive. Earn.
                  </h2>

                  <p
                    className="
                      mt-2
                      max-w-sm
                      text-xs
                      font-semibold
                      leading-5
                      text-white/85
                    "
                  >
                    Every new run starts after a rewarded ad.
                    Reach 50% growth to complete the run.
                  </p>
                </div>


                <div
                  className="
                    text-5xl
                  "
                >
                  🐍
                </div>
              </div>


              <div
                className="
                  mt-5
                  grid
                  grid-cols-3
                  gap-2
                "
              >
                <div
                  className="
                    rounded-2xl
                    bg-black/15
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-lg
                      font-black
                    "
                  >
                    {formatReward(
                      SNAKE_REWARD_PAISE,
                    )}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[8px]
                      font-black
                      uppercase
                      tracking-widest
                      text-white/70
                    "
                  >
                    Reward
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    bg-black/15
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-lg
                      font-black
                    "
                  >
                    💎 {SNAKE_DIAMOND_REWARD}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[8px]
                      font-black
                      uppercase
                      tracking-widest
                      text-white/70
                    "
                  >
                    Diamonds
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    bg-black/15
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-lg
                      font-black
                    "
                  >
                    {highestUnlockedLevel}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[8px]
                      font-black
                      uppercase
                      tracking-widest
                      text-white/70
                    "
                  >
                    Unlocked
                  </p>
                </div>
              </div>
            </div>


            {run &&
  !run.gameState.isGameOver && (
                <button
                  type="button"
                  onClick={
                    resumeSavedRun
                  }
                  className="
                    mt-4
                    w-full
                    rounded-3xl
                    border
                    border-emerald-500/30
                    bg-emerald-500/10
                    p-4
                    text-left
                    active:scale-[0.99]
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div>
                      <p
  className="
    text-sm
    font-black
    text-emerald-500
  "
>
  Resume Level {run.level}
</p>

                      <p
  className="
    mt-1
    text-[11px]
    app-text-muted
  "
>
  {run.rewardClaimed
  ? `Reward earned • ${getSnakeProgressPercent(
      run.gameState,
    )}% growth saved`
  : run.rewardMilestoneTick !==
        null &&
      run.rewardMilestoneTick !==
        undefined
    ? "50% reached — reward verification pending"
    : `${getSnakeProgressPercent(
        run.gameState,
      )}% growth saved on this device`}
</p>
                    </div>


                    <Play
                      className="
                        h-5
                        w-5
                        text-emerald-500
                      "
                    />
                  </div>
                </button>
              )}


            <div
              className="
                mt-5
                flex
                items-center
                justify-between
              "
            >
              <div>
                <h3
                  className="
                    text-base
                    font-black
                  "
                >
                  Choose Level
                </h3>

                <p
                  className="
                    mt-1
                    text-[10px]
                    app-text-muted
                  "
                >
                  Replay any unlocked level and earn again.
                </p>
              </div>


              <Trophy
                className="
                  h-5
                  w-5
                  text-amber-500
                "
              />
            </div>


                        <div
              className="
                mt-4
                flex
                gap-2
                overflow-x-auto
                pb-2
              "
            >
              {Array.from(
                {
                  length:
                    SNAKE_LEVEL_PAGE_COUNT,
                },
                (
                  _,
                  index,
                ) =>
                  index,
              ).map(
                page => {

                  const start =
                    page *
                      SNAKE_LEVELS_PER_PAGE +
                    1;


                  const end =
                    Math.min(
                      SNAKE_MAX_LEVEL,

                      start +
                        SNAKE_LEVELS_PER_PAGE -
                        1,
                    );


                  return (
                    <button
                      key={
                        page
                      }
                      type="button"
                      onClick={() =>
                        setLevelPage(
                          page,
                        )
                      }
                      className={` 
                        shrink-0
                        rounded-xl
                        border
                        px-3
                        py-2
                        text-[10px]
                        font-black
                        transition
                        ${
                          levelPage ===
                          page
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "app-surface app-border app-text"
                        }
                      `}
                    >
                      {start}–{end}
                    </button>
                  );
                },
              )}
            </div>


            <div 
              className=" 
                mt-3 
                grid 
                grid-cols-4 
                gap-3 
                sm:grid-cols-5 
              " 
            > 
              {visibleLevels.map(
                level => {

                  const unlocked =
                    level <=
                    highestUnlockedLevel;


                  const loading =
                    startingLevel ===
                    level;


                  return (
                    <button
                      key={
                        level
                      }
                      type="button"
                      disabled={
                        !unlocked ||
                        startingLevel !==
                          null
                      }
                      onClick={
                        () =>
                          void startLevel(
                            level,
                          )
                      }
                      className={`
                        relative
                        aspect-square
                        rounded-2xl
                        border
                        p-2
                        transition
                        ${
                          unlocked
                            ? "app-surface app-border active:scale-95"
                            : "bg-black/5 dark:bg-white/5 app-border opacity-55"
                        }
                      `}
                    >
                      <div
                        className="
                          flex
                          h-full
                          flex-col
                          items-center
                          justify-center
                        "
                      >
                        {!unlocked ? (
                          <Lock
                            className="
                              h-4
                              w-4
                              app-text-muted
                            "
                          />
                        ) : (
                          <>
                            <span
                              className="
                                text-lg
                                font-black
                              "
                            >
                              {loading
                                ? "..."
                                : level}
                            </span>

                            <span
                              className="
                                mt-1
                                text-[7px]
                                font-black
                                uppercase
                                tracking-wider
                                app-text-muted
                              "
                            >
                              {loading
                                ? "Ad"
                                : "Play"}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


  /*
   * =====================================================
   * GAME SCREEN
   * =====================================================
   */
  const gameState =
    run
      ?.gameState ??
    null;


  if (
    !run ||
    !gameState
  ) {

    return (
      <div
        className="
          flex
          h-[100svh]
          items-center
          justify-center
          app-bg
          app-text
        "
      >
        <button
          type="button"
          onClick={
            () =>
              setScreen(
                "levels",
              )
          }
          className="
            rounded-2xl
            bg-orange-500
            px-5
            py-3
            text-sm
            font-black
            text-white
          "
        >
          Back to Snake
        </button>
      </div>
    );
  }


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
      className="
        h-[100svh]
        w-full
        overflow-hidden
        app-bg
        app-text
      "
      style={{
        paddingBottom:
          `calc(env(safe-area-inset-bottom) + ${BANNER_RESERVE_PX}px)`,
      }}
    >
      <div
        className="
          mx-auto
          flex
          h-full
          w-full
          max-w-3xl
          flex-col
          overflow-hidden
          px-3
          pt-[calc(env(safe-area-inset-top)+8px)]
        "
      >
        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              leaveGame
            }
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              app-surface
              border
              app-border
              active:scale-95
            "
          >
            <ArrowLeft
              className="
                h-4
                w-4
              "
            />
          </button>


          <div
  className="
    min-w-0
    flex-1
    text-center
    px-1
  "
>
            <p
              className="
                text-[8px]
                font-black
                uppercase
                tracking-[0.24em]
                text-orange-500
              "
            >
              Snake
            </p>

            <p
  className="
    truncate
    text-xs
    font-black
  "
>
  Level {run.level}
</p>
          </div>


          <div
  className="
    flex
    shrink-0
    items-center
    gap-1
  "
>
  <div
    className="
      rounded-xl
      border
      border-[#FF4E00]/20
      bg-[#FF4E00]/10
      px-2
      py-1.5
    "
  >
    <p
      className="
        text-[6px]
        font-black
        uppercase
        text-[#FF4E00]
      "
    >
      Balance
    </p>

    <p
      className="
        text-[9px]
        font-black
      "
    >
      {formatGamePaise(
        summary
          ?.balancePaise ??
        claimResult
          ?.balancePaise ??
        0,
      )}
    </p>
  </div>


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


  <button
    type="button"
    onClick={
      togglePause
    }
    disabled={
  gameState.isGameOver
}
    className="
      flex
      h-9
      w-9
      shrink-0
      items-center
      justify-center
      rounded-full
      app-surface
      border
      app-border
      active:scale-95
      disabled:opacity-40
    "
    aria-label={
      gameState.isPaused
        ? "Resume Snake"
        : "Pause Snake"
    }
  >
    {gameState.isPaused ? (
      <Play
        className="
          h-4
          w-4
        "
      />
    ) : (
      <Pause
        className="
          h-4
          w-4
        "
      />
    )}
  </button>
</div>


        </div>


        <div
          className="
            mt-2
            shrink-0
            rounded-2xl
            app-surface
            border
            app-border
            px-3
            py-2
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-2
              text-[10px]
              font-black
            "
          >
            <span>
              Score {gameState.score}
            </span>

            <span
              className="
                text-orange-500
              "
            >
              Growth {progress}% / {SNAKE_COMPLETE_PERCENT}%
            </span>

            <span>
              🐍 {gameState.snake.length}
            </span>
          </div>


          <div
            className="
              mt-2
              h-2.5
              overflow-hidden
              rounded-full
              bg-black/10
              dark:bg-white/10
            "
          >
            <div
              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-orange-500
                to-amber-400
                transition-[width]
                duration-200
              "
              style={{
                width:
                  `${Math.min(
                    100,
                    (
                      progress /
                      SNAKE_COMPLETE_PERCENT
                    ) *
                      100,
                  )}%`,
              }}
            />
          </div>

          {run.rewardMilestoneTick !==
  null &&
  run.rewardMilestoneTick !==
    undefined && (
  <div
    className={`
      mt-2
      flex
      items-center
      justify-between
      gap-2
      rounded-xl
      px-2.5
      py-1.5
      text-[9px]
      font-black
      ${
        run.rewardClaimed
          ? "bg-emerald-500/10 text-emerald-500"
          : completionError
            ? "bg-red-500/10 text-red-400"
            : "bg-amber-500/10 text-amber-500"
      }
    `}
  >
    <span>
      {run.rewardClaimed
        ? `✓ ${formatReward(
            SNAKE_REWARD_PAISE,
          )} + 💎 ${SNAKE_DIAMOND_REWARD} earned — keep playing!`
        : claiming
          ? "🎯 50% reached — verifying reward..."
          : completionError
            ? "⚠ Reward verification failed"
            : "🎯 50% reached — reward pending"}
    </span>


    {!run.rewardClaimed &&
      completionError && (
        <button
          type="button"
          onClick={
            () =>
              void completeRun()
          }
          className="
            shrink-0
            rounded-lg
            bg-red-500
            px-2
            py-1
            text-[8px]
            font-black
            text-white
          "
        >
          Retry
        </button>
      )}
  </div>
)}


          {currentPowerUp && (
            <div
              className="
                mt-2
                flex
                items-center
                justify-center
                gap-1.5
                text-[9px]
                font-black
                text-amber-500
              "
            >
              <span>
                {currentPowerUp.icon}
              </span>

              <span>
                {currentPowerUp.name}
              </span>

              {gameState.activePowerUpTicksLeft >
                0 && (
                <span
                  className="
                    app-text-muted
                  "
                >
                  · {gameState.activePowerUpTicksLeft}
                </span>
              )}
            </div>
          )}
        </div>


        {/*
         * This is the important responsive host.
         *
         * flex-1 + min-h-0 gives us the actual
         * remaining vertical space after header/HUD.
         *
         * The banner has already been reserved by
         * outer paddingBottom.
         */}
        <div
  ref={
    boardHostRef
  }
  className="
    relative
    mt-2
    flex
    min-h-0
    flex-1
    w-full
    items-start
    justify-center
    overflow-hidden
  "
          style={{
            touchAction:
              "none",
          }}
          onTouchStart={
            handleTouchStart
          }
          onTouchEnd={
            handleTouchEnd
          }
        >
          <div
            className={`
              relative
              shrink-0
              rounded-3xl
              transition-all
              ${
                collisionAlert
                  ? "ring-4 ring-red-500 bg-red-500/20 shadow-[0_0_32px_rgba(239,68,68,0.55)]"
                  : ""
              }
            `}
            style={{
              width:
                `${boardSize}px`,

              height:
                `${boardSize}px`,

              maxWidth:
                "100%",

              maxHeight:
                "100%",
            }}
          >
            <SnakeGameCanvas
              state={
                gameState
              }
              levelUpPulseKey={
                levelPulseKey
              }
              shakeKey={
                shakeKey
              }
              perfectClearFxKey={
                completionFxKey
              }
            />


            {gameState.isPaused &&
              !gameState.isGameOver && (
                <div
                  className="
                    absolute
                    inset-0
                    z-20
                    flex
                    items-center
                    justify-center
                    rounded-3xl
                    bg-black/60
                    backdrop-blur-sm
                  "
                >
                  <button
                    type="button"
                    onClick={
                      togglePause
                    }
                    className="
                      rounded-2xl
                      bg-orange-500
                      px-6
                      py-3
                      text-sm
                      font-black
                      text-white
                      shadow-xl
                      active:scale-95
                    "
                  >
                    ▶ Resume
                  </button>
                </div>
              )}


            {gameState.isGameOver && (
              <div
                className="
                  absolute
                  inset-0
                  z-30
                  flex
                  items-center
                  justify-center
                  rounded-3xl
                  bg-black/75
                  p-5
                  backdrop-blur-sm
                "
              >
                <div
                  className="
                    w-full
                    max-w-xs
                    rounded-[28px]
                    bg-slate-950/95
                    p-5
                    text-center
                    text-white
                    shadow-2xl
                  "
                >
                  <div
                    className="
                      text-5xl
                    "
                  >
                    💥
                  </div>

                  <h2
                    className="
                      mt-3
                      text-2xl
                      font-black
                    "
                  >
                    Game Over
                  </h2>

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-400
                    "
                  >
                    You reached {progress}% growth.
                    Reach {SNAKE_COMPLETE_PERCENT}% to earn.
                  </p>


                  <div
                    className="
                      mt-5
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >
                    <button
                      type="button"
                      onClick={
                        clearFinishedRun
                      }
                      className="
                        rounded-2xl
                        bg-white/10
                        px-3
                        py-3
                        text-xs
                        font-black
                      "
                    >
                      Levels
                    </button>

                    <button
                      type="button"
                      onClick={
                        () =>
                          void playAgain()
                      }
                      className="
                        rounded-2xl
                        bg-orange-500
                        px-3
                        py-3
                        text-xs
                        font-black
                      "
                    >
                      📺 Play Again
                    </button>
                  </div>
                </div>
              </div>
            )}


            {gameState.isCompleted && (
  <div
    className="
      absolute
      inset-0
      z-30
      flex
      items-center
      justify-center
      rounded-3xl
      bg-black/75
      p-5
      backdrop-blur-sm
    "
  >
    <div
      className="
        w-full
        max-w-xs
        rounded-[28px]
        bg-slate-950/95
        p-5
        text-center
        text-white
        shadow-2xl
      "
    >
      <div
        className="
          text-5xl
        "
      >
        🏆
      </div>


      <h2
        className="
          mt-3
          text-2xl
          font-black
        "
      >
        Level Complete
      </h2>


      <p
        className="
          mt-2
          text-xs
          text-slate-400
        "
      >
        You reached {progress}% growth.
      </p>


      {claiming && (
        <div
          className="
            mt-5
            rounded-2xl
            bg-orange-500/10
            p-4
            text-sm
            font-black
            text-orange-400
          "
        >
          Verifying 50% completion...
        </div>
      )}


      {completionError && (
        <div
          className="
            mt-5
            rounded-2xl
            border
            border-red-500/30
            bg-red-500/10
            p-4
          "
        >
          <p
            className="
              text-xs
              font-bold
              text-red-400
            "
          >
            {completionError}
          </p>


          <button
            type="button"
            disabled={
              claiming
            }
            onClick={
              () =>
                void completeRun()
            }
            className="
              mt-3
              w-full
              rounded-2xl
              bg-red-500
              px-4
              py-3
              text-xs
              font-black
              text-white
              disabled:opacity-50
            "
          >
            Retry Verification
          </button>
        </div>
      )}


      {claimResult && (
        <>
          <div
            className="
              mt-4
              grid
              grid-cols-2
              gap-2
            "
          >
            <div
              className="
                rounded-2xl
                bg-emerald-500/10
                p-3
              "
            >
              <p
                className="
                  text-lg
                  font-black
                  text-emerald-400
                "
              >
                {claimResult.rewardGranted
                  ? formatReward(
                      claimResult.rewardPaise,
                    )
                  : "Verified"}
              </p>


              <p
                className="
                  mt-1
                  text-[8px]
                  font-black
                  uppercase
                  text-slate-500
                "
              >
                {claimResult.rewardGranted
                  ? "Cash Added"
                  : "Already Processed"}
              </p>
            </div>


            <div
              className="
                rounded-2xl
                bg-cyan-500/10
                p-3
              "
            >
              <p
                className="
                  text-lg
                  font-black
                  text-cyan-400
                "
              >
                {claimResult.rewardGranted
                  ? `💎 ${claimResult.diamondsGranted}`
                  : "✓"}
              </p>


              <p
                className="
                  mt-1
                  text-[8px]
                  font-black
                  uppercase
                  text-slate-500
                "
              >
                {claimResult.rewardGranted
                  ? "Diamonds Added"
                  : "No Duplicate Reward"}
              </p>
            </div>
          </div>


          <div
            className="
              mt-5
              space-y-2
            "
          >
            {run.level <
              SNAKE_MAX_LEVEL &&
              claimResult
                .highestUnlockedLevel >
                run.level && (
                <button
                  type="button"
                  onClick={
                    () =>
                      void playNextLevel()
                  }
                  className="
                    w-full
                    rounded-2xl
                    bg-orange-500
                    px-4
                    py-3
                    text-xs
                    font-black
                  "
                >
                  📺 Next Level
                </button>
              )}


            <button
              type="button"
              onClick={
                () =>
                  void playAgain()
              }
              className="
                w-full
                rounded-2xl
                bg-white/10
                px-4
                py-3
                text-xs
                font-black
              "
            >
              <RefreshCw
                className="
                  mr-1
                  inline
                  h-3.5
                  w-3.5
                "
              />

              Replay Level
            </button>


            <button
              type="button"
              onClick={
                clearFinishedRun
              }
              className="
                w-full
                px-4
                py-2
                text-[10px]
                font-bold
                text-slate-400
              "
            >
              Back to Levels
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
          </div>
        </div>


        <div
          className="
            shrink-0
            pb-1
            text-center
            text-[9px]
            font-semibold
            app-text-muted
          "
        >
          Swipe anywhere on the game board to move
        </div>
      </div>
    </div>
    </>
  );
};