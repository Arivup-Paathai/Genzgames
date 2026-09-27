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
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
  WalletCards,
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
  CompleteCandyCascadeRunResponse,
} from "../services/genZGamesApi";

import {
  playGameSound,
  playTone,
} from "../audioManager";

import {
  CANDY_CASCADE_DIAMOND_REWARD,
  CANDY_CASCADE_EXTRA_MOVES,
  CANDY_CASCADE_IDLE_HINT_MS,
  CANDY_CASCADE_LEVELS_PER_WORLD,
  CANDY_CASCADE_MAX_LEVEL,
  CANDY_CASCADE_REWARD_PAISE,
  CANDY_CASCADE_WORLD_NAMES,
  generateCandyCascadeLevel,
  getCandyCascadeStarThresholds,
  getCandyCascadeWorld,
  getCandyCascadeWorldName,
} from "../games/candyCascade/candyCascadeConstants";

import {
  applyCandyCascadeContinue,
  applyCandyCascadeSwap,
  canCandyCascadeContinue,
  getCandyCascadeHint,
  getCandyCascadeProgressPercent,
} from "../games/candyCascade/candyCascadeEngine";

import type {
  CandyCascadeGameState,
  CandyCascadeLocalProgress,
  CandyCascadeObjectiveProgress,
  CandyCascadePoint,
  SavedGenZCandyCascadeRun,
} from "../games/candyCascade/candyCascadeTypes";

import {
  appendCandyCascadeContinueEvent,
  appendCandyCascadeSwapEvent,
  applyVerifiedCandyCascadeProgress,
  canDiscardCandyCascadeRun,
  clearCandyCascadeRun,
  createDefaultCandyCascadeProgress,
  createNewCandyCascadeRun,
  getCandyCascadeEventsForVerification,
  hasPendingCandyCascadeSettlement,
  isCandyCascadeRunFullySettled,
  loadCandyCascadeProgress,
  loadCandyCascadeRun,
  saveCandyCascadeProgress,
  saveCandyCascadeRun,
  selectCandyCascadeLevel,
  updateCandyCascadeRunState,
} from "../games/candyCascade/candyCascadeStorage";

import CandyCascadeBoard, {
  type CandyCascadeBoardVisualState,
} from "../games/candyCascade/CandyCascadeBoard";


/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE
 * ============================================================
 *
 * Reward loop:
 *
 * Watch rewarded ad
 *        ↓
 * Start / replay any unlocked level
 *        ↓
 * Complete every level objective
 *        ↓
 * Backend deterministic replay
 *        ↓
 * ₹0.05 + 10 diamonds
 *        ↓
 * 1–3 verified stars
 *        ↓
 * Unlock next level
 *
 *
 * Out of moves:
 *
 * One rewarded-ad continue per run
 *        ↓
 * +5 moves
 *        ↓
 * No extra cash / diamond reward
 *
 *
 * Replay:
 *
 * Any unlocked level
 * + new rewarded ad
 * + new runId / seed
 * = reward eligible again
 */


/*
 * ============================================================
 * PROPS
 * ============================================================
 */

interface GenZCandyCascadeProps {
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
 * ============================================================
 * SCREEN
 * ============================================================
 */

type CandyCascadeScreen =
  | "levels"
  | "game";


/*
 * ============================================================
 * PAGE CONSTANTS
 * ============================================================
 */

/*
 * Level/world selection screen has the adaptive banner.
 */
const BANNER_RESERVE_PX =
  76;


const CANDY_CASCADE_LEVELS_PER_PAGE =
  100;


const CANDY_CASCADE_WORLDS_PER_PAGE =
  CANDY_CASCADE_LEVELS_PER_PAGE /
  CANDY_CASCADE_LEVELS_PER_WORLD;


const CANDY_CASCADE_PAGE_COUNT =
  Math.ceil(
    CANDY_CASCADE_MAX_LEVEL /
      CANDY_CASCADE_LEVELS_PER_PAGE,
  );


/*
 * Short visual timing only.
 *
 * These values do NOT affect deterministic gameplay.
 */
const SWAP_VISUAL_MS =
  140;


const REMOVE_VISUAL_MS =
  190;


const FALL_VISUAL_MS =
  190;


const SHUFFLE_VISUAL_MS =
  240;


/*
 * ============================================================
 * SMALL HELPERS
 * ============================================================
 */

const clamp =
  (
    value:
      number,

    minimum:
      number,

    maximum:
      number,
  ) =>
    Math.max(
      minimum,

      Math.min(
        maximum,
        value,
      ),
    );


const getObjectiveLabel =
  (
    objective:
      CandyCascadeObjectiveProgress,
  ) => {

    if (
      objective.type ===
      "SCORE"
    ) {

      return `Score ${objective.current}/${objective.target}`;
    }


    if (
      objective.type ===
      "COLLECT_COLOR"
    ) {

      const color =
        objective.color
          ?.toLowerCase() ??
        "color";


      return `Collect ${color} ${objective.current}/${objective.target}`;
    }


    if (
      objective.type ===
      "CLEAR_JELLY"
    ) {

      return `Clear jelly ${objective.current}/${objective.target}`;
    }


    if (
      objective.type ===
      "BREAK_BLOCKERS"
    ) {

      return `Break blockers ${objective.current}/${objective.target}`;
    }


    return `Drop items ${objective.current}/${objective.target}`;
  };


const getObjectiveVisual =
  (
    objective:
      CandyCascadeObjectiveProgress,
  ) => {

    if (
      objective.type ===
      "CLEAR_JELLY"
    ) {

      return (
        <span
          className="
            flex
            h-6
            w-6
            shrink-0
            items-center
            justify-center
            rounded-lg
            border
            border-pink-300/70
            bg-gradient-to-br
            from-pink-200
            via-fuchsia-200
            to-purple-200
            text-sm
            shadow-inner
          "
          aria-label="Jelly"
        >
          🫧
        </span>
      );
    }


    if (
      objective.type ===
      "BREAK_BLOCKERS"
    ) {

      return (
        <span
          className="
            flex
            h-6
            w-6
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-amber-500/15
            text-sm
          "
        >
          🧱
        </span>
      );
    }


    if (
      objective.type ===
      "DROP_ITEMS"
    ) {

      return (
        <span
          className="
            flex
            h-6
            w-6
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-emerald-500/10
            text-sm
          "
        >
          🍒
        </span>
      );
    }


    if (
      objective.type ===
      "COLLECT_COLOR"
    ) {

      const colorClass =
        objective.color ===
        "RED"
          ? "bg-red-500"
          : objective.color ===
            "BLUE"
            ? "bg-blue-500"
            : objective.color ===
              "GREEN"
              ? "bg-emerald-500"
              : objective.color ===
                "YELLOW"
                ? "bg-yellow-400"
                : objective.color ===
                  "PURPLE"
                  ? "bg-purple-500"
                  : "bg-orange-500";


      return (
        <span
          className={`
            h-6
            w-6
            shrink-0
            rounded-full
            border-2
            border-white/50
            shadow-sm
            ${colorClass}
          `}
        />
      );
    }


    return (
      <span
        className="
          flex
          h-6
          w-6
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-fuchsia-500/10
          text-sm
        "
      >
        ⭐
      </span>
    );
  };


const getLevelStars =
  (
    levelStars:
      Record<
        string,
        number
      >,

    level:
      number,
  ) =>
    clamp(
      Number(
        levelStars[
          String(
            level,
          )
        ] ??
        0,
      ),

      0,
      3,
    );


const wait =
  (
    milliseconds:
      number,
  ) =>
    new Promise<void>(
      resolve => {

        window.setTimeout(
          resolve,
          milliseconds,
        );
      },
    );


const createVisualSwapState =
  (
    state:
      CandyCascadeGameState,

    from:
      CandyCascadePoint,

    to:
      CandyCascadePoint,
  ): CandyCascadeGameState => {

    const board =
      state.board.map(
        row =>
          row.map(
            cell => ({
              ...cell,
            }),
          ),
      );


    const fromCell =
      board[
        from.row
      ]?.[
        from.col
      ];


    const toCell =
      board[
        to.row
      ]?.[
        to.col
      ];


    if (
      !fromCell ||
      !toCell
    ) {
      return state;
    }


    const fromPiece =
      fromCell.piece;


    const fromDropItem =
      fromCell.dropItem;


    fromCell.piece =
      toCell.piece;


    fromCell.dropItem =
      toCell.dropItem;


    toCell.piece =
      fromPiece;


    toCell.dropItem =
      fromDropItem;


    return {
      ...state,

      board,
    };
  };


/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export const GenZCandyCascade:
React.FC<
  GenZCandyCascadeProps
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


  /*
   * ==========================================================
   * PAGE STATE
   * ==========================================================
   */

  const [
    screen,
    setScreen,
  ] =
    useState<
      CandyCascadeScreen
    >(
      "levels",
    );


  const [
    worldPage,
    setWorldPage,
  ] =
    useState(
      0,
    );


  const [
    run,
    setRun,
  ] =
    useState<
      SavedGenZCandyCascadeRun |
      null
    >(
      null,
    );


  const [
    progress,
    setProgress,
  ] =
    useState<
      CandyCascadeLocalProgress
    >(
      createDefaultCandyCascadeProgress,
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
    busySwap,
    setBusySwap,
  ] =
    useState(
      false,
    );


  const [
    continuing,
    setContinuing,
  ] =
    useState(
      false,
    );


  const [
    settling,
    setSettling,
  ] =
    useState(
      false,
    );


  const [
    settlementError,
    setSettlementError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    settlementResult,
    setSettlementResult,
  ] =
    useState<
      CompleteCandyCascadeRunResponse |
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
    wrongMoveAlert,
    setWrongMoveAlert,
  ] =
    useState(
      false,
    );


  const [
    hint,
    setHint,
  ] =
    useState<{
      from:
        CandyCascadePoint;

      to:
        CandyCascadePoint;
    } | null>(
      null,
    );


  const [
    visualState,
    setVisualState,
  ] =
    useState<
      CandyCascadeBoardVisualState
    >({
      phase:
        "IDLE",

      highlightedCells:
        [],

      blastCells:
        [],
    });


  const [
    visualGameState,
    setVisualGameState,
  ] =
    useState<
      CandyCascadeGameState |
      null
    >(
      null,
    );


  /*
   * ==========================================================
   * REFS
   * ==========================================================
   */

  const runRef =
    useRef<
      SavedGenZCandyCascadeRun |
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


  const settlementInFlightRef =
    useRef(
      false,
    );


  const hintTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const visualTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const wrongMoveAlertTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  /*
   * ==========================================================
   * KEEP REFS CURRENT
   * ==========================================================
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


  /*
   * ==========================================================
   * SERVER-AUTHORITATIVE PROGRESSION
   * ==========================================================
   */

  const highestUnlockedLevel =
    Math.max(
      1,

      Math.min(
        CANDY_CASCADE_MAX_LEVEL,

        settlementResult
          ?.highestUnlockedLevel ??
        summary
          ?.candyCascade
          .highestUnlockedLevel ??
        1,
      ),
    );


  const highestLevelCleared =
    Math.max(
      settlementResult
        ?.highestLevelCleared ??
      0,

      summary
        ?.candyCascade
        .highestLevelCleared ??
      0,
    );


  const serverBestScore =
    Math.max(
      settlementResult
        ?.bestScore ??
      0,

      summary
        ?.candyCascade
        .bestScore ??
      0,
    );


  const serverTotalStars =
    Math.max(
      settlementResult
        ?.totalStars ??
      0,

      summary
        ?.candyCascade
        .totalStars ??
      0,
    );


  const serverLevelStars =
    settlementResult
      ?.levelStars ??
    summary
      ?.candyCascade
      .levelStars ??
    {};


  /*
   * ==========================================================
   * CURRENT CASH + DIAMONDS
   * ==========================================================
   *
   * Candy Cascade shows BOTH.
   *
   * Brick Breaker's current top bar only exposes diamonds.
   * Here we keep the player's actual GenZGames cash wallet
   * visible beside the daily diamond counter.
   */

  const currentWalletPaise =
    settlementResult
      ?.balancePaise ??
    summary
      ?.balancePaise ??
    0;


  const currentDiamonds =
    settlementResult
      ?.todayDiamonds ??
    summary
      ?.diamonds
      .today ??
    0;


  /*
   * ==========================================================
   * CURRENT RUN DERIVED STATE
   * ==========================================================
   */

  const gameState:
    CandyCascadeGameState |
    null =
    run
      ?.gameState ??
    null;


  const currentLevel =
    gameState
      ?.levelId ??
    progress.selectedLevel ??
    1;


  const currentConfig =
    useMemo(
      () =>
        generateCandyCascadeLevel(
          currentLevel,
        ),
      [
        currentLevel,
      ],
    );


  const currentWorld =
    getCandyCascadeWorld(
      currentLevel,
    );


  const currentWorldName =
    getCandyCascadeWorldName(
      currentLevel,
    );


  const gameProgress =
    gameState
      ? getCandyCascadeProgressPercent(
          gameState,
        )
      : 0;


  const continueAvailable =
    gameState
      ? canCandyCascadeContinue(
          gameState,
        )
      : false;


  const currentStarThresholds =
    useMemo(
      () =>
        getCandyCascadeStarThresholds(
          currentLevel,
        ),
      [
        currentLevel,
      ],
    );


  /*
   * ==========================================================
   * SUMMARY PUBLISHER
   * ==========================================================
   *
   * Keep the ref updated immediately so a settlement response
   * never publishes stale wallet or diamond values.
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
   * ==========================================================
   * LOCAL RUN PERSISTENCE
   * ==========================================================
   */

  const persistRun =
    useCallback(
      (
        next:
          SavedGenZCandyCascadeRun |
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

          saveCandyCascadeRun(
            currentUser.id,
            next,
          );

        } else {

          clearCandyCascadeRun(
            currentUser.id,
          );
        }
      },
      [
        currentUser,
      ],
    );


  /*
   * ==========================================================
   * LOCAL PROGRESS PERSISTENCE
   * ==========================================================
   */

  const persistProgress =
    useCallback(
      (
        next:
          CandyCascadeLocalProgress,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        setProgress(
          next,
        );


        saveCandyCascadeProgress(
          currentUser.id,
          next,
        );
      },
      [
        currentUser,
      ],
    );


  /*
   * ==========================================================
   * LOAD LOCAL PROGRESS / SAVED RUN
   * ==========================================================
   */

  useEffect(
    () => {

      if (
        !currentUser
      ) {

        setRun(
          null,
        );


        runRef.current =
          null;


        setProgress(
          createDefaultCandyCascadeProgress(),
        );


        return;
      }


      const localProgress =
        loadCandyCascadeProgress(
          currentUser.id,
        );


      setProgress(
        localProgress,
      );


      const saved =
        loadCandyCascadeRun(
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
       * Fully settled runs do not need restoration.
       */
      if (
        isCandyCascadeRunFullySettled(
          saved,
        )
      ) {

        clearCandyCascadeRun(
          currentUser.id,
        );


        setRun(
          null,
        );


        runRef.current =
          null;


        return;
      }


      /*
       * Keep:
       *
       * - active run
       * - out-of-moves run waiting for +5 continue
       * - completed run waiting for backend verification
       *
       * We never silently destroy a rewarded-ad run.
       */
      setRun(
        saved,
      );


      runRef.current =
        saved;

    },
    [
      currentUser,
    ],
  );


  /*
   * ==========================================================
   * BANNER VISIBILITY
   * ==========================================================
   *
   * LEVEL / WORLD MAP:
   * banner visible
   *
   * ACTIVE MATCH-3 BOARD:
   * banner hidden
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
   * Leaving Candy Cascade returns to another normal
   * GenZGames screen.
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
   * ==========================================================
   * TIMER CLEANUP
   * ==========================================================
   */

  useEffect(
    () => {

      return () => {

        if (
          hintTimerRef.current !==
          null
        ) {

          window.clearTimeout(
            hintTimerRef.current,
          );
        }


        if (
          visualTimerRef.current !==
          null
        ) {

          window.clearTimeout(
            visualTimerRef.current,
          );
        }


        if (
          wrongMoveAlertTimerRef.current !==
          null
        ) {

          window.clearTimeout(
            wrongMoveAlertTimerRef.current,
          );
        }
      };

    },
    [],
  );


 /*
 * ==========================================================
 * GO TO LEVEL / WORLD MAP
 * ==========================================================
 */

  const goToLevels =
    useCallback(
      () => {

        const current =
          runRef.current;


        /*
         * Match-3 gameplay is turn based.
         *
         * There is no continuously moving physics state,
         * so simply persist the exact deterministic run
         * before leaving the board.
         */
        if (
          current
        ) {

          persistRun(
            current,
          );
        }


        setHint(
          null,
        );


        setVisualGameState(
          null,
        );


        setVisualState({
          phase:
            "IDLE",

          highlightedCells:
            [],

          blastCells:
            [],
        });


        setBusySwap(
          false,
        );


        setScreen(
          "levels",
        );
      },
      [
        persistRun,
      ],
    );


/*
 * ==========================================================
 * ANDROID BACK
 * ==========================================================
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
 * ==========================================================
 * APP BACKGROUND SAVE
 * ==========================================================
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

    },
    [
      persistRun,
    ],
  );


/*
 * ==========================================================
 * START / REPLAY LEVEL
 * ==========================================================
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
            CANDY_CASCADE_MAX_LEVEL ||
          level >
            highestUnlockedLevel
        ) {

          addToast(
            "Complete the previous Candy Cascade level first.",
            "info",
          );


          return;
        }


        const existing =
          runRef.current;


        /*
         * Never silently destroy:
         *
         * - an active rewarded-ad run
         * - a cleared run waiting for backend settlement
         *
         * A failed run or completely settled run is safe
         * to replace with a new rewarded-ad run.
         */
        if (
          existing &&
          !canDiscardCandyCascadeRun(
            existing,
          )
        ) {

          if (
            hasPendingCandyCascadeSettlement(
              existing,
            )
          ) {

            addToast(
              "Verify your completed Candy Cascade run first.",
              "info",
            );

          } else {

            addToast(
              "Resume or finish your saved Candy Cascade run first.",
              "info",
            );
          }


          return;
        }


        setStartingLevel(
          level,
        );


        setSettlementError(
          null,
        );


        setSettlementResult(
          null,
        );


        setShowDiamondFly(
          false,
        );


        setHint(
          null,
        );


        try {

          /*
           * Every NEW reward-eligible run requires
           * one completed rewarded ad.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to start this Candy Cascade run.",
              "info",
            );


            return;
          }


          /*
           * Native banner must be gone before the
           * touch-heavy match-3 board appears.
           */
          await hideGenZGamesBanner();


          /*
           * Storage helper creates:
           *
           * - new runId
           * - new seed
           * - deterministic initial board
           * - empty event history
           * - fresh settlement flags
           */
          const nextRun =
            createNewCandyCascadeRun(
              level,
            );


          setWorldPage(
            Math.floor(
              (
                level -
                1
              ) /
                CANDY_CASCADE_LEVELS_PER_PAGE,
            ),
          );


          runRef.current =
            nextRun;


          setRun(
            nextRun,
          );


          persistRun(
            nextRun,
          );


          /*
           * Local selection is convenience only.
           *
           * The backend summary remains authoritative
           * for actual unlocked access.
           */
          const nextProgress =
            selectCandyCascadeLevel(
              progress,
              level,
            );


          persistProgress(
            nextProgress,
          );


          setVisualState({
            phase:
              "IDLE",

            highlightedCells:
              [],

            blastCells:
              [],
          });


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
        progress,
        persistProgress,
        persistRun,
      ],
    );


/*
 * ==========================================================
 * RESUME SAVED RUN
 * ==========================================================
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


        setSettlementError(
          null,
        );


        setHint(
          null,
        );


        setVisualState({
          phase:
            "IDLE",

          highlightedCells:
            [],

          blastCells:
            [],
        });


        setScreen(
          "game",
        );
      },
      [],
    );


/*
 * ==========================================================
 * IDLE HINT
 * ==========================================================
 *
 * After five seconds without a valid move,
 * pulse one deterministic possible swap.
 *
 * This is UI-only.
 *
 * No hint event is recorded and therefore it has
 * zero effect on backend replay.
 */

  useEffect(
    () => {

      if (
        hintTimerRef.current !==
        null
      ) {

        window.clearTimeout(
          hintTimerRef.current,
        );


        hintTimerRef.current =
          null;
      }


      if (
        screen !==
          "game" ||
        !gameState ||
        busySwap ||
        continuing ||
        settling ||
        gameState.isGameOver ||
        gameState.isLevelCleared
      ) {

        setHint(
          null,
        );


        return;
      }


      hintTimerRef.current =
        window.setTimeout(
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


            const nextHint =
              getCandyCascadeHint(
                current
                  .gameState
                  .board,
              );


            setHint(
              nextHint,
            );
          },
          CANDY_CASCADE_IDLE_HINT_MS,
        );


      return () => {

        if (
          hintTimerRef.current !==
          null
        ) {

          window.clearTimeout(
            hintTimerRef.current,
          );


          hintTimerRef.current =
            null;
        }
      };

    },
    [
      screen,
      gameState,
      busySwap,
      continuing,
      settling,
    ],
  );


/*
 * ==========================================================
 * SWAP
 * ==========================================================
 */

  const handleSwap =
    useCallback(
      async (
        from:
          CandyCascadePoint,

        to:
          CandyCascadePoint,
      ) => {

        const current =
          runRef.current;


        if (
          !current ||
          busySwap ||
          continuing ||
          settling ||
          current.gameState.isGameOver ||
          current.gameState.isLevelCleared
        ) {
          return;
        }


        /*
         * Important for backend replay:
         *
         * SWAP moveIndex is the number of successful moves
         * BEFORE this new move is applied.
         */
        const moveIndex =
          current
            .gameState
            .movesUsed;


        setBusySwap(
          true,
        );


        setHint(
          null,
        );


        setVisualState({
          phase:
            "SWAP",

          highlightedCells: [
            from,
            to,
          ],

          blastCells:
            [],
        });


        try {

          await wait(
            SWAP_VISUAL_MS,
          );


          const resolution =
            applyCandyCascadeSwap(
              current.gameState,
              from,
              to,
            );


          /*
           * Invalid match-3 swaps consume no move
           * and are NOT stored in deterministic history.
           *
           * Keep the board busy for one more swap duration so
           * the two candies visibly slide back to their original
           * positions before input is enabled again.
           */
          if (
            !resolution
              .result
              .accepted
          ) {

            if (
              wrongMoveAlertTimerRef.current !==
              null
            ) {

              window.clearTimeout(
                wrongMoveAlertTimerRef.current,
              );
            }


            setWrongMoveAlert(
              true,
            );


            wrongMoveAlertTimerRef.current =
              window.setTimeout(
                () => {

                  setWrongMoveAlert(
                    false,
                  );


                  wrongMoveAlertTimerRef.current =
                    null;
                },
                420,
              );


            playGameSound(
              "wrong-move",
            );


            setVisualState({
              phase:
                "IDLE",

              highlightedCells:
                [],

              blastCells:
                [],
            });


            await wait(
              SWAP_VISUAL_MS,
            );


            setVisualGameState(
              null,
            );


            return;
          }


          /*
           * Build the presentation-only board AFTER the two
           * candies have swapped but BEFORE matches disappear.
           */
          const swappedVisualState =
            createVisualSwapState(
              current.gameState,
              from,
              to,
            );


          setVisualGameState(
            swappedVisualState,
          );


          playGameSound(
            "candy-move",
          );


          /*
           * Record the exact accepted player action first.
           */
          let nextRun =
            appendCandyCascadeSwapEvent(
              current,
              {
                type:
                  "SWAP",

                moveIndex,

                from: {
                  row:
                    from.row,

                  col:
                    from.col,
                },

                to: {
                  row:
                    to.row,

                  col:
                    to.col,
                },
              },
            );


          /*
           * Then store the deterministic final engine result.
           */
          nextRun =
            updateCandyCascadeRunState(
              nextRun,
              resolution
                .result
                .state,
            );


          /*
           * Keep the final deterministic run authoritative
           * immediately, but delay publishing it to React until
           * all presentation-only cascade animations finish.
           */
          runRef.current =
            nextRun;


          let currentVisualState =
            swappedVisualState;


          /*
           * Animate every deterministic cascade step using the
           * exact intermediate boards returned by the engine.
           */
          for (
            const cascadeStep of
            resolution.cascadeSteps
          ) {

            /*
             * 1. Show the matching candies still present and
             * visibly pop / blast them.
             */
            setVisualState({
              phase:
                "REMOVE",

              highlightedCells:
                cascadeStep
                  .matchedCells,

              blastCells:
                cascadeStep
                  .blastCells,
            });


            if (
              cascadeStep
                .removedPieces >
              0
            ) {

              playGameSound(
                "candy-match",
              );
            }


            await wait(
              REMOVE_VISUAL_MS,
            );


            /*
             * 2. Show the exact board after removal.
             *
             * The matched cells are now actually empty.
             */
            currentVisualState = {
              ...currentVisualState,

              board:
                cascadeStep
                  .boardAfterRemoval,
            };


            setVisualGameState(
              currentVisualState,
            );


            setVisualState({
              phase:
                "IDLE",

              highlightedCells:
                [],

              blastCells:
                [],
            });


            /*
             * Tiny pause makes the empty spaces readable before
             * gravity/refill enters.
             */
            await wait(
              45,
            );


            /*
             * 3. Show the exact gravity/refill board and animate
             * all visible occupants downward.
             */
            currentVisualState = {
              ...currentVisualState,

              board:
                cascadeStep
                  .boardAfterGravity,
            };


            setVisualGameState(
              currentVisualState,
            );


            setVisualState({
              phase:
                "FALL",

              highlightedCells:
                [],

              blastCells:
                [],
            });


            await wait(
              FALL_VISUAL_MS,
            );
          }


          /*
           * Engine automatically shuffles a dead board.
           */
          if (
            resolution
              .result
              .shuffled
          ) {

            currentVisualState = {
              ...currentVisualState,

              board:
                resolution
                  .result
                  .state
                  .board,
            };


            setVisualGameState(
              currentVisualState,
            );


            setVisualState({
              phase:
                "SHUFFLE",

              highlightedCells:
                [],

              blastCells:
                [],
            });


            playTone(
              680,
              "sine",
              0.08,
              0.22,
            );


            await wait(
              SHUFFLE_VISUAL_MS,
            );
          }


          /*
           * All visual phases are complete.
           *
           * Now publish the authoritative final run so:
           *
           * - moves update
           * - score updates
           * - objectives update
           * - level-clear settlement can begin
           */
          setRun(
            nextRun,
          );


          setVisualGameState(
            null,
          );


          setVisualState({
            phase:
              "IDLE",

            highlightedCells:
              [],

            blastCells:
              [],
          });


          /*
           * Save every successful discrete move immediately.
           *
           * Match-3 moves are much less frequent than a
           * fixed-tick arcade loop, so this is cheap and gives
           * exact app-close resume behavior.
           *
           * localStorage only:
           * zero Firebase gameplay writes.
           */
          persistRun(
            nextRun,
          );


          if (
            resolution
              .result
              .levelCleared
          ) {

            playGameSound(
              "game-complete",
            );

          } else if (
            resolution
              .result
              .gameOver
          ) {

            playGameSound(
              "game-failed",
            );
          }

        } finally {

          setBusySwap(
            false,
          );
        }
      },
      [
        busySwap,
        continuing,
        settling,
        persistRun,
      ],
    );


/*
 * ==========================================================
 * REWARDED-AD +5 MOVE CONTINUE
 * ==========================================================
 */

  const handleContinue =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          continuing ||
          settling ||
          busySwap ||
          !canCandyCascadeContinue(
            current.gameState,
          )
        ) {
          return;
        }


        const runId =
          current.runId;


        setContinuing(
          true,
        );


        setHint(
          null,
        );


        try {

          /*
           * Exactly one +5-move continue per run.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to continue with 5 extra moves.",
              "info",
            );


            return;
          }


          const latest =
            runRef.current;


          /*
           * Re-check after returning from the native ad.
           */
          if (
            !latest ||
            latest.runId !==
              runId ||
            !canCandyCascadeContinue(
              latest.gameState,
            )
          ) {
            return;
          }


          const afterMoveIndex =
            latest
              .gameState
              .movesUsed;


          const continued =
            applyCandyCascadeContinue(
              latest.gameState,
              CANDY_CASCADE_EXTRA_MOVES,
            );


          if (
            !continued.accepted
          ) {
            return;
          }


          /*
           * CONTINUE is part of deterministic replay.
           *
           * afterMoveIndex must equal the number of accepted
           * swaps already replayed by the server.
           */
          let nextRun =
            appendCandyCascadeContinueEvent(
              latest,
              {
                type:
                  "CONTINUE",

                afterMoveIndex,

                movesGranted:
                  CANDY_CASCADE_EXTRA_MOVES,
              },
            );


          nextRun =
            updateCandyCascadeRunState(
              nextRun,
              continued.state,
            );


          runRef.current =
            nextRun;


          setRun(
            nextRun,
          );


          persistRun(
            nextRun,
          );


          setSettlementError(
            null,
          );


          setVisualState({
            phase:
              "IDLE",

            highlightedCells:
              [],

            blastCells:
              [],
          });


          playTone(
            760,
            "triangle",
            0.14,
            0.30,
          );


          addToast(
            `${CANDY_CASCADE_EXTRA_MOVES} extra moves added!`,
            "success",
          );

        } finally {

          setContinuing(
            false,
          );
        }
      },
      [
        continuing,
        settling,
        busySwap,
        addToast,
        persistRun,
      ],
    );


/*
 * ==========================================================
 * DISCARD FAILED RUN
 * ==========================================================
 */

  const discardFailedRun =
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
         * Never allow the user to accidentally throw away
         * a completed run that still needs server settlement.
         */
        if (
          hasPendingCandyCascadeSettlement(
            current,
          )
        ) {

          addToast(
            "Verify your completed Candy Cascade reward first.",
            "info",
          );


          return;
        }


        if (
          !canDiscardCandyCascadeRun(
            current,
          )
        ) {

          addToast(
            "This Candy Cascade run is still active.",
            "info",
          );


          return;
        }


        if (
          currentUser
        ) {

          clearCandyCascadeRun(
            currentUser.id,
          );
        }


        runRef.current =
          null;


        setRun(
          null,
        );


        setHint(
          null,
        );


        setSettlementError(
          null,
        );


        setSettlementResult(
          null,
        );


        setVisualState({
          phase:
            "IDLE",

          highlightedCells:
            [],

          blastCells:
            [],
        });


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
 * ==========================================================
 * VERIFIED LEVEL SETTLEMENT
 * ==========================================================
 *
 * Candy Cascade differs from Brick Breaker:
 *
 * There is only ONE backend settlement.
 *
 * Successful verified level:
 *
 * ₹0.05
 * +
 * 10 diamonds
 * +
 * verified stars
 * +
 * next-level unlock
 *
 * Client score / stars / board are never authoritative.
 */

  const settleCompletedRun =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !currentUser ||
          !current ||
          !current.gameState.isLevelCleared ||
          isCandyCascadeRunFullySettled(
            current,
          ) ||
          settling ||
          settlementInFlightRef.current
        ) {
          return;
        }


        settlementInFlightRef.current =
          true;


        setSettling(
          true,
        );


        setSettlementError(
          null,
        );


        try {

          /*
           * Only deterministic player events are sent.
           *
           * We do NOT send:
           *
           * - score as authority
           * - stars as authority
           * - board
           * - objective progress
           * - moves remaining
           *
           * Backend reconstructs all of those itself.
           */
          const events =
            getCandyCascadeEventsForVerification(
              current,
            );


          /*
           * Backend currently caps elapsed time at 24 hours.
           */
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
              .completeCandyCascadeRun({
                runId:
                  current.runId,

                level:
                  current.level,

                seed:
                  current.seed,

                events,

                elapsedSeconds,
              });


          setSettlementResult(
            result,
          );


          /*
           * ==================================================
           * MARK LOCAL RUN SETTLED
           * ==================================================
           */

          const latest =
            runRef.current;


          if (
            latest &&
            latest.runId ===
              current.runId
          ) {

            const settledRun:
              SavedGenZCandyCascadeRun = {
              ...latest,

              rewardClaimed:
                true,

              levelClearVerified:
                true,

              updatedAt:
                Date.now(),
            };


            runRef.current =
              settledRun;


            setRun(
              settledRun,
            );


            /*
             * A completely verified run no longer needs
             * app-restart restoration.
             *
             * Keep it only in React state while the result
             * screen remains visible.
             */
            persistRun(
              null,
            );
          }


          /*
           * ==================================================
           * LOCAL UI PROGRESS
           * ==================================================
           *
           * Server response is authoritative.
           *
           * localStorage is only used to make the world/level
           * screen open instantly between summary refreshes.
           */

          const verifiedProgress =
            applyVerifiedCandyCascadeProgress(
              progress,
              current.level,
              result.score,
              result.stars,
            );


          /*
           * After a successful clear, point the local selector
           * toward the next server-unlocked level.
           *
           * Final level stays selected at the final level.
           */
          const selectedLevel =
            Math.min(
              result.highestUnlockedLevel,

              current.level <
                CANDY_CASCADE_MAX_LEVEL
                ? current.level +
                    1
                : current.level,
            );


          const selectedProgress =
            selectCandyCascadeLevel(
              verifiedProgress,
              selectedLevel,
            );


          persistProgress(
            selectedProgress,
          );


          /*
           * ==================================================
           * DIAMOND FLY
           * ==================================================
           */

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
           * UPDATE SHARED GENZGAMES SUMMARY
           * ==================================================
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
              ...currentSummary
                .diamonds,

              dayKey:
                result
                  .diamondDayKey,

              today:
                result
                  .todayDiamonds,

              lifetime:
                result
                  .lifetimeDiamonds,

              /*
               * New day:
               *
               * all old per-game daily counters reset
               * logically to zero.
               */
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
                sameDiamondDay
                  ? currentSummary
                      .diamonds
                      .brickBreakerToday
                  : 0,

              candyCascadeToday:
                (
                  sameDiamondDay
                    ? currentSummary
                        .diamonds
                        .candyCascadeToday
                    : 0
                ) +
                result
                  .diamondsGranted,
            },

            candyCascade: {
              ...currentSummary
                .candyCascade,

              highestUnlockedLevel:
                result
                  .highestUnlockedLevel,

              highestLevelCleared:
                result
                  .highestLevelCleared,

              completedRuns:
                result
                  .completedRuns,

              bestScore:
                result
                  .bestScore,

              totalStars:
                result
                  .totalStars,

              levelStars:
                result
                  .levelStars,
            },
          };


          publishSummary(
            nextSummary,
          );


          /*
           * ==================================================
           * SUCCESS MESSAGE
           * ==================================================
           */

          if (
            result.rewardGranted
          ) {

            addToast(
              `${formatGamePaise(
                result.rewardPaise,
              )} + ${result.diamondsGranted} diamonds earned!`,
              "success",
            );

          } else {

            /*
             * Duplicate callable retry is safe/idempotent.
             */
            addToast(
              "This Candy Cascade run was already verified.",
              "info",
            );
          }


        } catch (
          error
        ) {

          console.error(
            "Unable to verify Candy Cascade completion:",
            error,
          );


          setSettlementError(
            "Reward verification failed. Your completed run is saved and can be retried.",
          );


          /*
           * Preserve the completed deterministic history.
           *
           * User can close/reopen the app and retry without
           * replaying the level or watching another start ad.
           */
          const latest =
            runRef.current;


          if (
            latest
          ) {

            persistRun(
              latest,
            );
          }


          addToast(
            "Candy Cascade reward verification failed.",
            "error",
          );

        } finally {

          settlementInFlightRef.current =
            false;


          setSettling(
            false,
          );
        }
      },
      [
        currentUser,
        settling,
        progress,
        persistProgress,
        persistRun,
        publishSummary,
        addToast,
      ],
    );


/*
 * ==========================================================
 * AUTO-SETTLE COMPLETED LEVEL
 * ==========================================================
 *
 * As soon as deterministic gameplay reports all objectives
 * complete, send the run to the backend.
 *
 * If verification fails we stop auto-retrying so we do not
 * repeatedly hit Firebase.
 *
 * The result UI provides a manual retry button.
 */

  useEffect(
    () => {

      if (
        !run ||
        !run.gameState.isLevelCleared ||
        isCandyCascadeRunFullySettled(
          run,
        ) ||
        settling ||
        settlementError
      ) {
        return;
      }


      void settleCompletedRun();

    },
    [
      run,
      settling,
      settlementError,
      settleCompletedRun,
    ],
  );


/*
 * ==========================================================
 * MANUAL SETTLEMENT RETRY
 * ==========================================================
 */

  const retrySettlement =
    useCallback(
      () => {

        if (
          settling
        ) {
          return;
        }


        setSettlementError(
          null,
        );


        void settleCompletedRun();
      },
      [
        settling,
        settleCompletedRun,
      ],
    );


/*
 * ==========================================================
 * RESULT ACTION - NEXT LEVEL
 * ==========================================================
 */

  const playNextLevel =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          !isCandyCascadeRunFullySettled(
            current,
          )
        ) {
          return;
        }


        const nextLevel =
          Math.min(
            CANDY_CASCADE_MAX_LEVEL,

            current.level +
              1,
          );


        /*
         * Final level has no next level.
         */
        if (
          current.level >=
          CANDY_CASCADE_MAX_LEVEL
        ) {

          addToast(
            `All ${CANDY_CASCADE_MAX_LEVEL} Candy Cascade levels cleared! You can replay unlocked levels and keep earning.`,
            "success",
          );


          goToLevels();


          return;
        }


        /*
         * The backend must have actually unlocked it.
         */
        if (
          nextLevel >
          highestUnlockedLevel
        ) {

          goToLevels();


          return;
        }


        void startLevel(
          nextLevel,
        );
      },
      [
        highestUnlockedLevel,
        startLevel,
        addToast,
        goToLevels,
      ],
    );


/*
 * ==========================================================
 * RESULT ACTION - REPLAY LEVEL
 * ==========================================================
 */

  const replayCurrentLevel =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current ||
          !isCandyCascadeRunFullySettled(
            current,
          )
        ) {
          return;
        }


        /*
         * Replay is another reward-eligible run,
         * therefore startLevel() requires a fresh rewarded ad.
         */
        void startLevel(
          current.level,
        );
      },
      [
        startLevel,
      ],
    );


/*
 * ==========================================================
 * RESULT ACTION - RETURN TO MAP
 * ==========================================================
 */

  const returnToMap =
    useCallback(
      () => {

        setHint(
          null,
        );


        setVisualState({
          phase:
            "IDLE",

          highlightedCells:
            [],

          blastCells:
            [],
        });


        setScreen(
          "levels",
        );
      },
      [],
    );


/*
 * ==========================================================
 * DIAMOND FLY
 * ==========================================================
 */

  const diamondFly =
    showDiamondFly &&
    settlementResult &&
    settlementResult.diamondsGranted >
      0
      ? (
          <DiamondFlyReward
            amount={
              settlementResult
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
 * ==========================================================
 * RESULT DERIVED VALUES
 * ==========================================================
 */

  const settled =
    Boolean(
      run &&
      isCandyCascadeRunFullySettled(
        run,
      ),
    );


  const displayStars =
    settlementResult
      ?.stars ??
    (
      run
        ? getLevelStars(
            serverLevelStars,
            run.level,
          )
        : 0
    );


  const resultRewardText =
    settlementResult
      ? `${formatGamePaise(
          settlementResult.rewardPaise,
        )} + ${settlementResult.diamondsGranted} diamonds`
      : `${formatGamePaise(
          CANDY_CASCADE_REWARD_PAISE,
        )} + ${CANDY_CASCADE_DIAMOND_REWARD} diamonds`;


/*
 * ==========================================================
 * STAR DISPLAY HELPER
 * ==========================================================
 */

  const renderStars =
    (
      count:
        number,

      sizeClass =
        "h-4 w-4",
    ) => {

      return (
        <div
          className="
            flex
            items-center
            justify-center
            gap-0.5
          "
        >
          {[
            1,
            2,
            3,
          ].map(
            star => {

              const earned =
                star <=
                count;


              return (
                <Star
                  key={
                    star
                  }
                  className={`
                    ${sizeClass}
                    ${
                      earned
                        ? "fill-amber-400 text-amber-400"
                        : "fill-slate-200 text-slate-300"
                    }
                  `}
                />
              );
            },
          )}
        </div>
      );
    };


/*
 * ==========================================================
 * LEVEL / WORLD MAP DATA
 * ==========================================================
 */

  const worldSections =
    useMemo(
      () =>
        CANDY_CASCADE_WORLD_NAMES.map(
          (
            name,
            index,
          ) => {

            const startLevel =
              index *
                CANDY_CASCADE_LEVELS_PER_WORLD +
              1;


            const endLevel =
              Math.min(
                CANDY_CASCADE_MAX_LEVEL,

                startLevel +
                  CANDY_CASCADE_LEVELS_PER_WORLD -
                  1,
              );


            return {
              world:
                index +
                1,

              name,

              startLevel,

              endLevel,

              levels:
                Array.from(
                  {
                    length:
                      endLevel -
                      startLevel +
                      1,
                  },

                  (
                    _,
                    levelIndex,
                  ) =>
                    startLevel +
                    levelIndex,
                ),
            };
          },
        ),
      [],
    );


  const visibleWorldSections =
    useMemo(
      () => {

        const startWorldIndex =
          worldPage *
          CANDY_CASCADE_WORLDS_PER_PAGE;


        return worldSections.slice(
          startWorldIndex,

          startWorldIndex +
            CANDY_CASCADE_WORLDS_PER_PAGE,
        );
      },
      [
        worldPage,
        worldSections,
      ],
    );


/*
 * ==========================================================
 * LIVE STAR PREVIEW
 * ==========================================================
 *
 * We derive the numeric threshold values without coupling the
 * page to the property names inside the threshold object.
 */

  const currentStarThresholdValues =
    useMemo(
      () =>
        Object.values(
          currentStarThresholds,
        )
          .filter(
            (
              value,
            ):
              value is number =>
              typeof value ===
              "number" &&
              Number.isFinite(
                value,
              ),
          )
          .sort(
            (
              first,
              second,
            ) =>
              first -
              second,
          ),
      [
        currentStarThresholds,
      ],
    );


  const liveStars =
    gameState
      ? currentStarThresholdValues.reduce(
          (
            count,
            threshold,
          ) =>
            gameState.score >=
            threshold
              ? count +
                  1
              : count,

          0,
        )
      : 0;


/*
 * ==========================================================
 * LEVEL / WORLD MAP SCREEN
 * ==========================================================
 */

  if (
    screen ===
    "levels"
  ) {

    const hasSavedRun =
      Boolean(
        run &&
        !isCandyCascadeRunFullySettled(
          run,
        ),
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
              "calc(env(safe-area-inset-top) + 8px)",

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
                z-30
                -mx-1
                flex
                items-center
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
                    19
                  }
                />
              </button>


              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <div
                  className="
                    text-[8px]
                    font-black
                    uppercase
                    tracking-[0.16em]
                    text-orange-500
                  "
                >
                  GenZGames
                </div>

                <h1
                  className="
                    truncate
                    text-sm
                    font-black
                    min-[390px]:text-base
                  "
                >
                  Candy Cascade
                </h1>
              </div>


              {/*
               * CASH BALANCE
               */}

              <div
                className="
                  app-surface
                  app-border
                  flex
                  h-11
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-2xl
                  border
                  px-2.5
                "
              >
                <WalletCards
                  size={
                    15
                  }
                  className="
                    text-emerald-500
                  "
                />

                <div
                  className="
                    leading-none
                  "
                >
                  <div
                    className="
                      app-text-muted
                      hidden
                      text-[6px]
                      font-black
                      uppercase
                      min-[370px]:block
                    "
                  >
                    Cash
                  </div>

                  <div
                    className="
                      text-[10px]
                      font-black
                      min-[390px]:text-xs
                    "
                  >
                    {formatGamePaise(
                      currentWalletPaise,
                    )}
                  </div>
                </div>
              </div>


              {/*
               * DAILY DIAMONDS
               */}

              <DiamondCounter
                compact
                diamonds={
                  currentDiamonds
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
                border-fuchsia-500/20
                bg-gradient-to-br
                from-fuchsia-500/15
                via-violet-500/10
                to-cyan-500/5
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
                    bg-gradient-to-br
                    from-fuchsia-500
                    to-violet-600
                    text-3xl
                    shadow-lg
                    shadow-fuchsia-500/20
                  "
                >
                  🍬
                </div>


                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-1.5
                    "
                  >
                    <Sparkles
                      size={
                        14
                      }
                      className="
                        text-fuchsia-500
                      "
                    />

                    <span
                      className="
                        text-[9px]
                        font-black
                        uppercase
                        tracking-[0.12em]
                        text-fuchsia-500
                      "
                    >
                      Match • Cascade • Earn
                    </span>
                  </div>


                  <h2
                    className="
                      mt-1
                      text-xl
                      font-black
                    "
                  >
                    Candy Cascade
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
                    Match pieces, create powerful specials,
                    clear every objective and unlock all
                    {CANDY_CASCADE_MAX_LEVEL} levels across{" "}
                    {CANDY_CASCADE_WORLD_NAMES.length} worlds.
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
                      text-[8px]
                      font-black
                      uppercase
                      tracking-[0.12em]
                    "
                  >
                    Level Reward
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    {formatGamePaise(
                      CANDY_CASCADE_REWARD_PAISE,
                    )} + {CANDY_CASCADE_DIAMOND_REWARD}💎
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
                      tracking-[0.12em]
                    "
                  >
                    Unlocked
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    {highestUnlockedLevel} / {CANDY_CASCADE_MAX_LEVEL}
                  </div>
                </div>
              </div>


              <div
                className="
                  app-text-muted
                  mt-3
                  text-[9px]
                  font-semibold
                  leading-4
                "
              >
                Every new or replay run starts after a rewarded
                ad. One failed run can use one rewarded ad for
                +{CANDY_CASCADE_EXTRA_MOVES} moves.
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
                      flex-1
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
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


                      {run.gameState.isLevelCleared && (
                        <span
                          className="
                            rounded-full
                            bg-emerald-500/10
                            px-2
                            py-0.5
                            text-[7px]
                            font-black
                            uppercase
                            text-emerald-500
                          "
                        >
                          Cleared
                        </span>
                      )}
                    </div>


                    <div
                      className="
                        app-text-muted
                        mt-1
                        text-[10px]
                        font-semibold
                        leading-4
                      "
                    >
                      {run.gameState.isLevelCleared
                        ? "Reward verification pending"
                        : run.gameState.isGameOver
                          ? canCandyCascadeContinue(
                              run.gameState,
                            )
                            ? `Out of moves • +${CANDY_CASCADE_EXTRA_MOVES} move continue available`
                            : "Run ended • progress saved"
                          : `${getCandyCascadeProgressPercent(
                              run.gameState,
                            )}% objectives • ${run.gameState.movesRemaining} moves left`}
                    </div>
                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      void resumeSavedRun()
                    }
                    className="
                      flex
                      shrink-0
                      items-center
                      gap-1.5
                      rounded-2xl
                      bg-fuchsia-500
                      px-4
                      py-2.5
                      text-xs
                      font-black
                      text-white
                      shadow-md
                      shadow-fuchsia-500/20
                    "
                  >
                    <Play
                      size={
                        14
                      }
                      fill="currentColor"
                    />

                    Resume
                  </button>
                </div>


                {canDiscardCandyCascadeRun(
                  run,
                ) &&
                  !hasPendingCandyCascadeSettlement(
                    run,
                  ) && (
                  <button
                    type="button"
                    onClick={
                      discardFailedRun
                    }
                    className="
                      app-text-muted
                      mt-3
                      text-[9px]
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
                  size={
                    17
                  }
                  className="
                    mx-auto
                    text-amber-500
                  "
                />

                <div
                  className="
                    mt-1
                    truncate
                    text-sm
                    font-black
                  "
                >
                  {serverBestScore}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[7px]
                    font-black
                    uppercase
                  "
                >
                  Best Score
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
                <Star
                  size={
                    17
                  }
                  className="
                    mx-auto
                    fill-amber-400
                    text-amber-400
                  "
                />

                <div
                  className="
                    mt-1
                    text-sm
                    font-black
                  "
                >
                  {serverTotalStars}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[7px]
                    font-black
                    uppercase
                  "
                >
                  Stars
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
                  {highestLevelCleared}
                </div>

                <div
                  className="
                    app-text-muted
                    text-[7px]
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
             * WORLDS
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
                    Candy Worlds
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
                    text-[8px]
                    font-black
                    uppercase
                  "
                >
                  {CANDY_CASCADE_WORLD_NAMES.length} Worlds
                </div>
              </div>


              <div
                className="
                  mb-4
                  flex
                  gap-2
                  overflow-x-auto
                  pb-1
                "
              >
                {Array.from(
                  {
                    length:
                      CANDY_CASCADE_PAGE_COUNT,
                  },
                  (
                    _,
                    pageIndex,
                  ) => {

                    const startLevel =
                      pageIndex *
                        CANDY_CASCADE_LEVELS_PER_PAGE +
                      1;


                    const endLevel =
                      Math.min(
                        CANDY_CASCADE_MAX_LEVEL,

                        startLevel +
                          CANDY_CASCADE_LEVELS_PER_PAGE -
                          1,
                      );


                    const selected =
                      worldPage ===
                      pageIndex;


                    return (
                      <button
                        type="button"
                        key={
                          pageIndex
                        }
                        onClick={() =>
                          setWorldPage(
                            pageIndex,
                          )
                        }
                        className={`
                          shrink-0
                          rounded-xl
                          border
                          px-3
                          py-2
                          text-[9px]
                          font-black
                          transition
                          ${
                            selected
                              ? "border-fuchsia-500 bg-fuchsia-500 text-white"
                              : "app-border app-surface"
                          }
                        `}
                      >
                        {startLevel}–{endLevel}
                      </button>
                    );
                  },
                )}
              </div>


              <div
                className="
                  space-y-4
                "
              >
                {visibleWorldSections.map(
                  world => {

                    const worldUnlocked =
                      highestUnlockedLevel >=
                      world.startLevel;


                    const unlockedInWorld =
                      world.levels.filter(
                        level =>
                          level <=
                          highestUnlockedLevel,
                      ).length;


                    return (
                      <div
                        key={
                          world.world
                        }
                        className={`
                          app-surface
                          app-border
                          overflow-hidden
                          rounded-[26px]
                          border
                          ${
                            worldUnlocked
                              ? ""
                              : "opacity-60"
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-3
                            border-b
                            app-border
                            px-4
                            py-3
                          "
                        >
                          <div
                            className="
                              flex
                              min-w-0
                              items-center
                              gap-3
                            "
                          >
                            <div
                              className="
                                flex
                                h-10
                                w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-2xl
                                bg-gradient-to-br
                                from-fuchsia-500/20
                                to-violet-500/20
                                text-lg
                              "
                            >
                              {world.world === 1
                                ? "🍭"
                                : world.world === 2
                                  ? "🌸"
                                  : world.world === 3
                                    ? "🫧"
                                    : world.world === 4
                                      ? "🌈"
                                      : world.world === 5
                                        ? "✨"
                                        : world.world === 6
                                          ? "❄️"
                                          : world.world === 7
                                            ? "🪐"
                                            : world.world === 8
                                              ? "⚡"
                                              : world.world === 9
                                                ? "🌟"
                                                : "🏆"}
                            </div>


                            <div
                              className="
                                min-w-0
                              "
                            >
                              <div
                                className="
                                  app-text-muted
                                  text-[7px]
                                  font-black
                                  uppercase
                                  tracking-[0.12em]
                                "
                              >
                                World {world.world}
                              </div>

                              <div
                                className="
                                  truncate
                                  text-sm
                                  font-black
                                "
                              >
                                {world.name}
                              </div>
                            </div>
                          </div>


                          <div
                            className="
                              text-right
                            "
                          >
                            <div
                              className="
                                text-[9px]
                                font-black
                              "
                            >
                              {unlockedInWorld}/{world.levels.length}
                            </div>

                            <div
                              className="
                                app-text-muted
                                text-[7px]
                                font-bold
                              "
                            >
                              unlocked
                            </div>
                          </div>
                        </div>


                        <div
                          className="
                            grid
                            grid-cols-4
                            gap-2
                            p-3
                            min-[390px]:grid-cols-5
                          "
                        >
                          {world.levels.map(
                            level => {

                              const unlocked =
                                level <=
                                highestUnlockedLevel;


                              const stars =
                                getLevelStars(
                                  serverLevelStars,
                                  level,
                                );


                              const selected =
                                progress.selectedLevel ===
                                level;


                              const saved =
                                run?.level ===
                                  level &&
                                !isCandyCascadeRunFullySettled(
                                  run,
                                );


                              return (
                                <button
                                  type="button"
                                  key={
                                    level
                                  }
                                  disabled={
                                    !unlocked ||
                                    startingLevel !==
                                      null ||
                                    settling
                                  }
                                  onClick={() =>
                                    void startLevel(
                                      level,
                                    )
                                  }
                                  className={`
                                    relative
                                    flex
                                    aspect-square
                                    min-w-0
                                    flex-col
                                    items-center
                                    justify-center
                                    overflow-hidden
                                    rounded-2xl
                                    border
                                    text-xs
                                    font-black
                                    transition
                                    ${
                                      unlocked
                                        ? selected
                                          ? "border-fuchsia-500 bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20"
                                          : "app-border bg-fuchsia-500/5"
                                        : "app-border opacity-50"
                                    }
                                  `}
                                >
                                  {!unlocked
                                    ? (
                                        <Lock
                                          size={
                                            13
                                          }
                                        />
                                      )
                                    : (
                                        <>
                                          <span>
                                            {level}
                                          </span>


                                          <div
                                            className="
                                              mt-1
                                              flex
                                              gap-[1px]
                                            "
                                          >
                                            {[
                                              1,
                                              2,
                                              3,
                                            ].map(
                                              star => (
                                                <Star
                                                  key={
                                                    star
                                                  }
                                                  size={
                                                    7
                                                  }
                                                  className={
                                                    star <=
                                                    stars
                                                      ? "fill-amber-300 text-amber-300"
                                                      : "fill-current opacity-20"
                                                  }
                                                />
                                              ),
                                            )}
                                          </div>
                                        </>
                                      )}


                                  {saved && (
                                    <span
                                      className="
                                        absolute
                                        right-1
                                        top-1
                                        h-1.5
                                        w-1.5
                                        rounded-full
                                        bg-emerald-500
                                      "
                                    />
                                  )}


                                  {startingLevel ===
                                    level && (
                                    <span
                                      className="
                                        absolute
                                        inset-0
                                        flex
                                        items-center
                                        justify-center
                                        bg-black/55
                                        text-[7px]
                                        font-black
                                        uppercase
                                        text-white
                                      "
                                    >
                                      Starting
                                    </span>
                                  )}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }


/*
 * ==========================================================
 * GAME SCREEN SAFETY
 * ==========================================================
 */

  if (
    !run ||
    !gameState
  ) {

    return (
      <div
        className="
          app-bg
          app-text
          flex
          min-h-[100svh]
          items-center
          justify-center
          p-5
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
          "
        >
          <div
            className="
              text-3xl
            "
          >
            🍬
          </div>

          <div
            className="
              mt-2
              text-lg
              font-black
            "
          >
            No active run
          </div>

          <button
            type="button"
            onClick={
              goToLevels
            }
            className="
              mt-4
              w-full
              rounded-2xl
              bg-fuchsia-500
              py-3
              text-sm
              font-black
              text-white
            "
          >
            Back to Levels
          </button>
        </div>
      </div>
    );
  }


/*
 * ==========================================================
 * ACTIVE GAME SCREEN
 * ==========================================================
 */

  return (
    <>
      {diamondFly}


      <style>
        {`
          @keyframes genzCandyWrongShake {
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

          .genzCandyWrongAlert {
            animation:
              genzCandyWrongShake
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
                  0.28
                ),
              0 0 0 3px
                rgba(
                  239,
                  68,
                  68,
                  0.42
                ),
              0 0 30px
                rgba(
                  239,
                  68,
                  68,
                  0.28
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

          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >

        {/*
         * ===============================================
         * TOP BAR
         * ===============================================
         */}

        <div
          className="
            shrink-0
            px-2
            pb-1
            pt-2
          "
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-2xl
              items-center
              gap-1.5
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
              aria-label="Back to Candy Cascade levels"
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
                min-w-0
                flex-1
                rounded-xl
                border
                px-2.5
                py-1.5
              "
            >
              <div
                className="
                  truncate
                  text-[10px]
                  font-black
                "
              >
                Level {run.level} • {currentWorldName}
              </div>

              <div
                className="
                  app-text-muted
                  truncate
                  text-[7px]
                  font-bold
                "
              >
                World {String(
                  currentWorld,
                )} • {currentConfig.colors.length} colors
              </div>
            </div>


            {/*
             * CASH
             */}

            <div
              className="
                app-surface
                app-border
                flex
                h-10
                shrink-0
                items-center
                gap-1
                rounded-xl
                border
                px-2
              "
            >
              <WalletCards
                size={
                  13
                }
                className="
                  text-emerald-500
                "
              />

              <span
                className="
                  text-[9px]
                  font-black
                "
              >
                {formatGamePaise(
                  currentWalletPaise,
                )}
              </span>
            </div>


            <DiamondCounter
              compact
              diamonds={
                currentDiamonds
              }
            />
          </div>
        </div>


        {/*
         * ===============================================
         * GAME HUD
         * ===============================================
         */}

        <div
          className="
            shrink-0
            px-2
            pb-1.5
          "
        >
          <div
            className="
              mx-auto
              grid
              w-full
              max-w-2xl
              grid-cols-4
              overflow-hidden
              rounded-xl
              border
              app-border
              app-surface
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
                py-1.5
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
                Moves
              </span>

              <strong
                className={`
                  text-[12px]
                  ${
                    gameState.movesRemaining <=
                    5
                      ? "text-red-500"
                      : ""
                  }
                `}
              >
                {gameState.movesRemaining}
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
                py-1.5
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
                {gameState.score}
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
                py-1.5
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
                className="
                  text-[11px]
                  text-fuchsia-500
                "
              >
                {Math.round(
                  gameProgress,
                )}%
              </strong>
            </div>


            <div
              className="
                flex
                min-w-0
                flex-col
                items-center
                justify-center
                py-1
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
                Stars
              </span>

              {renderStars(
                liveStars,
                "h-3 w-3",
              )}
            </div>
          </div>


          {/*
           * OBJECTIVE PROGRESS BAR
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
              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-fuchsia-500
                to-violet-500
                transition-[width]
                duration-200
              "
              style={{
                width:
                  `${clamp(
                    gameProgress,
                    0,
                    100,
                  )}%`,
              }}
            />
          </div>
        </div>


        {/*
         * ===============================================
         * OBJECTIVES
         * ===============================================
         */}

        <div
          className="
            shrink-0
            px-2
            pb-1.5
          "
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-2xl
              gap-1.5
              overflow-x-auto
              pb-0.5
              scrollbar-none
            "
          >
            {gameState.objectiveProgress.map(
              (
                objective,
                index,
              ) => (
                <div
                  key={`${objective.type}-${index}`}
                  className={`
                    flex
                    shrink-0
                    items-center
                    gap-2
                    rounded-xl
                    border
                    px-2.5
                    py-1.5
                    text-[8px]
                    font-black
                    ${
                      objective.completed
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "app-surface app-border"
                    }
                  `}
                >
                  {getObjectiveVisual(
                    objective,
                  )}


                  <span>
                    {objective.completed
                      ? "✓ "
                      : ""}

                    {getObjectiveLabel(
                      objective,
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>


        {/*
         * ===============================================
         * RUN INFO
         * ===============================================
         */}

        <div
          className="
            shrink-0
            px-3
            pb-1.5
          "
        >
          <div
            className="
              app-text-muted
              mx-auto
              flex
              w-full
              max-w-2xl
              items-center
              justify-between
              gap-2
              text-[7px]
              font-bold
            "
          >
            <span>
              Start moves: {currentConfig.moves}
            </span>

            <span>
              Best: {serverBestScore}
            </span>

            <span>
              Reward: {formatGamePaise(
                CANDY_CASCADE_REWARD_PAISE,
              )} + {CANDY_CASCADE_DIAMOND_REWARD}💎
            </span>
          </div>
        </div>


        {/*
         * ===============================================
         * BOARD HOST
         * ===============================================
         */}

        <div
          className="
            relative
            min-h-0
            flex-1
            px-2
            pb-2
          "
        >
          <div
            className={`
              mx-auto
              h-full
              w-full
              max-w-2xl
              ${
                wrongMoveAlert
                  ? "genzCandyWrongAlert"
                  : ""
              }
            `}
          >
            <CandyCascadeBoard
              state={
                visualGameState ??
                gameState
              }
              disabled={
                gameState.isGameOver ||
                gameState.isLevelCleared ||
                settling ||
                continuing
              }
              busy={
                busySwap
              }
              hint={
                hint
              }
              visualState={
                visualState
              }
              onSwap={
                handleSwap
              }
            />
          </div>


          {/*
           * =============================================
           * SMALL STATUS CHIP
           * =============================================
           */}

          {(settling ||
            settlementError) &&
            gameState.isLevelCleared && (
            <div
              className="
                pointer-events-none
                absolute
                left-1/2
                top-2
                z-20
                -translate-x-1/2
                whitespace-nowrap
                rounded-full
                bg-black/75
                px-3
                py-1.5
                text-[8px]
                font-black
                text-white
                shadow-lg
                backdrop-blur
              "
            >
              {settling
                ? "Verifying reward..."
                : "Verification needs retry"}
            </div>
          )}


          {/*
           * =============================================
           * OUT OF MOVES
           * =============================================
           */}

          {gameState.isGameOver &&
            !gameState.isLevelCleared && (
            <div
              className="
                absolute
                inset-0
                z-30
                flex
                items-center
                justify-center
                overflow-y-auto
                bg-black/60
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
                  🍭
                </div>


                <h2
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  Out of Moves
                </h2>


                <p
                  className="
                    app-text-muted
                    mt-1
                    text-xs
                    leading-5
                  "
                >
                  You reached {Math.round(
                    gameProgress,
                  )}% of Level {run.level}&apos;s objectives.
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
                      bg-fuchsia-500/10
                      p-3
                    "
                  >
                    <div
                      className="
                        app-text-muted
                        text-[7px]
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
                      {gameState.score}
                    </div>
                  </div>


                  <div
                    className="
                      rounded-2xl
                      bg-amber-500/10
                      p-3
                    "
                  >
                    <div
                      className="
                        app-text-muted
                        text-[7px]
                        font-black
                        uppercase
                      "
                    >
                      Stars
                    </div>

                    <div
                      className="
                        mt-1
                      "
                    >
                      {renderStars(
                        liveStars,
                        "h-4 w-4",
                      )}
                    </div>
                  </div>
                </div>


                {continueAvailable
                  ? (
                      <>
                        <div
                          className="
                            mt-4
                            rounded-2xl
                            border
                            border-orange-500/20
                            bg-orange-500/10
                            p-3
                          "
                        >
                          <div
                            className="
                              text-xs
                              font-black
                              text-orange-500
                            "
                          >
                            One Continue Available
                          </div>

                          <div
                            className="
                              app-text-muted
                              mt-1
                              text-[9px]
                              font-semibold
                              leading-4
                            "
                          >
                            Watch one rewarded ad and receive
                            +{CANDY_CASCADE_EXTRA_MOVES} moves.
                            Your final level reward remains
                            {` ${formatGamePaise(
                              CANDY_CASCADE_REWARD_PAISE,
                            )} + ${CANDY_CASCADE_DIAMOND_REWARD} diamonds`}.
                          </div>
                        </div>


                        <button
                          type="button"
                          disabled={
                            continuing ||
                            settling
                          }
                          onClick={() =>
                            void handleContinue()
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
                            shadow-md
                            shadow-orange-500/20
                            disabled:opacity-50
                          "
                        >
                          <RefreshCw
                            size={
                              16
                            }
                            className={
                              continuing
                                ? "animate-spin"
                                : ""
                            }
                          />

                          {continuing
                            ? "Opening Ad..."
                            : `Watch Ad • +${CANDY_CASCADE_EXTRA_MOVES} Moves`}
                        </button>
                      </>
                    )
                  : (
                      <div
                        className="
                          mt-4
                          rounded-2xl
                          border
                          border-red-500/20
                          bg-red-500/10
                          p-3
                          text-[10px]
                          font-bold
                          text-red-500
                        "
                      >
                        The one extra-move continue for this run
                        has already been used.
                      </div>
                    )}


                <button
                  type="button"
                  disabled={
                    continuing
                  }
                  onClick={
                    discardFailedRun
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
                  End Run & Return to Levels
                </button>


                <div
                  className="
                    app-text-muted
                    mt-2
                    text-[8px]
                    font-semibold
                  "
                >
                  Failed attempts do not create a cash or diamond reward.
                </div>
              </div>
            </div>
          )}


          {/*
           * =============================================
           * LEVEL CLEAR / SETTLEMENT
           * =============================================
           */}

          {gameState.isLevelCleared && (
            <div
              className="
                absolute
                inset-0
                z-40
                flex
                items-center
                justify-center
                overflow-y-auto
                bg-black/60
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
                  rounded-[30px]
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
                  All objectives completed • Score {gameState.score}
                </p>


                {/*
                 * WAITING / VERIFYING
                 */}

                {settling && (
                  <div
                    className="
                      mt-5
                      flex
                      flex-col
                      items-center
                    "
                  >
                    <RefreshCw
                      size={
                        28
                      }
                      className="
                        animate-spin
                        text-fuchsia-500
                      "
                    />

                    <div
                      className="
                        mt-2
                        text-xs
                        font-black
                      "
                    >
                      Verifying gameplay...
                    </div>

                    <div
                      className="
                        app-text-muted
                        mt-1
                        text-[9px]
                        font-semibold
                      "
                    >
                      Backend is replaying your complete run.
                    </div>
                  </div>
                )}


                {/*
                 * VERIFICATION ERROR
                 */}

                {settlementError && (
                  <>
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-red-500/20
                        bg-red-500/10
                        p-3
                        text-[10px]
                        font-semibold
                        leading-4
                        text-red-500
                      "
                    >
                      {settlementError}
                    </div>


                    <button
                      type="button"
                      disabled={
                        settling
                      }
                      onClick={
                        retrySettlement
                      }
                      className="
                        mt-3
                        flex
                        w-full
                        items-center
                        justify-center
                        gap-2
                        rounded-2xl
                        bg-fuchsia-500
                        py-3
                        text-sm
                        font-black
                        text-white
                        disabled:opacity-50
                      "
                    >
                      <RefreshCw
                        size={
                          16
                        }
                      />

                      Retry Verification
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
                      Save & Return to Map
                    </button>
                  </>
                )}


                {/*
                 * VERIFIED RESULT
                 */}

                {settled &&
                  settlementResult && (
                  <>
                    <div
                      className="
                        mt-4
                        flex
                        justify-center
                      "
                    >
                      {renderStars(
                        displayStars,
                        "h-8 w-8",
                      )}
                    </div>


                    <div
                      className="
                        mt-4
                        rounded-[22px]
                        border
                        border-emerald-500/20
                        bg-emerald-500/10
                        p-4
                      "
                    >
                      <div
                        className="
                          text-[8px]
                          font-black
                          uppercase
                          tracking-[0.12em]
                          text-emerald-600
                          dark:text-emerald-400
                        "
                      >
                        Verified Reward
                      </div>


                      <div
                        className="
                          mt-1
                          text-lg
                          font-black
                          text-emerald-600
                          dark:text-emerald-400
                        "
                      >
                        {settlementResult.rewardGranted
                          ? resultRewardText
                          : "Already Verified"}
                      </div>


                      <div
                        className="
                          app-text-muted
                          mt-1
                          text-[9px]
                          font-semibold
                        "
                      >
                        Game Balance: {formatGamePaise(
                          currentWalletPaise,
                        )} • Today: {currentDiamonds}💎
                      </div>
                    </div>


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
                          rounded-2xl
                          bg-fuchsia-500/10
                          p-3
                        "
                      >
                        <div
                          className="
                            app-text-muted
                            text-[6px]
                            font-black
                            uppercase
                          "
                        >
                          Score
                        </div>

                        <div
                          className="
                            mt-1
                            text-xs
                            font-black
                          "
                        >
                          {settlementResult.score}
                        </div>
                      </div>


                      <div
                        className="
                          rounded-2xl
                          bg-amber-500/10
                          p-3
                        "
                      >
                        <div
                          className="
                            app-text-muted
                            text-[6px]
                            font-black
                            uppercase
                          "
                        >
                          Total Stars
                        </div>

                        <div
                          className="
                            mt-1
                            text-xs
                            font-black
                          "
                        >
                          {settlementResult.totalStars}
                        </div>
                      </div>


                      <div
                        className="
                          rounded-2xl
                          bg-cyan-500/10
                          p-3
                        "
                      >
                        <div
                          className="
                            app-text-muted
                            text-[6px]
                            font-black
                            uppercase
                          "
                        >
                          Moves
                        </div>

                        <div
                          className="
                            mt-1
                            text-xs
                            font-black
                          "
                        >
                          {settlementResult.movesUsed}
                        </div>
                      </div>
                    </div>


                    {settlementResult.nextUnlockedLevel !==
                      null && (
                      <div
                        className="
                          mt-3
                          rounded-2xl
                          bg-violet-500/10
                          px-3
                          py-2
                          text-[10px]
                          font-black
                          text-violet-600
                          dark:text-violet-400
                        "
                      >
                        🔓 Level {settlementResult.nextUnlockedLevel} unlocked
                      </div>
                    )}


                    {run.level <
                      CANDY_CASCADE_MAX_LEVEL && (
                      <button
                        type="button"
                        onClick={
                          playNextLevel
                        }
                        className="
                          mt-4
                          flex
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-fuchsia-500
                          py-3
                          text-sm
                          font-black
                          text-white
                          shadow-md
                          shadow-fuchsia-500/20
                        "
                      >
                        <Play
                          size={
                            16
                          }
                          fill="currentColor"
                        />

                        Next Level + Ad
                      </button>
                    )}


                    <button
                      type="button"
                      onClick={
                        replayCurrentLevel
                      }
                      className="
                        app-surface
                        app-border
                        mt-2
                        flex
                        w-full
                        items-center
                        justify-center
                        gap-2
                        rounded-2xl
                        border
                        py-3
                        text-xs
                        font-black
                      "
                    >
                      <RefreshCw
                        size={
                          15
                        }
                      />

                      Replay Level + Ad
                    </button>


                    <button
                      type="button"
                      onClick={
                        returnToMap
                      }
                      className="
                        app-text-muted
                        mt-3
                        text-[10px]
                        font-black
                        underline
                        underline-offset-2
                      "
                    >
                      Return to Candy Worlds
                    </button>
                  </>
                )}


                {/*
                 * Short gap before useEffect starts.
                 */}

                {!settling &&
                  !settlementError &&
                  !settled && (
                  <div
                    className="
                      app-text-muted
                      mt-4
                      text-[10px]
                      font-semibold
                    "
                  >
                    Preparing secure verification...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};


export default GenZCandyCascade;