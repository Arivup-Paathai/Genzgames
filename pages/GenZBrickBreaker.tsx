import React, {
  useCallback,
  useEffect,
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
  GetGenZGamesSummaryResponse,
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
  hideGenZGamesBanner,
  showGenZGamesBanner,
  showGenZGamesRewardedAd,
} from "../services/admob";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  genZGamesApi,
} from "../services/genZGamesApi";

import type {
  ClaimBrickBreakerRewardResponse,
  CompleteBrickBreakerLevelResponse,
} from "../services/genZGamesApi";

import {
  playGameSound,
  playTone,
} from "../audioManager";

import {
  BRICK_BREAKER_DIAMOND_REWARD,
  BRICK_BREAKER_MAX_LEVEL,
  BRICK_BREAKER_MAX_REVIVES,
  BRICK_BREAKER_REWARD_PAISE,
  BRICK_BREAKER_TICK_MS,
} from "../games/brickBreaker/brickBreakerConstants";

import {
  advanceBrickBreakerTick,
  applyBrickBreakerPaddle,
  createInitialBrickBreakerState,
  getBrickBreakerProgressPercent,
  launchBrickBreakerBall,
  reviveBrickBreakerState,
  setBrickBreakerPaused,
} from "../games/brickBreaker/brickBreakerEngine";

import type {
  BrickBreakerLocalProgress,
  SavedGenZBrickBreakerRun,
} from "../games/brickBreaker/brickBreakerTypes";

import {
  appendBrickBreakerInputEvent,
  clearGenZBrickBreakerRun,
  createBrickBreakerRunId,
  createDefaultBrickBreakerProgress,
  loadGenZBrickBreakerProgress,
  loadGenZBrickBreakerRun,
  saveGenZBrickBreakerProgress,
  saveGenZBrickBreakerRun,
  selectBrickBreakerLevel,
  updateBrickBreakerPersonalBest,
} from "../games/brickBreaker/brickBreakerStorage";

import BrickBreakerGameBoard
  from "../games/brickBreaker/BrickBreakerGameBoard";


/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER
 * =========================================================
 *
 * Reward loop:
 *
 * Watch rewarded ad
 *       ↓
 * Start/replay any unlocked level
 *       ↓
 * 50% total brick HP
 *       ↓
 * Verify ₹0.05 + 10 diamonds
 *       ↓
 * KEEP PLAYING
 *       ↓
 * 100% total brick HP
 *       ↓
 * Verify clear / unlock next level
 *
 * Replay:
 *
 * Same unlocked level
 * + new rewarded ad
 * + new runId
 * = reward eligible again
 */


/*
 * =========================================================
 * PROPS
 * =========================================================
 */

interface GenZBrickBreakerProps {
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


/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

type BrickBreakerScreen =
  | "levels"
  | "game";


/*
 * =========================================================
 * UI CONSTANTS
 * =========================================================
 */

const BANNER_RESERVE_PX =
  76;


/*
 * Save deterministic gameplay to localStorage only
 * every few ticks instead of every animation frame.
 */
const SAVE_EVERY_TICKS =
  30;


/*
 * Prevent a huge animation delta after:
 *
 * - rewarded ad
 * - app background
 * - debugger pause
 */
const MAX_FRAME_DELTA_MS =
  80;


/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export const GenZBrickBreaker:
React.FC<
  GenZBrickBreakerProps
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
      BrickBreakerScreen
    >(
      "levels",
    );


  const [
    run,
    setRun,
  ] =
    useState<
      SavedGenZBrickBreakerRun |
      null
    >(
      null,
    );


  const [
    progress,
    setProgress,
  ] =
    useState<
      BrickBreakerLocalProgress
    >(
      createDefaultBrickBreakerProgress,
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
    claimingReward,
    setClaimingReward,
  ] =
    useState(
      false,
    );


  const [
    verifyingClear,
    setVerifyingClear,
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
    rewardError,
    setRewardError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    clearError,
    setClearError,
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
      ClaimBrickBreakerRewardResponse |
      null
    >(
      null,
    );


  const [
    clearResult,
    setClearResult,
  ] =
    useState<
      CompleteBrickBreakerLevelResponse |
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
    missAlert,
    setMissAlert,
  ] =
    useState(
      false,
    );


  /*
   * =====================================================
   * REFS
   * =====================================================
   */

  const runRef =
    useRef<
      SavedGenZBrickBreakerRun |
      null
    >(
      null,
    );


  const summaryRef =
    useRef<
      GetGenZGamesSummaryResponse |
      null
    >(
      summary,
    );


  const animationFrameRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const lastFrameTimeRef =
    useRef(
      0,
    );


  const accumulatorRef =
    useRef(
      0,
    );


  const lastSavedTickRef =
    useRef(
      -1,
    );


  const rewardClaimInFlightRef =
    useRef(
      false,
    );


  const clearInFlightRef =
    useRef(
      false,
    );


  const missAlertTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  /*
   * =====================================================
   * KEEP REFS CURRENT
   * =====================================================
   */

  useEffect(
    () => {

      runRef.current =
        run;

    },
    [
      run,
    ],
  );


  useEffect(
    () => {

      summaryRef.current =
        summary;

    },
    [
      summary,
    ],
  );


  useEffect(
    () => {

      return () => {

        if (
          missAlertTimerRef.current !==
          null
        ) {

          window.clearTimeout(
            missAlertTimerRef.current,
          );
        }
      };

    },
    [],
  );


  /*
   * =====================================================
   * SERVER-AUTHORITATIVE UNLOCK STATE
   * =====================================================
   */

  const highestUnlockedLevel =
    Math.max(
      1,

      Math.min(
        BRICK_BREAKER_MAX_LEVEL,

        clearResult
          ?.highestUnlockedLevel ??
        summary
          ?.brickBreaker
          .highestUnlockedLevel ??
        1,
      ),
    );


  const serverBestScore =
    Math.max(
      summary
        ?.brickBreaker
        .bestScore ??
        0,

      clearResult
        ?.bestScore ??
        0,
    );


  /*
   * =====================================================
   * CURRENT RUN DERIVED STATE
   * =====================================================
   */

  const gameProgress =
    run
      ? getBrickBreakerProgressPercent(
          run.gameState,
        )
      : 0;


  const rewardReached =
    Boolean(
      run &&
      run.rewardMilestoneTick !==
        null,
    );


  const rewardPending =
    Boolean(
      run &&
      run.rewardMilestoneTick !==
        null &&
      !run.rewardClaimed,
    );


  const levelClearPending =
    Boolean(
      run &&
      run.gameState.isLevelCleared &&
      !run.levelClearVerified,
    );


  const revivesRemaining =
    run
      ? Math.max(
          0,
          BRICK_BREAKER_MAX_REVIVES -
            run.revivesUsed,
        )
      : BRICK_BREAKER_MAX_REVIVES;


  /*
   * =====================================================
   * SUMMARY PUBLISHER
   * =====================================================
   *
   * Keep a local ref synchronized immediately.
   *
   * This prevents the 100% verification response from
   * accidentally publishing an older wallet summary while
   * React is still processing the earlier 50% reward update.
   */

  const publishSummary =
    useCallback(
      (
        next:
          GetGenZGamesSummaryResponse,
      ) => {

        summaryRef.current =
          next;


        onSummaryChange(
          next,
        );
      },
      [
        onSummaryChange,
      ],
    );


  /*
   * =====================================================
   * LOCAL RUN PERSISTENCE
   * =====================================================
   */

  const persistRun =
    useCallback(
      (
        next:
          SavedGenZBrickBreakerRun |
          null,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        if (
          next
        ) {

          saveGenZBrickBreakerRun(
            currentUser.id,
            next,
          );

        } else {

          clearGenZBrickBreakerRun(
            currentUser.id,
          );
        }
      },
      [
        currentUser,
      ],
    );


  const persistProgress =
    useCallback(
      (
        next:
          BrickBreakerLocalProgress,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        setProgress(
          next,
        );


        saveGenZBrickBreakerProgress(
          currentUser.id,
          next,
        );
      },
      [
        currentUser,
      ],
    );


  /*
   * =====================================================
   * LOAD LOCAL PROGRESS / SAVED RUN
   * =====================================================
   */

  useEffect(
    () => {

      if (
        !currentUser
      ) {

        setRun(
          null,
        );


        setProgress(
          createDefaultBrickBreakerProgress(),
        );


        return;
      }


      const localProgress =
        loadGenZBrickBreakerProgress(
          currentUser.id,
        );


      setProgress(
        localProgress,
      );


      const saved =
        loadGenZBrickBreakerRun(
          currentUser.id,
        );


      if (
        !saved
      ) {

        setRun(
          null,
        );


        runRef.current =
          null;


        return;
      }


      /*
       * A fully verified level-clear no longer needs
       * restoration after restarting the app.
       */
      if (
        saved.levelClearVerified
      ) {

        clearGenZBrickBreakerRun(
          currentUser.id,
        );


        setRun(
          null,
        );


        runRef.current =
          null;


        return;
      }


      const restored:
        SavedGenZBrickBreakerRun = {
        ...saved,

        /*
         * Never auto-resume motion after app restart.
         *
         * Player explicitly presses Resume.
         */
        gameState:
          saved.gameState.isGameOver ||
          saved.gameState.isLevelCleared
            ? saved.gameState
            : setBrickBreakerPaused(
                saved.gameState,
                true,
              ),

        updatedAt:
          Date.now(),
      };


      setRun(
        restored,
      );


      runRef.current =
        restored;

    },
    [
      currentUser,
    ],
  );


  /*
   * =====================================================
   * BANNER VISIBILITY
   * =====================================================
   *
   * LEVEL LIST:
   * adaptive banner visible.
   *
   * GAMEPLAY:
   * adaptive banner hidden.
   *
   * Brick Breaker needs unrestricted horizontal dragging
   * near the lower part of the screen.
   */

  useEffect(
    () => {

      if (
        screen ===
        "levels"
      ) {

        void showGenZGamesBanner();

      } else {

        void hideGenZGamesBanner();
      }

    },
    [
      screen,
    ],
  );


  /*
   * Leaving Brick Breaker returns to another normal
   * GenZGames screen, so make sure the shared banner
   * becomes visible again.
   */
  useEffect(
    () => {

      return () => {

        void showGenZGamesBanner();
      };

    },
    [],
  );


  /*
   * =====================================================
   * PAUSE + GO TO LEVEL LIST
   * =====================================================
   */

  const goToLevels =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          current &&
          !current.gameState.isGameOver &&
          !current.gameState.isLevelCleared
        ) {

          const paused:
            SavedGenZBrickBreakerRun = {
            ...current,

            gameState:
              setBrickBreakerPaused(
                current.gameState,
                true,
              ),

            updatedAt:
              Date.now(),
          };


          runRef.current =
            paused;


          setRun(
            paused,
          );


          persistRun(
            paused,
          );
        }


        accumulatorRef.current =
          0;


        lastFrameTimeRef.current =
          0;


        setScreen(
          "levels",
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

  useEffect(
    () => {

      return registerNativeBackHandler(
        () => {

          if (
            screen ===
            "game"
          ) {

            goToLevels();

            return;
          }


          onBack();
        },
      );

    },
    [
      screen,
      goToLevels,
      onBack,
    ],
  );


  /*
   * =====================================================
   * APP BACKGROUND
   * =====================================================
   */

  useEffect(
    () => {

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
            !current
          ) {
            return;
          }


          let next =
            current;


          if (
            !current.gameState.isGameOver &&
            !current.gameState.isLevelCleared
          ) {

            next = {
              ...current,

              gameState:
                setBrickBreakerPaused(
                  current.gameState,
                  true,
                ),

              updatedAt:
                Date.now(),
            };


            runRef.current =
              next;


            setRun(
              next,
            );
          }


          persistRun(
            next,
          );


          accumulatorRef.current =
            0;


          lastFrameTimeRef.current =
            0;
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

    },
    [
      persistRun,
    ],
  );


  /*
   * =====================================================
   * START / REPLAY LEVEL
   * =====================================================
   */

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
          level <
            1 ||
          level >
            highestUnlockedLevel ||
          level >
            BRICK_BREAKER_MAX_LEVEL
        ) {

          addToast(
            "Complete the previous Brick Breaker level first.",
            "info",
          );


          return;
        }


        const existing =
          runRef.current;


        /*
         * Do not silently destroy an unfinished/pending
         * rewarded run.
         */
        if (
          existing &&
          !existing.levelClearVerified
        ) {

          const safeToReplace =
            existing.gameState.isGameOver &&
            existing.rewardMilestoneTick ===
              null;


          if (
            !safeToReplace
          ) {

            addToast(
              "Resume or finish your saved Brick Breaker run first.",
              "info",
            );


            return;
          }
        }


        setStartingLevel(
          level,
        );


        setRewardError(
          null,
        );


        setClearError(
          null,
        );


        setClaimResult(
          null,
        );


        setClearResult(
          null,
        );


        setShowDiamondFly(
          false,
        );


        try {

          /*
           * Every NEW earning run requires
           * another rewarded ad.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to start this Brick Breaker run.",
              "info",
            );


            return;
          }


          /*
           * Hide the native banner BEFORE showing
           * the touch-heavy gameplay surface.
           */
          await hideGenZGamesBanner();


          const gameState =
            createInitialBrickBreakerState(
              level,
            );


          const now =
            Date.now();


          const nextRun:
            SavedGenZBrickBreakerRun = {
            version:
              1,

            runId:
              createBrickBreakerRunId(),

            level:
              gameState.levelId,

            gameState,

            inputEvents:
              [],

            reviveEvents:
              [],

            revivesUsed:
              0,

            rewardMilestoneTick:
              null,

            rewardClaimed:
              false,

            levelClearVerified:
              false,

            startedAt:
              now,

            updatedAt:
              now,
          };


          runRef.current =
            nextRun;


          setRun(
            nextRun,
          );


          persistRun(
            nextRun,
          );


          lastSavedTickRef.current =
            0;


          accumulatorRef.current =
            0;


          lastFrameTimeRef.current =
            0;


          /*
           * Remember last selected level locally.
           *
           * Server still controls actual unlock access.
           */
          const nextProgress =
            selectBrickBreakerLevel(
              progress,
              level,
              highestUnlockedLevel,
            );


          persistProgress(
            nextProgress,
          );


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
        progress,
        persistProgress,
      ],
    );


  /*
   * =====================================================
   * RESUME SAVED RUN
   * =====================================================
   */

  const resumeSavedRun =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current
        ) {
          return;
        }


        await hideGenZGamesBanner();


        let next =
          current;


        if (
          !current.gameState.isGameOver &&
          !current.gameState.isLevelCleared
        ) {

          next = {
            ...current,

            gameState:
              setBrickBreakerPaused(
                current.gameState,
                false,
              ),

            updatedAt:
              Date.now(),
          };


          runRef.current =
            next;


          setRun(
            next,
          );


          persistRun(
            next,
          );
        }


        accumulatorRef.current =
          0;


        lastFrameTimeRef.current =
          0;


        setRewardError(
          null,
        );


        setClearError(
          null,
        );


        setScreen(
          "game",
        );
      },
      [
        persistRun,
      ],
    );


  /*
   * =====================================================
   * PADDLE INPUT
   * =====================================================
   */

  const handlePaddleCenterChange =
    useCallback(
      (
        centerX:
          number,
      ) => {

        const current =
          runRef.current;


        if (
          !current ||
          current.gameState.isPaused ||
          current.gameState.isGameOver ||
          current.gameState.isLevelCleared
        ) {
          return;
        }


        const applied =
          applyBrickBreakerPaddle(
            current.gameState,
            centerX,
          );


        if (
          !applied.accepted
        ) {
          return;
        }


        let next:
          SavedGenZBrickBreakerRun = {
          ...current,

          gameState:
            applied.state,

          updatedAt:
            Date.now(),
        };


        next =
          appendBrickBreakerInputEvent(
            next,
            {
              type:
                "PADDLE",

              tick:
                current.gameState.tick,

              centerX,
            },
          );


        runRef.current =
          next;


        setRun(
          next,
        );
      },
      [],
    );


  /*
   * =====================================================
   * BALL LAUNCH
   * =====================================================
   */

  const handleLaunch =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          current.gameState.isPaused ||
          current.gameState.isGameOver ||
          current.gameState.isLevelCleared
        ) {
          return;
        }


        const launched =
          launchBrickBreakerBall(
            current.gameState,
          );


        if (
          !launched.accepted
        ) {
          return;
        }


        let next:
          SavedGenZBrickBreakerRun = {
          ...current,

          gameState:
            launched.state,

          updatedAt:
            Date.now(),
        };


        next =
          appendBrickBreakerInputEvent(
            next,
            {
              type:
                "LAUNCH",

              tick:
                current.gameState.tick,
            },
          );


        runRef.current =
          next;


        setRun(
          next,
        );


        /*
         * Launch is important for deterministic replay,
         * so save it immediately.
         */
        persistRun(
          next,
        );


        playTone(
          620,
          "sine",
          0.06,
          0.25,
        );
      },
      [
        persistRun,
      ],
    );


  /*
   * =====================================================
   * PAUSE / RESUME
   * =====================================================
   */

  const togglePause =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          current.gameState.isGameOver ||
          current.gameState.isLevelCleared
        ) {
          return;
        }


        const paused =
          !current.gameState.isPaused;


        const next:
          SavedGenZBrickBreakerRun = {
          ...current,

          gameState:
            setBrickBreakerPaused(
              current.gameState,
              paused,
            ),

          updatedAt:
            Date.now(),
        };


        runRef.current =
          next;


        setRun(
          next,
        );


        persistRun(
          next,
        );


        accumulatorRef.current =
          0;


        lastFrameTimeRef.current =
          0;
      },
      [
        persistRun,
      ],
    );


  /*
   * =====================================================
   * FIXED-TICK GAME LOOP
   * =====================================================
   */

  useEffect(
    () => {

      if (
        screen !==
        "game"
      ) {
        return;
      }


      let disposed =
        false;


      const frame =
        (
          frameTime:
            number,
        ) => {

          if (
            disposed
          ) {
            return;
          }


          const current =
            runRef.current;


          if (
            !current
          ) {

            animationFrameRef.current =
              window.requestAnimationFrame(
                frame,
              );


            return;
          }


          const state =
            current.gameState;


          /*
           * Ball waits on paddle.
           *
           * No deterministic tick advances until
           * the player performs a LAUNCH event.
           */
          if (
            state.isPaused ||
            state.isGameOver ||
            state.isLevelCleared ||
            !state.ballLaunched
          ) {

            lastFrameTimeRef.current =
              frameTime;


            accumulatorRef.current =
              0;


            animationFrameRef.current =
              window.requestAnimationFrame(
                frame,
              );


            return;
          }


          if (
            lastFrameTimeRef.current ===
            0
          ) {

            lastFrameTimeRef.current =
              frameTime;


            animationFrameRef.current =
              window.requestAnimationFrame(
                frame,
              );


            return;
          }


          const delta =
            Math.max(
              0,

              Math.min(
                MAX_FRAME_DELTA_MS,

                frameTime -
                  lastFrameTimeRef.current,
              ),
            );


          lastFrameTimeRef.current =
            frameTime;


          accumulatorRef.current +=
            delta;


          let working =
            current;


          let changed =
            false;


          let forceSave =
            false;


          while (
            accumulatorRef.current >=
              BRICK_BREAKER_TICK_MS
          ) {

            const before =
              working.gameState;


            if (
              before.isPaused ||
              before.isGameOver ||
              before.isLevelCleared ||
              !before.ballLaunched
            ) {
              break;
            }


            const result =
              advanceBrickBreakerTick(
                before,
              );


            const firstMilestoneTick =
              working.rewardMilestoneTick ??
              (
                result.rewardMilestoneReached
                  ? result.state.tick
                  : null
              );


            working = {
              ...working,

              gameState:
                result.state,

              rewardMilestoneTick:
                firstMilestoneTick,

              updatedAt:
                Date.now(),
            };


            accumulatorRef.current -=
              BRICK_BREAKER_TICK_MS;


            changed =
              true;


            if (
              result.brickHit
            ) {

              playGameSound(
                "brick-hit",
              );
            }


            if (
              result.lifeLost
            ) {

              forceSave =
                true;


              if (
                missAlertTimerRef.current !==
                null
              ) {

                window.clearTimeout(
                  missAlertTimerRef.current,
                );
              }


              setMissAlert(
                true,
              );


              missAlertTimerRef.current =
                window.setTimeout(
                  () => {

                    setMissAlert(
                      false,
                    );


                    missAlertTimerRef.current =
                      null;
                  },
                  420,
                );


              playGameSound(
                "game-failed",
              );
            }


            if (
              result.rewardMilestoneReached
            ) {

              /*
               * 50% does NOT stop gameplay.
               *
               * We only save the exact milestone tick.
               */
              forceSave =
                true;


              playTone(
                820,
                "triangle",
                0.16,
                0.30,
              );
            }


            if (
              result.levelCleared
            ) {

              forceSave =
                true;


              accumulatorRef.current =
                0;


              playGameSound(
                "game-complete",
              );


              break;
            }


            if (
              result.gameOver
            ) {

              forceSave =
                true;


              accumulatorRef.current =
                0;


              break;
            }
          }


          if (
            changed
          ) {

            runRef.current =
              working;


            setRun(
              working,
            );


            const currentTick =
              working
                .gameState
                .tick;


            if (
              forceSave ||
              currentTick -
                lastSavedTickRef.current >=
                SAVE_EVERY_TICKS
            ) {

              persistRun(
                working,
              );


              lastSavedTickRef.current =
                currentTick;
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

        disposed =
          true;


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


        lastFrameTimeRef.current =
          0;


        accumulatorRef.current =
          0;
      };

    },
    [
      screen,
      persistRun,
    ],
  );


  /*
   * =====================================================
   * 50% REWARD VERIFICATION
   * =====================================================
   */

  const claimReward =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !currentUser ||
          !current ||
          current.rewardMilestoneTick ===
            null ||
          current.rewardClaimed ||
          claimingReward ||
          rewardClaimInFlightRef.current
        ) {
          return;
        }


        const milestoneTick =
          current.rewardMilestoneTick;


        rewardClaimInFlightRef.current =
          true;


        setClaimingReward(
          true,
        );


        setRewardError(
          null,
        );


        try {

          /*
           * Just like Snake:
           *
           * backend receives only deterministic player
           * actions that existed up to the first 50%
           * milestone tick.
           */
          const milestoneInputEvents =
            current
              .inputEvents
              .filter(
                event =>
                  event.tick <=
                  milestoneTick,
              );


          const milestoneReviveEvents =
            current
              .reviveEvents
              .filter(
                event =>
                  event.afterTick <=
                  milestoneTick,
              );


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
              .claimBrickBreakerReward({
                runId:
                  current.runId,

                level:
                  current.level,

                milestoneTick,

                inputEvents:
                  milestoneInputEvents,

                reviveEvents:
                  milestoneReviveEvents,

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

            const claimed:
              SavedGenZBrickBreakerRun = {
              ...latest,

              rewardClaimed:
                true,

              updatedAt:
                Date.now(),
            };


            runRef.current =
              claimed;


            setRun(
              claimed,
            );


            /*
             * Player may still be between 50% and 100%.
             */
            persistRun(
              claimed,
            );
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
           * Normally use the already-loaded parent summary.
           *
           * Only fetch if for some reason it was unavailable.
           */
          const currentSummary =
            summaryRef.current ??
            await cloudflareR2
              .getGenZGamesSummary();


          const sameDiamondDay =
            currentSummary
              .diamonds
              .dayKey ===
            result.diamondDayKey;


          const nextSummary:
            GetGenZGamesSummaryResponse = {
            ...currentSummary,

            balancePaise:
              result.balancePaise,

            lifetimeEarningsPaise:
              result
                .lifetimeEarningsPaise,

            diamonds: {
              ...currentSummary.diamonds,

              dayKey:
                result.diamondDayKey,

              today:
                result.todayDiamonds,

              lifetime:
                result.lifetimeDiamonds,

              sudokuToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .sudokuToday
                  : 0,

              miningToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .miningToday
                  : 0,

              referralToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .referralToday
                  : 0,

              game2048Today:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .game2048Today
                  : 0,

              snakeToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .snakeToday
                  : 0,

              flappyRocketToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .flappyRocketToday
                  : 0,

              knifeHitToday:
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .knifeHitToday
                  : 0,

              brickBreakerToday:
                (
                  sameDiamondDay
                    ? currentSummary
                        .diamonds
                        .brickBreakerToday
                    : 0
                ) +
                result.diamondsGranted,
            },

            brickBreaker: {
              ...currentSummary
                .brickBreaker,

              rewardedRuns:
                result.rewardedRuns,
            },
          };


          publishSummary(
            nextSummary,
          );


          if (
            result.rewardGranted
          ) {

            addToast(
              `${formatGamePaise(
                result.rewardPaise,
              )} + ${result.diamondsGranted} diamonds earned! Keep playing to clear the level.`,
              "success",
            );

          } else {

            addToast(
              "This Brick Breaker run reward was already verified.",
              "info",
            );
          }

        } catch (
          error
        ) {

          console.error(
            "Unable to verify Brick Breaker reward:",
            error,
          );


          setRewardError(
            "Reward verification failed. Your run is saved and can be retried.",
          );


          persistRun(
            current,
          );


          addToast(
            "Brick Breaker reward verification failed.",
            "error",
          );

        } finally {

          rewardClaimInFlightRef.current =
            false;


          setClaimingReward(
            false,
          );
        }
      },
      [
        currentUser,
        claimingReward,
        addToast,
        persistRun,
        publishSummary,
      ],
    );


  /*
   * Automatically claim the exact first 50% milestone.
   */
  useEffect(
    () => {

      if (
        !run ||
        run.rewardMilestoneTick ===
          null ||
        run.rewardClaimed ||
        claimingReward ||
        rewardError
      ) {
        return;
      }


      void claimReward();

    },
    [
      run,
      claimingReward,
      rewardError,
      claimReward,
    ],
  );


  /*
   * =====================================================
   * 100% LEVEL CLEAR VERIFICATION
   * =====================================================
   */

  const verifyLevelClear =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !currentUser ||
          !current ||
          !current.gameState.isLevelCleared ||
          !current.rewardClaimed ||
          current.levelClearVerified ||
          verifyingClear ||
          clearInFlightRef.current
        ) {
          return;
        }


        clearInFlightRef.current =
          true;


        setVerifyingClear(
          true,
        );


        setClearError(
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
              .completeBrickBreakerLevel({
                runId:
                  current.runId,

                level:
                  current.level,

                tickCount:
                  current
                    .gameState
                    .tick,

                inputEvents:
                  current.inputEvents,

                reviveEvents:
                  current.reviveEvents,

                elapsedSeconds,
              });


          setClearResult(
            result,
          );


          const latest =
            runRef.current;


          if (
            latest &&
            latest.runId ===
              current.runId
          ) {

            const verified:
              SavedGenZBrickBreakerRun = {
              ...latest,

              levelClearVerified:
                true,

              updatedAt:
                Date.now(),
            };


            runRef.current =
              verified;


            setRun(
              verified,
            );


            /*
             * No need to restore a completely verified
             * level after app restart.
             *
             * Keep it only in React state while this
             * result screen is visible.
             */
            persistRun(
              null,
            );
          }


          const updatedProgress =
            updateBrickBreakerPersonalBest(
              progress,
              result.bestScore,
              result.highestLevelCleared,
            );


          const selectedProgress:
            BrickBreakerLocalProgress = {
            ...updatedProgress,

            selectedLevel:
              Math.min(
                result.highestUnlockedLevel,
                current.level <
                  BRICK_BREAKER_MAX_LEVEL
                  ? current.level +
                      1
                  : current.level,
              ),
          };


          persistProgress(
            selectedProgress,
          );


          /*
           * ==================================================
           * REFRESH SHARED GENZGAMES SUMMARY
           * ==================================================
           *
           * A verified 100% Brick Breaker level clear can
           * update:
           *
           * - Brick Breaker progression
           * - Daily Streak
           * - Day 7 streak wallet payout
           *
           * Fetch the authoritative backend summary instead
           * of rebuilding only Brick Breaker locally.
           */

          const nextSummary =
            await cloudflareR2
              .getGenZGamesSummary();


          publishSummary(
            nextSummary,
          );


          addToast(
            result.nextUnlockedLevel !==
              null
              ? `Level ${result.level} cleared! Level ${result.nextUnlockedLevel} unlocked.`
              : result.level ===
                  BRICK_BREAKER_MAX_LEVEL
                ? "Level 200 cleared! You can replay any unlocked level and keep earning."
                : `Level ${result.level} cleared!`,
            "success",
          );

        } catch (
          error
        ) {

          console.error(
            "Unable to verify Brick Breaker level clear:",
            error,
          );


          setClearError(
            "Level-clear verification failed. Your completed run is saved locally.",
          );


          persistRun(
            current,
          );


          addToast(
            "Brick Breaker level verification failed.",
            "error",
          );

        } finally {

          clearInFlightRef.current =
            false;


          setVerifyingClear(
            false,
          );
        }
      },
      [
        currentUser,
        verifyingClear,
        progress,
        persistProgress,
        publishSummary,
        persistRun,
        addToast,
      ],
    );


  /*
   * The level-clear call intentionally waits until the
   * 50% reward transaction has finished.
   *
   * This avoids two account transactions racing each other.
   */
  useEffect(
    () => {

      if (
        !run ||
        !run.gameState.isLevelCleared ||
        !run.rewardClaimed ||
        run.levelClearVerified ||
        verifyingClear ||
        clearError
      ) {
        return;
      }


      void verifyLevelClear();

    },
    [
      run,
      verifyingClear,
      clearError,
      verifyLevelClear,
    ],
  );


  /*
   * =====================================================
   * REWARDED-AD REVIVE
   * =====================================================
   */

  const handleRevive =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          !current.gameState.isGameOver ||
          current.gameState.isLevelCleared ||
          current.revivesUsed >=
            BRICK_BREAKER_MAX_REVIVES ||
          reviving ||
          claimingReward
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
              "Watch the full ad to revive.",
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
            !latest.gameState.isGameOver ||
            latest.revivesUsed >=
              BRICK_BREAKER_MAX_REVIVES
          ) {
            return;
          }


          const revived =
            reviveBrickBreakerState(
              latest.gameState,
            );


          if (
            !revived.accepted
          ) {
            return;
          }


          const reviveNumber =
            latest.revivesUsed +
            1;


          const next:
            SavedGenZBrickBreakerRun = {
            ...latest,

            gameState:
              revived.state,

            revivesUsed:
              reviveNumber,

            reviveEvents: [
              ...latest.reviveEvents,

              {
                afterTick:
                  latest
                    .gameState
                    .tick,

                reviveNumber,
              },
            ],

            updatedAt:
              Date.now(),
          };


          runRef.current =
            next;


          setRun(
            next,
          );


          persistRun(
            next,
          );


          accumulatorRef.current =
            0;


          lastFrameTimeRef.current =
            0;


          playTone(
            760,
            "triangle",
            0.14,
            0.30,
          );


          addToast(
            "Revived with 1 life. Tap the board to launch.",
            "success",
          );

        } finally {

          setReviving(
            false,
          );
        }
      },
      [
        reviving,
        claimingReward,
        addToast,
        persistRun,
      ],
    );


  /*
   * =====================================================
   * END / DISCARD RUN
   * =====================================================
   */

  const endRun =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current
        ) {

          setScreen(
            "levels",
          );


          return;
        }


        /*
         * Never discard a reward or verified-clear request
         * which still needs to reach the backend.
         */
        if (
          current.rewardMilestoneTick !==
            null &&
          !current.rewardClaimed
        ) {

          addToast(
            "Verify your earned 50% reward before ending this run.",
            "info",
          );


          return;
        }


        if (
          current.gameState.isLevelCleared &&
          !current.levelClearVerified
        ) {

          addToast(
            "Verify this level clear before leaving the run.",
            "info",
          );


          return;
        }


        if (
          currentUser
        ) {

          clearGenZBrickBreakerRun(
            currentUser.id,
          );
        }


        runRef.current =
          null;


        setRun(
          null,
        );


        setRewardError(
          null,
        );


        setClearError(
          null,
        );


        setClaimResult(
          null,
        );


        setClearResult(
          null,
        );


        accumulatorRef.current =
          0;


        lastFrameTimeRef.current =
          0;


        setScreen(
          "levels",
        );
      },
      [
        currentUser,
        addToast,
      ],
    );


  /*
   * =====================================================
   * REPLAY / NEXT
   * =====================================================
   */

  const replayCurrentLevel =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          !current.levelClearVerified
        ) {
          return;
        }


        const level =
          current.level;


        runRef.current =
          null;


        setRun(
          null,
        );


        await startLevel(
          level,
        );
      },
      [
        startLevel,
      ],
    );


  const playNextLevel =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          !current.levelClearVerified
        ) {
          return;
        }


        const level =
          current.level;


        if (
          level >=
          BRICK_BREAKER_MAX_LEVEL
        ) {
          return;
        }


        const nextLevel =
          level +
          1;


        runRef.current =
          null;


        setRun(
          null,
        );


        await startLevel(
          nextLevel,
        );
      },
      [
        startLevel,
      ],
    );


  /*
   * =====================================================
   * LEVEL GRID
   * =====================================================
   */

  const levels =
    useMemo(
      () =>
        Array.from(
          {
            length:
              BRICK_BREAKER_MAX_LEVEL,
          },
          (
            _,
            index,
          ) =>
            index +
            1,
        ),
      [],
    );


  /*
   * =====================================================
   * DIAMOND FLY
   * =====================================================
   */

  const diamondFly =
    showDiamondFly &&
    claimResult &&
    claimResult.diamondsGranted >
      0
      ? (
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
        )
      : null;


  /*
   * =====================================================
   * LEVEL / HOME SCREEN
   * =====================================================
   */

  if (
    screen ===
    "levels"
  ) {

    const hasSavedRun =
      Boolean(
        run &&
        !run.levelClearVerified,
      );


    return (
      <>
        {diamondFly}

        <div
          className="
            app-bg
            app-text
            w-full
            overflow-y-auto
            overscroll-contain
          "
          style={{
            height:
              "100dvh",

            minHeight:
              "100svh",

            paddingTop:
              "calc(env(safe-area-inset-top) + 10px)",

            paddingBottom:
              `calc(env(safe-area-inset-bottom) + ${BANNER_RESERVE_PX}px)`,
          }}
        >
          <div
            className="
              mx-auto
              w-full
              max-w-3xl
              px-3
              pb-6
            "
          >
            {/*
             * =============================================
             * TOP BAR
             * =============================================
             */}
            <div
              className="
                sticky
                top-0
                z-20
                -mx-1
                flex
                items-center
                justify-between
                gap-2
                px-1
                pb-2
                pt-1
                app-bg
              "
            >
              <button
                type="button"
                onClick={
                  onBack
                }
                className="
                  app-surface
                  app-border
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  shadow-sm
                "
                aria-label="Back to GenZGames"
              >
                <ArrowLeft
                  size={
                    20
                  }
                />
              </button>


              <div
                className="
                  min-w-0
                  text-center
                "
              >
                <div
                  className="
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-orange-500
                  "
                >
                  GenZGames
                </div>

                <h1
                  className="
                    truncate
                    text-base
                    font-black
                  "
                >
                  Brick Breaker
                </h1>
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


            {/*
             * =============================================
             * HERO
             * =============================================
             */}
            <section
              className="
                mt-2
                overflow-hidden
                rounded-[28px]
                border
                border-orange-500/20
                bg-gradient-to-br
                from-orange-500/15
                via-amber-500/10
                to-transparent
                p-5
              "
            >
              <div
                className="
                  flex
                  items-start
                  gap-4
                "
              >
                <div
                  className="
                    flex
                    h-16
                    w-16
                    shrink-0
                    items-center
                    justify-center
                    rounded-[22px]
                    bg-orange-500
                    text-3xl
                    shadow-lg
                    shadow-orange-500/20
                  "
                >
                  🧱
                </div>


                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <h2
                    className="
                      text-xl
                      font-black
                    "
                  >
                    Break. Earn. Replay.
                  </h2>

                  <p
                    className="
                      app-text-muted
                      mt-1
                      text-xs
                      font-medium
                      leading-5
                    "
                  >
                    Every new run starts after a rewarded ad.
                    Destroy 50% of the level&apos;s total brick
                    strength to earn, then continue all the way
                    to 100% to unlock the next level.
                  </p>
                </div>
              </div>


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
                    app-surface
                    app-border
                    rounded-2xl
                    border
                    p-3
                  "
                >
                  <div
                    className="
                      app-text-muted
                      text-[9px]
                      font-black
                      uppercase
                      tracking-[0.12em]
                    "
                  >
                    50% Reward
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    {formatGamePaise(
                      BRICK_BREAKER_REWARD_PAISE,
                    )} + {BRICK_BREAKER_DIAMOND_REWARD}💎
                  </div>
                </div>


                <div
                  className="
                    app-surface
                    app-border
                    rounded-2xl
                    border
                    p-3
                  "
                >
                  <div
                    className="
                      app-text-muted
                      text-[9px]
                      font-black
                      uppercase
                      tracking-[0.12em]
                    "
                  >
                    Levels
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    {highestUnlockedLevel} / {BRICK_BREAKER_MAX_LEVEL} unlocked
                  </div>
                </div>
              </div>
            </section>


            {/*
             * =============================================
             * SAVED RUN
             * =============================================
             */}
            {hasSavedRun &&
              run && (
              <section
                className="
                  app-surface
                  app-border
                  mt-3
                  rounded-[24px]
                  border
                  p-4
                  shadow-sm
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
                  <div
                    className="
                      min-w-0
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-black
                      "
                    >
                      Saved Level {run.level}
                    </div>

                    <div
                      className="
                        app-text-muted
                        mt-1
                        text-[11px]
                        font-semibold
                      "
                    >
                      {run.gameState.isLevelCleared
                        ? run.rewardClaimed
                          ? "100% cleared • final verification pending"
                          : "100% cleared • reward verification pending"
                        : run.gameState.isGameOver
                          ? run.rewardClaimed
                            ? "Game over • reward already earned"
                            : rewardReached
                              ? "Game over • reward verification pending"
                              : "Game over • revive available"
                          : run.rewardClaimed
                            ? `${getBrickBreakerProgressPercent(
                                run.gameState,
                              )}% • reward earned • progress saved`
                            : rewardReached
                              ? "50% reached • reward verification pending"
                              : `${getBrickBreakerProgressPercent(
                                  run.gameState,
                                )}% progress saved`}
                    </div>
                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      void resumeSavedRun()
                    }
                    className="
                      shrink-0
                      rounded-2xl
                      bg-orange-500
                      px-4
                      py-2.5
                      text-xs
                      font-black
                      text-white
                      shadow-md
                      shadow-orange-500/20
                    "
                  >
                    Resume
                  </button>
                </div>


                {!rewardPending &&
                  !levelClearPending && (
                  <button
                    type="button"
                    onClick={
                      endRun
                    }
                    className="
                      app-text-muted
                      mt-3
                      text-[10px]
                      font-bold
                      underline
                      underline-offset-2
                    "
                  >
                    Discard saved run
                  </button>
                )}
              </section>
            )}


            {/*
             * =============================================
             * STATS
             * =============================================
             */}
            <div
              className="
                mt-3
                grid
                grid-cols-3
                gap-2
              "
            >
              <div
                className="
                  app-surface
                  app-border
                  rounded-2xl
                  border
                  p-3
                  text-center
                "
              >
                <Trophy
                  className="
                    mx-auto
                    text-amber-500
                  "
                  size={
                    17
                  }
                />

                <div
                  className="
                    mt-1
                    text-sm
                    font-black
                  "
                >
                  {serverBestScore}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[8px]
                    font-black
                    uppercase
                  "
                >
                  Best
                </div>
              </div>


              <div
                className="
                  app-surface
                  app-border
                  rounded-2xl
                  border
                  p-3
                  text-center
                "
              >
                <div
                  className="
                    text-lg
                  "
                >
                  💰
                </div>

                <div
                  className="
                    mt-1
                    text-sm
                    font-black
                  "
                >
                  {summary
                    ?.brickBreaker
                    .rewardedRuns ??
                    0}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[8px]
                    font-black
                    uppercase
                  "
                >
                  Rewards
                </div>
              </div>


              <div
                className="
                  app-surface
                  app-border
                  rounded-2xl
                  border
                  p-3
                  text-center
                "
              >
                <div
                  className="
                    text-lg
                  "
                >
                  ✅
                </div>

                <div
                  className="
                    mt-1
                    text-sm
                    font-black
                  "
                >
                  {summary
                    ?.brickBreaker
                    .highestLevelCleared ??
                    0}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[8px]
                    font-black
                    uppercase
                  "
                >
                  Cleared
                </div>
              </div>
            </div>


            {/*
             * =============================================
             * LEVEL GRID
             * =============================================
             */}
            <section
              className="
                mt-5
              "
            >
              <div
                className="
                  mb-3
                  flex
                  items-end
                  justify-between
                  gap-3
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
                      app-text-muted
                      mt-0.5
                      text-[10px]
                      font-semibold
                    "
                  >
                    Replay any unlocked level and earn again.
                  </p>
                </div>


                <div
                  className="
                    app-text-muted
                    text-[9px]
                    font-black
                  "
                >
                  200 levels
                </div>
              </div>


              <div
                className="
                  grid
                  grid-cols-4
                  gap-2
                  min-[390px]:grid-cols-5
                  sm:grid-cols-6
                "
              >
                {levels.map(
                  level => {

                    const unlocked =
                      level <=
                      highestUnlockedLevel;


                    const completed =
                      level <=
                      (
                        summary
                          ?.brickBreaker
                          .highestLevelCleared ??
                        0
                      );


                    const selected =
                      progress
                        .selectedLevel ===
                      level;


                    return (
                      <button
                        type="button"
                        key={
                          level
                        }
                        disabled={
                          !unlocked ||
                          startingLevel !==
                            null
                        }
                        onClick={() => {

                          const nextProgress =
                            selectBrickBreakerLevel(
                              progress,
                              level,
                              highestUnlockedLevel,
                            );


                          persistProgress(
                            nextProgress,
                          );


                          void startLevel(
                            level,
                          );
                        }}
                        className={`
                          relative
                          flex
                          aspect-square
                          min-w-0
                          flex-col
                          items-center
                          justify-center
                          rounded-2xl
                          border
                          text-xs
                          font-black
                          transition
                          ${
                            unlocked
                              ? selected
                                ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/20"
                                : "app-surface app-border"
                              : "app-surface app-border opacity-45"
                          }
                        `}
                      >
                        {unlocked
                          ? (
                              <>
                                <span>
                                  {level}
                                </span>

                                {completed && (
                                  <span
                                    className="
                                      mt-0.5
                                      text-[7px]
                                      font-black
                                      uppercase
                                      opacity-70
                                    "
                                  >
                                    Replay
                                  </span>
                                )}

                                {startingLevel ===
                                  level && (
                                  <span
                                    className="
                                      absolute
                                      inset-x-1
                                      bottom-1
                                      text-[6px]
                                      font-black
                                      uppercase
                                    "
                                  >
                                    Ad...
                                  </span>
                                )}
                              </>
                            )
                          : (
                              <Lock
                                size={
                                  14
                                }
                              />
                            )}
                      </button>
                    );
                  },
                )}
              </div>
            </section>


            <div
              className="
                app-text-muted
                mt-5
                rounded-2xl
                border
                app-border
                p-3
                text-center
                text-[9px]
                font-semibold
                leading-4
              "
            >
              Every new run—including a replay—starts after
              a rewarded ad. One run can earn its 50% reward
              only once.
            </div>
          </div>
        </div>
      </>
    );
  }


  /*
   * =====================================================
   * GAME SCREEN
   * =====================================================
   *
   * NO BANNER RESERVE HERE.
   *
   * The native adaptive banner is hidden while gameplay
   * is open.
   */

  if (
    !run
  ) {

    return (
      <div
        className="
          app-bg
          app-text
          flex
          w-full
          items-center
          justify-center
          p-6
        "
        style={{
          height:
            "100dvh",
        }}
      >
        <button
          type="button"
          onClick={() =>
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
          Back to Levels
        </button>
      </div>
    );
  }


  const interactionEnabled =
    !run.gameState.isPaused &&
    !run.gameState.isGameOver &&
    !run.gameState.isLevelCleared &&
    !reviving;


  return (
    <>
      {diamondFly}

      <style>
        {`
          @keyframes genzBrickBreakerMissShake {
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

          .genzBrickBreakerMissAlert {
            animation:
              genzBrickBreakerMissShake
              0.38s
              ease-in-out;

            border-radius:
              24px;

            box-shadow:
              inset 0 0 90px
                rgba(
                  239,
                  68,
                  68,
                  0.30
                ),
              0 0 0 3px
                rgba(
                  239,
                  68,
                  68,
                  0.45
                ),
              0 0 30px
                rgba(
                  239,
                  68,
                  68,
                  0.30
                );
          }
        `}
      </style>

      <div
        className="
          app-bg
          app-text
          flex
          w-full
          min-w-0
          flex-col
          overflow-hidden
        "
        style={{
          height:
            "100dvh",

          minHeight:
            "100svh",

          paddingTop:
            "env(safe-area-inset-top)",

          /*
           * Banner is hidden.
           *
           * Only protect Android/iOS bottom safe area.
           */
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        {/*
         * ===============================================
         * COMPACT TOP BAR
         * ===============================================
         *
         * Kept intentionally small so short phones give
         * maximum height to the 400 × 700 game board.
         */}
        <div
          className="
            shrink-0
            px-2
            pb-1.5
            pt-1.5
          "
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-2xl
              items-center
              gap-2
            "
          >
            <button
              type="button"
              onClick={
                goToLevels
              }
              className="
                app-surface
                app-border
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
              "
              aria-label="Back to Brick Breaker levels"
            >
              <ArrowLeft
                size={
                  18
                }
              />
            </button>


            <div
              className="
                app-surface
                app-border
                grid
                h-10
                min-w-0
                flex-1
                grid-cols-4
                overflow-hidden
                rounded-xl
                border
              "
            >
              <div
                className="
                  flex
                  min-w-0
                  flex-col
                  items-center
                  justify-center
                  border-r
                  app-border
                "
              >
                <span
                  className="
                    app-text-muted
                    text-[6px]
                    font-black
                    uppercase
                  "
                >
                  Level
                </span>

                <strong
                  className="
                    text-[11px]
                  "
                >
                  {run.level}
                </strong>
              </div>


              <div
                className="
                  flex
                  min-w-0
                  flex-col
                  items-center
                  justify-center
                  border-r
                  app-border
                "
              >
                <span
                  className="
                    app-text-muted
                    text-[6px]
                    font-black
                    uppercase
                  "
                >
                  Lives
                </span>

                <strong
                  className="
                    text-[11px]
                  "
                >
                  {"❤️".repeat(
                    Math.max(
                      0,
                      run
                        .gameState
                        .lives,
                    ),
                  ) || "0"}
                </strong>
              </div>


              <div
                className="
                  flex
                  min-w-0
                  flex-col
                  items-center
                  justify-center
                  border-r
                  app-border
                "
              >
                <span
                  className="
                    app-text-muted
                    text-[6px]
                    font-black
                    uppercase
                  "
                >
                  Progress
                </span>

                <strong
                  className={`
                    text-[11px]
                    ${
                      gameProgress >=
                      50
                        ? "text-emerald-500"
                        : ""
                    }
                  `}
                >
                  {gameProgress}%
                </strong>
              </div>


              <div
                className="
                  flex
                  min-w-0
                  flex-col
                  items-center
                  justify-center
                "
              >
                <span
                  className="
                    app-text-muted
                    text-[6px]
                    font-black
                    uppercase
                  "
                >
                  Score
                </span>

                <strong
                  className="
                    max-w-full
                    truncate
                    px-1
                    text-[11px]
                  "
                >
                  {run.gameState.score}
                </strong>
              </div>
            </div>


            <button
              type="button"
              onClick={
                togglePause
              }
              disabled={
                run.gameState.isGameOver ||
                run.gameState.isLevelCleared
              }
              className="
                app-surface
                app-border
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                disabled:opacity-40
              "
              aria-label={
                run.gameState.isPaused
                  ? "Resume"
                  : "Pause"
              }
            >
              {run.gameState.isPaused
                ? (
                    <Play
                      size={
                        17
                      }
                    />
                  )
                : (
                    <Pause
                      size={
                        17
                      }
                    />
                  )}
            </button>
          </div>


          {/*
           * Thin progress bar uses almost no vertical space.
           */}
          <div
            className="
              mx-auto
              mt-1.5
              h-1.5
              w-full
              max-w-2xl
              overflow-hidden
              rounded-full
              bg-black/10
              dark:bg-white/10
            "
          >
            <div
              className={`
                h-full
                rounded-full
                transition-[width]
                duration-150
                ${
                  gameProgress >=
                  50
                    ? "bg-emerald-500"
                    : "bg-orange-500"
                }
              `}
              style={{
                width:
                  `${gameProgress}%`,
              }}
            />
          </div>
        </div>


        {/*
         * ===============================================
         * BOARD HOST
         * ===============================================
         *
         * flex-1 + min-h-0 are critical.
         *
         * BrickBreakerGameBoard measures THIS actual space.
         *
         * On a very small/short phone the entire logical
         * 400 × 700 world simply scales down proportionally.
         */}
        <div
          className={`
            relative
            min-h-0
            flex-1
            px-2
            pb-1
            ${
              missAlert
                ? "genzBrickBreakerMissAlert"
                : ""
            }
          `}
        >
          <BrickBreakerGameBoard
            state={
              run.gameState
            }
            interactionEnabled={
              interactionEnabled
            }
            onPaddleCenterChange={
              handlePaddleCenterChange
            }
            onLaunch={
              handleLaunch
            }
          />


          {/*
           * =============================================
           * 50% STATUS CHIP
           * =============================================
           */}
          {(claimingReward ||
            run.rewardClaimed ||
            rewardError) &&
            !run.gameState.isLevelCleared && (
            <div
              className="
                pointer-events-none
                absolute
                left-1/2
                top-2
                z-10
                -translate-x-1/2
                whitespace-nowrap
                rounded-full
                border
                border-emerald-500/25
                bg-black/70
                px-3
                py-1.5
                text-[8px]
                font-black
                text-white
                shadow-lg
                backdrop-blur
              "
            >
              {claimingReward
                ? "Verifying 50% reward..."
                : rewardError
                  ? "Reward verification needs retry"
                  : `✓ ${formatGamePaise(
                      BRICK_BREAKER_REWARD_PAISE,
                    )} + ${BRICK_BREAKER_DIAMOND_REWARD}💎 earned`}
            </div>
          )}


          {/*
           * =============================================
           * PAUSE OVERLAY
           * =============================================
           */}
          {run.gameState.isPaused &&
            !run.gameState.isGameOver &&
            !run.gameState.isLevelCleared && (
            <div
              className="
                absolute
                inset-0
                z-20
                flex
                items-center
                justify-center
                bg-black/45
                p-5
                backdrop-blur-sm
              "
            >
              <div
                className="
                  app-surface
                  app-border
                  w-full
                  max-w-xs
                  rounded-[26px]
                  border
                  p-5
                  text-center
                  shadow-2xl
                "
              >
                <div
                  className="
                    text-3xl
                  "
                >
                  ⏸️
                </div>

                <h2
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  Paused
                </h2>

                <p
                  className="
                    app-text-muted
                    mt-1
                    text-xs
                  "
                >
                  Your deterministic run is saved.
                </p>

                <button
                  type="button"
                  onClick={
                    togglePause
                  }
                  className="
                    mt-4
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    bg-orange-500
                    py-3
                    text-sm
                    font-black
                    text-white
                  "
                >
                  <Play
                    size={
                      17
                    }
                  />

                  Resume
                </button>


                <button
                  type="button"
                  onClick={
                    goToLevels
                  }
                  className="
                    app-surface
                    app-border
                    mt-2
                    w-full
                    rounded-2xl
                    border
                    py-3
                    text-xs
                    font-black
                  "
                >
                  Back to Levels
                </button>
              </div>
            </div>
          )}


          {/*
           * =============================================
           * GAME OVER
           * =============================================
           */}
          {run.gameState.isGameOver &&
            !run.gameState.isLevelCleared && (
            <div
              className="
                absolute
                inset-0
                z-30
                flex
                items-center
                justify-center
                overflow-y-auto
                bg-black/55
                p-4
                backdrop-blur-sm
              "
            >
              <div
                className="
                  app-surface
                  app-border
                  my-auto
                  w-full
                  max-w-sm
                  rounded-[28px]
                  border
                  p-5
                  text-center
                  shadow-2xl
                "
              >
                <div
                  className="
                    text-4xl
                  "
                >
                  💥
                </div>

                <h2
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  Game Over
                </h2>

                <p
                  className="
                    app-text-muted
                    mt-1
                    text-xs
                    leading-5
                  "
                >
                  Level {run.level} reached {gameProgress}%.
                </p>


                {run.rewardClaimed && (
                  <div
                    className="
                      mt-3
                      rounded-2xl
                      border
                      border-emerald-500/25
                      bg-emerald-500/10
                      p-3
                      text-xs
                      font-black
                      text-emerald-600
                      dark:text-emerald-400
                    "
                  >
                    ✓ 50% reward already secured
                  </div>
                )}


                {claimingReward && (
                  <div
                    className="
                      app-text-muted
                      mt-3
                      text-xs
                      font-bold
                    "
                  >
                    Verifying your 50% reward...
                  </div>
                )}


                {rewardError && (
                  <div
                    className="
                      mt-3
                      rounded-2xl
                      border
                      border-red-500/20
                      bg-red-500/10
                      p-3
                      text-[11px]
                      font-semibold
                      text-red-500
                    "
                  >
                    {rewardError}
                  </div>
                )}


                {rewardError &&
                  rewardPending && (
                  <button
                    type="button"
                    disabled={
                      claimingReward
                    }
                    onClick={() =>
                      void claimReward()
                    }
                    className="
                      mt-3
                      w-full
                      rounded-2xl
                      bg-emerald-500
                      py-3
                      text-sm
                      font-black
                      text-white
                      disabled:opacity-50
                    "
                  >
                    Retry Reward Verification
                  </button>
                )}


                {revivesRemaining >
                  0 && (
                  <button
                    type="button"
                    disabled={
                      reviving ||
                      claimingReward
                    }
                    onClick={() =>
                      void handleRevive()
                    }
                    className="
                      mt-3
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      bg-orange-500
                      py-3
                      text-sm
                      font-black
                      text-white
                      disabled:opacity-50
                    "
                  >
                    <RefreshCw
                      size={
                        17
                      }
                    />

                    {reviving
                      ? "Opening Ad..."
                      : "Watch Ad & Revive"}
                  </button>
                )}


                <button
                  type="button"
                  disabled={
                    rewardPending ||
                    claimingReward
                  }
                  onClick={
                    endRun
                  }
                  className="
                    app-surface
                    app-border
                    mt-2
                    w-full
                    rounded-2xl
                    border
                    py-3
                    text-xs
                    font-black
                    disabled:opacity-40
                  "
                >
                  End Run
                </button>


                {revivesRemaining >
                  0 && (
                  <div
                    className="
                      app-text-muted
                      mt-2
                      text-[9px]
                      font-semibold
                    "
                  >
                    One revive gives 1 life. It does not create another cash or diamond reward.
                  </div>
                )}
              </div>
            </div>
          )}


          {/*
           * =============================================
           * LEVEL CLEAR
           * =============================================
           */}
          {run.gameState.isLevelCleared && (
            <div
              className="
                absolute
                inset-0
                z-40
                flex
                items-center
                justify-center
                overflow-y-auto
                bg-black/55
                p-4
                backdrop-blur-sm
              "
            >
              <div
                className="
                  app-surface
                  app-border
                  my-auto
                  w-full
                  max-w-sm
                  rounded-[28px]
                  border
                  p-5
                  text-center
                  shadow-2xl
                "
              >
                <div
                  className="
                    text-4xl
                  "
                >
                  🏆
                </div>

                <h2
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  Level {run.level} Cleared!
                </h2>

                <p
                  className="
                    app-text-muted
                    mt-1
                    text-xs
                  "
                >
                  100% brick HP destroyed • Score {run.gameState.score}
                </p>


                <div
                  className="
                    mt-3
                    grid
                    grid-cols-2
                    gap-2
                  "
                >
                  <div
                    className="
                      rounded-2xl
                      border
                      border-emerald-500/20
                      bg-emerald-500/10
                      p-3
                    "
                  >
                    <div
                      className="
                        text-[8px]
                        font-black
                        uppercase
                        text-emerald-500
                      "
                    >
                      Reward
                    </div>

                    <div
                      className="
                        mt-1
                        text-sm
                        font-black
                      "
                    >
                      {formatGamePaise(
                        BRICK_BREAKER_REWARD_PAISE,
                      )} + {BRICK_BREAKER_DIAMOND_REWARD}💎
                    </div>
                  </div>


                  <div
                    className="
                      app-surface
                      app-border
                      rounded-2xl
                      border
                      p-3
                    "
                  >
                    <div
                      className="
                        app-text-muted
                        text-[8px]
                        font-black
                        uppercase
                      "
                    >
                      Score
                    </div>

                    <div
                      className="
                        mt-1
                        text-sm
                        font-black
                      "
                    >
                      {run.gameState.score}
                    </div>
                  </div>
                </div>


                {claimingReward && (
                  <div
                    className="
                      app-text-muted
                      mt-4
                      text-xs
                      font-bold
                    "
                  >
                    Verifying your 50% reward first...
                  </div>
                )}


                {rewardError &&
                  !run.rewardClaimed && (
                  <>
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-red-500/20
                        bg-red-500/10
                        p-3
                        text-[11px]
                        text-red-500
                      "
                    >
                      {rewardError}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void claimReward()
                      }
                      disabled={
                        claimingReward
                      }
                      className="
                        mt-3
                        w-full
                        rounded-2xl
                        bg-emerald-500
                        py-3
                        text-sm
                        font-black
                        text-white
                        disabled:opacity-50
                      "
                    >
                      Retry Reward Verification
                    </button>
                  </>
                )}


                {run.rewardClaimed &&
                  verifyingClear && (
                  <div
                    className="
                      app-text-muted
                      mt-4
                      text-xs
                      font-bold
                    "
                  >
                    Verifying 100% level clear...
                  </div>
                )}


                {clearError && (
                  <>
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-red-500/20
                        bg-red-500/10
                        p-3
                        text-[11px]
                        text-red-500
                      "
                    >
                      {clearError}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void verifyLevelClear()
                      }
                      disabled={
                        verifyingClear
                      }
                      className="
                        mt-3
                        w-full
                        rounded-2xl
                        bg-orange-500
                        py-3
                        text-sm
                        font-black
                        text-white
                        disabled:opacity-50
                      "
                    >
                      Retry Level Verification
                    </button>
                  </>
                )}


                {run.levelClearVerified && (
                  <>
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-emerald-500/25
                        bg-emerald-500/10
                        p-3
                        text-[11px]
                        font-black
                        text-emerald-600
                        dark:text-emerald-400
                      "
                    >
                      ✓ Level completion verified
                    </div>


                    {run.level <
                      BRICK_BREAKER_MAX_LEVEL && (
                      <button
                        type="button"
                        onClick={() =>
                          void playNextLevel()
                        }
                        className="
                          mt-3
                          w-full
                          rounded-2xl
                          bg-orange-500
                          py-3
                          text-sm
                          font-black
                          text-white
                          shadow-md
                          shadow-orange-500/20
                        "
                      >
                        Watch Ad & Play Level {run.level + 1}
                      </button>
                    )}


                    <button
                      type="button"
                      onClick={() =>
                        void replayCurrentLevel()
                      }
                      className="
                        app-surface
                        app-border
                        mt-2
                        w-full
                        rounded-2xl
                        border
                        py-3
                        text-xs
                        font-black
                      "
                    >
                      Replay Level {run.level} & Earn Again
                    </button>


                    <button
                      type="button"
                      onClick={() => {

                        runRef.current =
                          null;


                        setRun(
                          null,
                        );


                        setRewardError(
                          null,
                        );


                        setClearError(
                          null,
                        );


                        setScreen(
                          "levels",
                        );
                      }}
                      className="
                        app-text-muted
                        mt-3
                        text-[10px]
                        font-black
                        underline
                        underline-offset-2
                      "
                    >
                      Back to Levels
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>


        {/*
         * ===============================================
         * COMPACT CONTROL FOOTER
         * ===============================================
         *
         * On very short phones this remains only a single
         * small line.
         *
         * Board receives the remaining height and scales
         * itself uniformly.
         */}
        <div
          className="
            app-text-muted
            shrink-0
            px-3
            pb-1
            pt-0.5
            text-center
            text-[8px]
            font-semibold
          "
        >
          Drag anywhere inside the board to move • Tap to launch
        </div>
      </div>
    </>
  );
};


export default GenZBrickBreaker;