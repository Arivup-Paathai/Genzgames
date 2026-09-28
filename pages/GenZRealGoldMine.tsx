import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Clock3,
  LoaderCircle,
  Play,
  Sparkles,
  WalletCards,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";

import type {
  GenZRealGoldMinerId,
  GenZRealGoldMinerSummary,
  GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  removeGenZGoldMineBanner,
  showGenZGoldMineBanner,
  showGenZGamesRewardedAd,
} from "../services/admob";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  playGameSound,
} from "../audioManager";

import {
  scheduleRealGoldMineReadyNotification,
} from "../services/miningNotifications";

import {
  DiamondCounter,
} from "../components/DiamondCounter";

import {
  DiamondFlyReward,
} from "../components/DiamondFlyReward";


interface GenZRealGoldMineProps {
  minerId:
    GenZRealGoldMinerId;

  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onBack: () => void;
}


const formatMineTime = (
  totalSeconds:
    number,
) => {
  const safe =
    Math.max(
      0,
      Math.floor(
        totalSeconds,
      ),
    );


  const minutes =
    Math.floor(
      safe /
      60,
    );

  const seconds =
    safe %
    60;


  return `${minutes}:${seconds
    .toString()
    .padStart(
      2,
      "0",
    )}`;
};


const formatGoldMg = (
  nanograms:
    number,
) => {
  const safeNanograms =
    Math.max(
      0,

      Math.floor(
        nanograms,
      ),
    );


  const milligrams =
    safeNanograms /
    1_000_000;


  return milligrams
    .toFixed(
      6,
    )
    .replace(
      /0+$/,
      "",
    )
    .replace(
      /\.$/,
      "",
    );
};


export const GenZRealGoldMine:
React.FC<
  GenZRealGoldMineProps
> = ({
  minerId,
  summary,
  onSummaryChange,
  onBack,
}) => {
  const {
    currentUser,
    addToast,
  } = useAuth();


  /*
   * Always open the individual Real Gold Miner
   * screen from the top.
   *
   * This resets the outer app/page scroll only.
   * The mineViewportRef camera positioning below
   * remains independent.
   */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;
  }, [
    minerId,
  ]);


  const [
    nowMillis,
    setNowMillis,
  ] = useState(
    Date.now(),
  );

  /*
 * Local clock anchor for the most recent
 * authoritative backend Gold Mine state.
 *
 * We never compare the user's absolute
 * phone clock with the server timestamp.
 */
const [
  mineSyncAnchorMillis,
  setMineSyncAnchorMillis,
] = useState(
  Date.now(),
);


  const [
    isStarting,
    setIsStarting,
  ] = useState(
    false,
  );


  const [
    isCollecting,
    setIsCollecting,
  ] = useState(
    false,
  );


  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(
    false,
  );

    const [
    diamondAnimation,
    setDiamondAnimation,
  ] =
    useState<
      {
        id:
          number;

        amount:
          number;
      } |
      null
    >(
      null,
    );


  const clearDiamondAnimation =
    useCallback(
      () => {
        setDiamondAnimation(
          null,
        );
      },
      [],
    );

/*
 * =====================================================
 * GOLD MINE GAME WORLD VIEWPORT
 * =====================================================
 *
 * The mine is intentionally larger than a phone screen.
 *
 * Mobile users can drag/swipe around the mine like a
 * game map.
 *
 * The HUD stays fixed while only the world moves.
 */
const mineViewportRef =
  useRef<HTMLDivElement | null>(
    null,
  );


const centerMineViewport =
  useCallback(
    () => {
      const viewport =
        mineViewportRef.current;


      if (!viewport) {
        return;
      }


      /*
       * =================================================
       * DEFAULT GOLD MINE CAMERA POSITION
       * =================================================
       *
       * Our world is:
       *
       * 1080 × 720
       *
       * Miner is around:
       *
       * x = 438 → 718
       * y = 275 → 465
       *
       * Gold rock is immediately to his right.
       *
       * So instead of centering the WHOLE world,
       * focus the initial camera directly between
       * the miner and Gold rock.
       */
      const focusX =
        620;

      const focusY =
        370;


      const maxScrollLeft =
        Math.max(
          0,

          viewport.scrollWidth -
            viewport.clientWidth,
        );


      const maxScrollTop =
        Math.max(
          0,

          viewport.scrollHeight -
            viewport.clientHeight,
        );


      const targetLeft =
        Math.min(
          maxScrollLeft,

          Math.max(
            0,

            focusX -
              viewport.clientWidth /
                2,
          ),
        );


      const targetTop =
        Math.min(
          maxScrollTop,

          Math.max(
            0,

            focusY -
              viewport.clientHeight /
                2,
          ),
        );


      /*
       * Opening position must appear immediately.
       *
       * Temporarily disable smooth scrolling so
       * the user does not see the camera sliding
       * from the left edge to the miner.
       */
      const previousScrollBehavior =
        viewport.style.scrollBehavior;


      viewport.style.scrollBehavior =
        "auto";


      viewport.scrollLeft =
        targetLeft;

      viewport.scrollTop =
        targetTop;


      window.requestAnimationFrame(
        () => {
          viewport.style.scrollBehavior =
            previousScrollBehavior;
        },
      );
    },
    [],
  );


useEffect(() => {
  /*
   * Android WebView can report the viewport
   * dimensions before the 1080 × 720 game
   * world has completely finished layout.
   *
   * First RAF:
   * component mounted.
   *
   * Second RAF:
   * world dimensions are available.
   */
  let secondFrame:
    number |
    null =
    null;


  const firstFrame =
    window.requestAnimationFrame(
      () => {
        secondFrame =
          window.requestAnimationFrame(
            centerMineViewport,
          );
      },
    );


  /*
   * Small fallback for slower Android devices.
   *
   * This does NOT cause Firebase/backend work.
   * It only corrects the local scroll position.
   */
  const settleTimer =
    window.setTimeout(
      () => {
        centerMineViewport();
      },
      120,
    );


  const handleResize = () => {
    window.requestAnimationFrame(
      centerMineViewport,
    );
  };


  window.addEventListener(
    "resize",
    handleResize,
  );


  return () => {
    window.cancelAnimationFrame(
      firstFrame,
    );


    if (
      secondFrame !==
      null
    ) {
      window.cancelAnimationFrame(
        secondFrame,
      );
    }


    window.clearTimeout(
      settleTimer,
    );


    window.removeEventListener(
      "resize",
      handleResize,
    );
  };
}, [
  centerMineViewport,
]);

  /*
   * =====================================================
   * AUTHORITATIVE REAL GOLD MINING STATE
   * =====================================================
   */

  const realGoldMine:
    GenZRealGoldMinerSummary |
    null =
    summary
      ?.realGold
      ?.miners
      ?.find(
        (
          miner,
        ) =>
          miner.minerId ===
          minerId,
      ) ??
    null;


  /*
   * Refresh from backend when necessary.
   *
   * This is NOT called every second.
   */
  const refreshSummary =
    useCallback(
      async () => {
        if (
          !currentUser
        ) {
          return null;
        }


        setIsRefreshing(
          true,
        );


        try {
          const result =
            await cloudflareR2
              .getGenZGamesSummary();


          onSummaryChange(
            result,
          );


          return result;
        } catch (error) {
          console.error(
            "Unable to refresh Real Gold Mining:",
            error,
          );


          return null;
        } finally {
          setIsRefreshing(
            false,
          );
        }
      },
      [
        currentUser,
        onSummaryChange,
      ],
    );


  /*
 * Refresh Real Gold Mine once whenever this
 * screen is opened.
 *
 * GenZGames may still hold a cached summary
 * from the previous visit, so always ask the
 * backend for the current authoritative
 * mining state.
 *
 * This is only one request when opening the
 * Real Gold Mine screen — never once per second.
 */
useEffect(() => {
  if (
    !currentUser
  ) {
    return;
  }


  void refreshSummary();
}, [
  currentUser,
  refreshSummary,
]);


  /*
   * =====================================================
   * ANDROID BACK
   * =====================================================
   */

  useEffect(() => {
    return registerNativeBackHandler(
      () => {
        onBack();
      },
    );
  }, [
    onBack,
  ]);


  /*
   * =====================================================
   * ADAPTIVE BANNER
   * =====================================================
   *
   * Banner exists only while Gold Mine
   * screen is actually open.
   */

  useEffect(() => {
    void showGenZGoldMineBanner();


    return () => {
      void removeGenZGoldMineBanner();
    };
  }, []);


  /*
   * =====================================================
   * LOCAL VISUAL TIMER
   * =====================================================
   *
   * Only React state changes once per second.
   *
   * NO Firestore read.
   * NO Firestore write.
   * NO Cloud Function call.
   */

  useEffect(() => {
    if (
      !realGoldMine ||
      realGoldMine.status ===
        "idle"
    ) {
      return;
    }


    const timer =
      window.setInterval(
        () => {
          setNowMillis(
            Date.now(),
          );
        },
        1000,
      );


    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    realGoldMine?.status,
    realGoldMine?.currentCycleId,
  ]);


  /*
 * =====================================================
 * BACKEND -> LOCAL TIMER SYNC
 * =====================================================
 *
 * Backend gives us the trusted elapsedSeconds.
 *
 * From that exact point onward the UI may
 * animate locally without another Firebase
 * request every second.
 *
 * This avoids depending on the user's
 * absolute phone clock.
 */
useEffect(() => {
  const now =
    Date.now();


  setMineSyncAnchorMillis(
    now,
  );

  setNowMillis(
    now,
  );
}, [
  realGoldMine?.currentCycleId,
  realGoldMine?.status,
  realGoldMine?.elapsedSeconds,
]);


  /*
   * =====================================================
   * DERIVED DISPLAY STATE
   * =====================================================
   */

  const cycleSeconds =
    realGoldMine
      ?.cycleSeconds ??
    900;


  const capacityOre =
    realGoldMine
      ?.capacityOre ??
    1500;


  const diamondsPerCollection =
    realGoldMine
      ?.diamondsPerCollection ??
    10;


  const elapsedSeconds =
  useMemo(
    () => {
      if (
        !realGoldMine ||
        realGoldMine.status ===
          "idle"
      ) {
        return 0;
      }


      /*
       * If backend already confirmed the
       * storage is full, trust it immediately.
       */
      if (
        realGoldMine.status ===
        "full"
      ) {
        return cycleSeconds;
      }


      const backendElapsed =
        Math.min(
          cycleSeconds,

          Math.max(
            0,
            realGoldMine
              .elapsedSeconds,
          ),
        );


      /*
       * Count only the amount of time that
       * passed on this device AFTER receiving
       * the backend state.
       *
       * A wrong phone date/time therefore
       * cannot make mining complete early.
       */
      const localElapsedSinceSync =
        Math.max(
          0,

          Math.floor(
            (
              nowMillis -
              mineSyncAnchorMillis
            ) /
            1000,
          ),
        );


      return Math.min(
        cycleSeconds,

        backendElapsed +
          localElapsedSinceSync,
      );
    },
    [
      realGoldMine?.status,
      realGoldMine?.elapsedSeconds,
      cycleSeconds,
      nowMillis,
      mineSyncAnchorMillis,
    ],
  );


  const remainingSeconds =
    Math.max(
      0,

      cycleSeconds -
        elapsedSeconds,
    );


  const orePerMinute =
    realGoldMine
      ?.orePerMinute ??
    100;


  const displayedOre =
    realGoldMine?.status ===
      "idle"
      ? 0
      : isNaN(
          elapsedSeconds,
        )
        ? 0
        : Math.min(
            capacityOre,

            elapsedSeconds >=
              cycleSeconds
              ? capacityOre
              : Math.floor(
                  (
                    elapsedSeconds *
                    orePerMinute
                  ) /
                    60,
                ),
          );


  const progress =
    Math.min(
      100,

      Math.max(
        0,

        (
          displayedOre /
          capacityOre
        ) *
          100,
      ),
    );


  const isFull =
    Boolean(
      realGoldMine &&
      (
        realGoldMine.status ===
          "full" ||
        (
          realGoldMine.status !==
            "idle" &&
          elapsedSeconds >=
            cycleSeconds
        )
      ),
    );


  const isMining =
    Boolean(
      realGoldMine &&
      realGoldMine.status !==
        "idle" &&
      !isFull,
    );


    const isIdle =
    !realGoldMine ||
    realGoldMine.status ===
      "idle";


  /*
   * =====================================================
   * LOCAL MINING IMPACT SOUND
   * =====================================================
   *
   * Visual mining animation:
   *
   * - one full swing = 900ms
   * - axe contacts rock around 55%
   * - 900ms × 55% ≈ 495ms
   *
   * This sound timer is completely local.
   *
   * NO Firebase read.
   * NO Firebase write.
   * NO backend call.
   */
  useEffect(() => {
    if (
      !isMining
    ) {
      return;
    }


    const playImpact = () => {
      if (
        document.hidden
      ) {
        return;
      }

      playGameSound(
        "mining-hit",
      );
    };


    const firstImpact =
      window.setTimeout(
        playImpact,
        495,
      );


    const impactInterval =
      window.setInterval(
        playImpact,
        900,
      );


    return () => {
      window.clearTimeout(
        firstImpact,
      );

      window.clearInterval(
        impactInterval,
      );
    };
  }, [
    isMining,
  ]);


 /*
  * =====================================================
  * START MINING
  * =====================================================
 *
 * Every new 15-minute mining cycle requires
 * one completed rewarded ad.
 *
 * Flow:
 *
 * Start Mining
 * -> show rewarded ad
 * -> user earns the ad reward
 * -> start backend mining cycle
 *
 * If the rewarded ad is closed early,
 * fails or is unavailable:
 *
 * -> do NOT start mining
 * -> user can retry
 *
 * This keeps every Real Gold reward cycle
 * tied to a completed rewarded ad.
 */

  const handleStartMining =
    async () => {
      if (
        !currentUser ||
        !isIdle ||
        isStarting ||
        isCollecting
      ) {
        return;
      }


      setIsStarting(
        true,
      );


      try {
        const adCompleted =
          await showGenZGamesRewardedAd();


        if (
          !adCompleted
        ) {
          addToast(
            "Complete the rewarded ad to start mining.",
            "info",
          );

          return;
        }


        const result =
          await cloudflareR2
            .startGenZRealGoldMine(
              minerId,
            );


        /*
         * One grouped local notification is used
         * for both Real Gold Miners.
         *
         * Starting another Real Gold Miner replaces
         * the previous pending reminder, so the user
         * receives only one Gold Mining notification.
         */
        const runningRealGoldMiners =
  result.miners
    .filter(
      (
        miner,
      ) =>
        miner.status !==
          "idle" &&
        miner.status !==
          "full" &&
        miner.remainingSeconds >
          0,
    );


const latestRealGoldRemainingSeconds =
  runningRealGoldMiners.reduce(
    (
      latest,
      miner,
    ) =>
      Math.max(
        latest,
        miner.remainingSeconds,
      ),
    0,
  );


if (
  latestRealGoldRemainingSeconds >
  0
) {

  void scheduleRealGoldMineReadyNotification(
    latestRealGoldRemainingSeconds,
  );
}


        const currentSummary =
          summary ??
          await cloudflareR2
            .getGenZGamesSummary();


        const nextSummary:
          GetGenZGamesSummaryResponse = {
            ...currentSummary,

            realGold: {
              ...currentSummary
                .realGold,

              miners:
                result
                  .miners,
            },
          };


        onSummaryChange(
          nextSummary,
        );


        setNowMillis(
          Date.now(),
        );


        if (
          result.startedNew
        ) {
          playGameSound(
            "mining-start",
          );

          addToast(
            "Real Gold Mining started. Your miner is working!",
            "success",
          );
        }
      } catch (error) {
        console.error(
          "Unable to start Real Gold Mining:",
          error,
        );


        addToast(
          "Unable to start Real Gold Mining. Please try again.",
          "error",
        );


        await refreshSummary();
      } finally {
        setIsStarting(
          false,
        );
      }
    };


  /*
   * =====================================================
   * COLLECT REAL GOLD
   * =====================================================
   */

  const handleCollect =
    async () => {
      if (
        !currentUser ||
        !isFull ||
        isCollecting ||
        isStarting
      ) {
        return;
      }


      setIsCollecting(
        true,
      );


      try {
        const result =
          await cloudflareR2
            .collectGenZRealGoldMine(
              minerId,
            );


        const currentSummary =
          summary ??
          await cloudflareR2
            .getGenZGamesSummary();


        const nextSummary:
          GetGenZGamesSummaryResponse = {
            ...currentSummary,

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

              sudokuToday:
                currentSummary
                  .diamonds
                  .dayKey ===
                result
                  .diamondDayKey
                  ? currentSummary
                      .diamonds
                      .sudokuToday
                  : 0,

              miningToday:
                (
                  currentSummary
                    .diamonds
                    .dayKey ===
                  result
                    .diamondDayKey
                    ? currentSummary
                        .diamonds
                        .miningToday
                    : 0
                ) +
                result
                  .diamondsGranted,

              referralToday:
                currentSummary
                  .diamonds
                  .dayKey ===
                result
                  .diamondDayKey
                  ? currentSummary
                      .diamonds
                      .referralToday
                  : 0,
            },

            realGold: {
              ...currentSummary
                .realGold,

              balanceNanograms:
                result
                  .balanceNanograms,

              lifetimeNanograms:
                result
                  .lifetimeNanograms,

              collectedCycles:
                result
                  .collectedCycles,

              miners:
                result
                  .miners,
            },
          };


        onSummaryChange(
          nextSummary,
        );


        setNowMillis(
          Date.now(),
        );


        if (
          result
            .diamondsGranted >
          0
        ) {
          setDiamondAnimation({
            id:
              Date.now(),

            amount:
              result
                .diamondsGranted,
          });
        }


        if (
          result
            .goldNanogramsGranted >
          0
        ) {
          playGameSound(
            "mining-collect",
          );

          addToast(
            `Gold Found +${formatGoldMg(
              result
                .goldNanogramsGranted,
            )} mg + ${result.diamondsGranted} 💎 collected.`,
            "success",
          );
        } else {
          addToast(
            "This Real Gold mining cycle was already collected.",
            "info",
          );
        }
      } catch (error) {
        console.error(
          "Unable to collect Real Gold Mining:",
          error,
        );


        addToast(
          "Gold is not ready to collect yet. Please try again.",
          "error",
        );


        await refreshSummary();
      } finally {
        setIsCollecting(
          false,
        );
      }
    };


  const goldBalanceNanograms =
    summary
      ?.realGold
      ?.balanceNanograms ??
    0;


  const collectedCycles =
    realGoldMine
      ?.collectedCycles ??
    0;


  return (
    <>

      {diamondAnimation && (
        <DiamondFlyReward
          key={
            diamondAnimation.id
          }
          amount={
            diamondAnimation.amount
          }
          onDone={
            clearDiamondAnimation
          }
        />
      )}


    <div
      className="
        min-h-full
        w-full
        bg-[var(--app-bg)]
        app-text
        pb-28
      "
      style={{
        paddingTop:
          "calc(env(safe-area-inset-top) + 8px)",
      }}
    >
      <div
        className="
          mx-auto
          w-full
          max-w-6xl
          px-4
          pb-5
          sm:px-6
        "
      >
        {/* Header */}
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
              flex
              items-center
              gap-3
              min-w-0
            "
          >
            <button
              type="button"
              onClick={
                onBack
              }
              className="
                w-10
                h-10
                shrink-0
                rounded-full
                app-surface
                border
                app-border
                flex
                items-center
                justify-center
              "
              aria-label="Back to GenZGames"
            >
              <ArrowLeft
                className="
                  w-5
                  h-5
                "
              />
            </button>


            <div
              className="
                min-w-0
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <h1
                  className="
                    text-xl
                    font-black
                    truncate
                  "
                >
                  Miner {
                    minerId
                  }
                </h1>


                <span
                  className="
                    shrink-0
                    rounded-full
                    bg-amber-400/15
                    px-2
                    py-0.5
                    text-[9px]
                    font-black
                    uppercase
                    text-amber-500
                  "
                >
                  Miner {
                    minerId
                  }
                </span>
              </div>


              <p
                className="
                  text-xs
                  app-text-muted
                "
              >
                Mine Gold Ore. Fill storage. Collect Gold.
              </p>
            </div>
          </div>


          <div className="flex items-center gap-2">

            <DiamondCounter
              compact
              diamonds={
                summary
                  ?.diamonds
                  .today ??
                0
              }
            />


            {isRefreshing && (
              <LoaderCircle
                className="
                  w-5
                  h-5
                  animate-spin
                  app-text-muted
                "
              />
            )}

          </div>
        </div>

{/* =====================================================
 * GENZ GOLD MINE GAME WORLD
 * =====================================================
 *
 * The world is larger than the phone viewport.
 *
 * User can swipe horizontally / vertically
 * around the mine.
 *
 * HUD remains fixed over the moving world.
 */}
<div
  className="
    relative
    mt-5
    w-full
    h-[clamp(460px,68svh,680px)]
    min-h-[460px]
    overflow-hidden
    rounded-[30px]
    border
    border-black/10
    bg-[#31552f]
    shadow-2xl
  "
>
  {/* ===================================================
   * MOVABLE GAME WORLD
   * ===================================================
   */}
  <div
    ref={
      mineViewportRef
    }
    className="
      genz-mine-viewport
      absolute
      inset-0
      z-10
      overflow-auto
      overscroll-contain
    "
    style={{
      touchAction:
        "pan-x pan-y",

      WebkitOverflowScrolling:
        "touch",
    }}
  >
    <div
      className="
        relative
        h-[720px]
        w-[1080px]
        min-w-[1080px]
        overflow-hidden
        bg-[#74A84B]
      "
    >
      {/* ===============================================
       * WORLD BACKGROUND
       * ===============================================
       */}
      <svg
        viewBox="0 0 1080 720"
        preserveAspectRatio="none"
        className="
          absolute
          inset-0
          h-full
          w-full
        "
        aria-hidden="true"
      >
        {/* Main grass */}
        <rect
          width="1080"
          height="720"
          fill="#75A94B"
        />


        {/* Lighter upper grass */}
        <path
          d="
            M0 0
            H1080
            V145
            C930 170 835 125 710 154
            C590 183 490 132 374 159
            C245 188 150 139 0 167
            Z
          "
          fill="#83B457"
        />


        {/* Darker lower grass */}
        <path
          d="
            M0 560
            C145 520 252 541 366 516
            C486 489 582 515 688 501
            C815 483 935 518 1080 475
            V720
            H0
            Z
          "
          fill="#638F3E"
        />


        {/* Main dirt mining zone */}
        <path
          d="
            M280 155
            C395 94 690 101 805 176
            C904 241 905 433 809 527
            C696 637 382 638 261 530
            C160 440 168 231 280 155
            Z
          "
          fill="#A4754B"
        />


        {/* Inner dirt */}
        <path
          d="
            M339 204
            C435 148 655 148 754 207
            C836 256 839 408 759 474
            C660 554 429 548 329 477
            C252 423 255 260 339 204
            Z
          "
          fill="#845838"
        />


        {/* Mine pit */}
        <ellipse
          cx="568"
          cy="355"
          rx="255"
          ry="181"
          fill="#47372D"
        />

        <ellipse
          cx="568"
          cy="358"
          rx="221"
          ry="151"
          fill="#29231F"
        />


        {/* Pit shadow */}
        <ellipse
          cx="568"
          cy="385"
          rx="176"
          ry="105"
          fill="#1F1A17"
        />


        {/* Road / dirt path */}
        <path
          d="
            M0 568
            C155 522 239 535 351 497
            C452 463 516 470 591 497
            C718 543 837 527 1080 453
            V720
            H0
            Z
          "
          fill="#B9824D"
        />


        {/* =============================================
         * MINE ENTRANCE
         * =============================================
         */}
        <path
          d="
            M792 198
            Q870 130 952 198
            L952 413
            L792 413
            Z
          "
          fill="#191919"
        />


        {/* Entrance inner darkness */}
        <path
          d="
            M817 218
            Q870 167 928 218
            L928 413
            L817 413
            Z
          "
          fill="#070707"
        />


        {/* Left wooden support */}
        <rect
          x="782"
          y="187"
          width="25"
          height="244"
          rx="5"
          fill="#74451F"
        />


        {/* Right wooden support */}
        <rect
          x="938"
          y="187"
          width="25"
          height="244"
          rx="5"
          fill="#74451F"
        />


        {/* Top wooden support */}
        <rect
          x="769"
          y="180"
          width="207"
          height="28"
          rx="6"
          fill="#8E572A"
        />


        {/* Wood highlights */}
        <line
          x1="788"
          y1="197"
          x2="800"
          y2="416"
          stroke="#9D6838"
          strokeWidth="5"
        />

        <line
          x1="946"
          y1="197"
          x2="954"
          y2="416"
          stroke="#9D6838"
          strokeWidth="5"
        />


        {/* =============================================
         * RAIL TRACK
         * =============================================
         */}
        <line
          x1="665"
          y1="519"
          x2="1041"
          y2="604"
          stroke="#383838"
          strokeWidth="8"
          strokeLinecap="round"
        />

        <line
          x1="657"
          y1="544"
          x2="1033"
          y2="629"
          stroke="#383838"
          strokeWidth="8"
          strokeLinecap="round"
        />


        {/* Rail sleepers */}
        <line
          x1="703"
          y1="515"
          x2="691"
          y2="563"
          stroke="#704321"
          strokeWidth="14"
        />

        <line
          x1="760"
          y1="529"
          x2="748"
          y2="576"
          stroke="#704321"
          strokeWidth="14"
        />

        <line
          x1="818"
          y1="542"
          x2="806"
          y2="590"
          stroke="#704321"
          strokeWidth="14"
        />

        <line
          x1="876"
          y1="555"
          x2="864"
          y2="603"
          stroke="#704321"
          strokeWidth="14"
        />

        <line
          x1="934"
          y1="569"
          x2="922"
          y2="616"
          stroke="#704321"
          strokeWidth="14"
        />


        {/* =============================================
         * LEFT ROCK CLUSTER
         * =============================================
         */}
        <ellipse
          cx="151"
          cy="271"
          rx="47"
          ry="34"
          fill="#67594B"
        />

        <ellipse
          cx="205"
          cy="299"
          rx="38"
          ry="27"
          fill="#756557"
        />

        <ellipse
          cx="172"
          cy="321"
          rx="31"
          ry="21"
          fill="#594E45"
        />


        {/* Small gold veins */}
        <path
          d="
            M143 254
            L160 247
            L170 261
            L154 270
            Z
          "
          fill="#F6C527"
        />

        <path
          d="
            M199 286
            L214 280
            L222 295
            L205 301
            Z
          "
          fill="#FBBF24"
        />


        {/* =============================================
         * MAIN GOLD DEPOSIT
         * =============================================
         */}
        <path
          d="
            M673 306
            L711 278
            L757 286
            L790 327
            L788 373
            L758 415
            L704 421
            L658 393
            L645 347
            Z
          "
          fill="#5B5047"
        />

        <path
          d="
            M689 317
            L712 296
            L734 305
            L728 331
            L704 341
            Z
          "
          fill="#FACC15"
        />

        <path
          d="
            M744 318
            L766 303
            L780 330
            L763 351
            L741 341
            Z
          "
          fill="#F59E0B"
        />

        <path
          d="
            M704 360
            L728 345
            L748 367
            L738 392
            L709 396
            L694 379
            Z
          "
          fill="#F8D238"
        />

        <path
          d="
            M760 379
            L779 367
            L786 390
            L770 405
            Z
          "
          fill="#FFB814"
        />


        {/* =============================================
         * DECORATIVE TREES
         * =============================================
         */}

        {/* Tree left */}
        <rect
          x="80"
          y="108"
          width="18"
          height="68"
          rx="5"
          fill="#6B431F"
        />

        <circle
          cx="89"
          cy="89"
          r="43"
          fill="#397932"
        />

        <circle
          cx="62"
          cy="107"
          r="28"
          fill="#43873A"
        />

        <circle
          cx="117"
          cy="107"
          r="30"
          fill="#4A913D"
        />


        {/* Tree right */}
        <rect
          x="1000"
          y="75"
          width="18"
          height="70"
          rx="5"
          fill="#6B431F"
        />

        <circle
          cx="1009"
          cy="60"
          r="40"
          fill="#397932"
        />

        <circle
          cx="984"
          cy="78"
          r="28"
          fill="#43873A"
        />

        <circle
          cx="1034"
          cy="82"
          r="29"
          fill="#4A913D"
        />


        {/* =============================================
         * RANDOM WORLD STONES
         * =============================================
         */}
        <ellipse
          cx="305"
          cy="113"
          rx="24"
          ry="15"
          fill="#6A665E"
        />

        <ellipse
          cx="360"
          cy="98"
          rx="18"
          ry="11"
          fill="#777169"
        />

        <ellipse
          cx="969"
          cy="482"
          rx="31"
          ry="19"
          fill="#655A50"
        />

        <ellipse
          cx="1009"
          cy="500"
          rx="20"
          ry="14"
          fill="#75675B"
        />
      </svg>


      {/* Decorative sparkles */}
      <Sparkles
        className="
          absolute
          left-[405px]
          top-[205px]
          h-5
          w-5
          text-amber-300
          drop-shadow
        "
      />

      <Sparkles
        className="
          absolute
          left-[745px]
          top-[273px]
          h-6
          w-6
          text-yellow-300
          drop-shadow
        "
      />


      {/* ===============================================
       * MINER
       * ===============================================
       */}
      <div
        className="
          absolute
          left-[438px]
          top-[275px]
          z-20
        "
      >
        <div
          className="
            relative
            h-[190px]
            w-[280px]
            select-none
          "
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 260 180"
            className="
              absolute
              inset-0
              h-full
              w-full
              overflow-visible
            "
          >
            {/* Miner ground */}
            <path
              d="
                M15 151
                C52 143 79 149 115 146
                C148 143 177 147 223 143
                L223 170
                L15 170
                Z
              "
              fill="#292524"
            />


            {/* Small mining rock */}
<g
  className={
    isMining
      ? "genz-hit-rock genz-hit-rock-active"
      : "genz-hit-rock"
  }
>
  <path
    d="
      M196 76
      C218 65 235 76 240 97
      C247 119 234 144 207 149
      L188 143
      C183 126 183 93 196 76
      Z
    "
    fill="#57534E"
  />

  <path
    d="
      M211 88
      L225 81
      L236 93
      L220 104
      Z
    "
    fill="#FBBF24"
  />

  <path
    d="
      M201 119
      L218 111
      L229 125
      L211 136
      Z
    "
    fill="#F59E0B"
  />
</g>


{/* Gold rock impact flash */}
<path
  className={
    isMining
      ? "genz-rock-flash genz-rock-flash-active"
      : "genz-rock-flash"
  }
  d="
    M196 76
    C218 65 235 76 240 97
    C247 119 234 144 207 149
    L188 143
    C183 126 183 93 196 76
    Z
  "
  fill="#FFEFA0"
/>


            {/* Ground gold */}
            <ellipse
              cx="190"
              cy="150"
              rx="11"
              ry="6"
              fill="#F59E0B"
            />

            <ellipse
              cx="211"
              cy="156"
              rx="8"
              ry="5"
              fill="#FBBF24"
            />


            {/* =========================================
             * MINER BODY
             * =========================================
             */}
            <g
  transform={
    isMining
      ? "translate(12 0) scale(0.90 1)"
      : undefined
  }
>
  <g
    className={
      isMining
        ? "genz-miner-body genz-miner-body-active"
        : "genz-miner-body"
    }
  >
              {/* Back leg */}
              <path
                d="
                  M92 124
                  L112 124
                  L109 157
                  L91 157
                  Z
                "
                fill="#1E3A5F"
              />


              {/* Front leg */}
              <path
                d="
                  M115 123
                  L134 124
                  L139 157
                  L120 157
                  Z
                "
                fill="#244B73"
              />


              {/* Boots */}
              <path
                d="
                  M87 154
                  L110 154
                  L113 164
                  L82 164
                  C82 158 84 156 87 154
                  Z
                "
                fill="#292524"
              />

              <path
                d="
                  M120 154
                  L141 154
                  L149 163
                  L119 163
                  Z
                "
                fill="#292524"
              />


              {/* Body / overalls */}
              <path
                d="
                  M88 84
                  Q108 75 129 85
                  L135 127
                  L87 127
                  Z
                "
                fill="#2563A6"
              />


              {/* Shirt */}
              <path
                d="
                  M88 87
                  Q108 77 127 87
                  L124 101
                  L92 101
                  Z
                "
                fill="#F97316"
              />


              {/* Overall bib */}
              <path
                d="
                  M97 92
                  L120 92
                  L125 119
                  L93 119
                  Z
                "
                fill="#1E4E79"
              />

              <path
                d="M96 87 L100 103"
                stroke="#163A5C"
                strokeWidth="4"
                strokeLinecap="round"
              />

              <path
                d="M119 87 L116 103"
                stroke="#163A5C"
                strokeWidth="4"
                strokeLinecap="round"
              />


             {/* Head / face */}
{isMining ? (
  <>
    {/*
     * SIDE VIEW:
     *
     * While mining, the miner turns
     * toward the rock instead of
     * looking at the player.
     */}
    <ellipse
      cx="113"
      cy="62"
      rx="19"
      ry="23"
      fill="#F2B184"
    />


    {/* Side ear */}
    <circle
      cx="98"
      cy="65"
      r="5"
      fill="#E79A6A"
    />


    {/* Side hair */}
    <path
      d="
        M96 57
        C96 40 105 35 118 39
        C126 42 130 48 130 56
        C121 50 109 49 96 57
        Z
      "
      fill="#3F2B20"
    />


    {/* Side helmet */}
    <path
      d="
        M92 52
        C93 34 102 24 115 24
        C130 24 139 35 140 52
        Z
      "
      fill="#F59E0B"
    />

    <rect
      x="90"
      y="49"
      width="53"
      height="8"
      rx="4"
      fill="#FBBF24"
    />

    <rect
      x="113"
      y="24"
      width="7"
      height="27"
      rx="3"
      fill="#FACC15"
    />


    {/* One visible side eye */}
    <circle
      cx="123"
      cy="61"
      r="2.3"
      fill="#292524"
    />


    {/* Nose pointing toward rock */}
    <path
      d="
        M130 62
        L137 67
        L130 70
      "
      fill="#E79A6A"
    />


    {/* Small working smile */}
    <path
      d="
        M120 74
        Q126 77 130 73
      "
      fill="none"
      stroke="#7C3F27"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
  </>
) : (
  <>
    {/*
     * FRONT VIEW:
     *
     * This is shown while the miner
     * is idle / waiting to start.
     */}
    <circle
      cx="107"
      cy="62"
      r="23"
      fill="#F2B184"
    />


    {/* Ear */}
    <circle
      cx="130"
      cy="65"
      r="5"
      fill="#E79A6A"
    />


    {/* Hair */}
    <path
      d="
        M89 57
        C91 40 102 35 116 39
        C124 41 128 47 129 55
        C119 49 106 48 89 57
        Z
      "
      fill="#3F2B20"
    />


    {/* Helmet */}
    <path
      d="
        M83 52
        C84 34 94 24 108 24
        C124 24 134 35 135 52
        Z
      "
      fill="#F59E0B"
    />

    <rect
      x="81"
      y="49"
      width="57"
      height="8"
      rx="4"
      fill="#FBBF24"
    />

    <rect
      x="105"
      y="24"
      width="7"
      height="27"
      rx="3"
      fill="#FACC15"
    />


    {/* Front face */}
    <circle
      cx="99"
      cy="62"
      r="2"
      fill="#292524"
    />

    <circle
      cx="116"
      cy="62"
      r="2"
      fill="#292524"
    />

    <path
      d="M101 72 Q108 78 116 71"
      fill="none"
      stroke="#7C3F27"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </>
)}


              {/* =========================================
 * BOTH HANDS + PICKAXE
 * =========================================
 *
 * Mining:
 * - rear arm bends toward lower grip
 * - front arm uses upper grip
 * - both hands move with the pickaxe
 *
 * Idle:
 * - keep the original relaxed pose
 */}
{isMining ? (
  <>
    {/*
     * Rear upper arm.
     *
     * This part stays connected to the
     * miner's shoulder.
     */}
    <path
      d="
        M96 91
        C104 92 113 92 121 88
      "
      fill="none"
      stroke="#F2B184"
      strokeWidth="10"
      strokeLinecap="round"
    />


    {/*
     * Both forearms + both hands +
     * pickaxe move as one unit.
     */}
    <g
      className="
        genz-miner-swing
        genz-miner-swing-active
      "
    >
      {/* Pickaxe wooden handle */}
      <line
        x1="145"
        y1="73"
        x2="202"
        y2="31"
        stroke="#8B5A2B"
        strokeWidth="8"
        strokeLinecap="round"
      />


      {/* Real mining pickaxe metal head */}
<g
  transform="
    translate(202 31)
    rotate(16)
  "
>
  {/*
   * Flat cutting/adze side.
   */}
  <path
    d="
      M0 -4
      C-9 -5 -18 -6 -28 -6
      L-42 -3
      L-42 4
      L-28 8
      C-18 7 -9 5 0 4
      Z
    "
    fill="#94A3B8"
  />


  {/*
   * Pointed pick side.
   */}
  <path
    d="
      M0 -4
      C12 -5 25 -3 38 1
      L48 4
      L38 7
      C25 6 12 5 0 4
      Z
    "
    fill="#64748B"
  />


  {/* Strong center socket */}
  <rect
    x="-5"
    y="-7"
    width="10"
    height="14"
    rx="3"
    fill="#475569"
  />


  {/* Small steel highlight */}
  <path
    d="
      M-34 -2
      C-22 -3 -12 -2 -3 0
    "
    fill="none"
    stroke="#CBD5E1"
    strokeWidth="2"
    strokeLinecap="round"
    opacity="0.65"
  />
</g>


      {/*
       * REAR ARM FOREARM
       *
       * Goes from the bent elbow to
       * the lower grip of the handle.
       */}
      <path
        d="
          M120 88
          C129 83 139 77 149 70
        "
        fill="none"
        stroke="#F2B184"
        strokeWidth="10"
        strokeLinecap="round"
      />


      {/* Rear hand gripping handle */}
      <circle
        cx="149"
        cy="70"
        r="5.8"
        fill="#F2B184"
      />


      {/*
       * FRONT ARM
       *
       * Upper hand grips slightly
       * higher on the same handle.
       */}
      <path
        d="
          M124 91
          C141 85 151 75 158 64
        "
        fill="none"
        stroke="#F2B184"
        strokeWidth="11"
        strokeLinecap="round"
      />


      {/* Front hand gripping handle */}
      <circle
        cx="158"
        cy="64"
        r="6"
        fill="#F2B184"
      />
    </g>
  </>
) : (
  <>
    {/*
     * IDLE REAR ARM
     *
     * Keep current relaxed front-facing pose.
     */}
    <path
      d="
        M93 92
        C78 104 78 119 89 128
      "
      fill="none"
      stroke="#F2B184"
      strokeWidth="10"
      strokeLinecap="round"
    />


    {/*
     * IDLE PICKAXE ARM
     */}
    <g
      className="
        genz-miner-swing
      "
    >
      {/* Pickaxe handle */}
      <line
        x1="151"
        y1="70"
        x2="202"
        y2="31"
        stroke="#8B5A2B"
        strokeWidth="8"
        strokeLinecap="round"
      />


      {/* Pickaxe metal */}
<g
  transform="
    translate(202 31)
    rotate(16)
  "
>
  {/*
   * Flat cutting/adze side.
   */}
  <path
    d="
      M0 -4
      C-9 -5 -18 -6 -28 -6
      L-42 -3
      L-42 4
      L-28 8
      C-18 7 -9 5 0 4
      Z
    "
    fill="#94A3B8"
  />


  {/*
   * Pointed pick side.
   */}
  <path
    d="
      M0 -4
      C12 -5 25 -3 38 1
      L48 4
      L38 7
      C25 6 12 5 0 4
      Z
    "
    fill="#64748B"
  />


  {/* Strong center socket */}
  <rect
    x="-5"
    y="-7"
    width="10"
    height="14"
    rx="3"
    fill="#475569"
  />


  {/* Small steel highlight */}
  <path
    d="
      M-34 -2
      C-22 -3 -12 -2 -3 0
    "
    fill="none"
    stroke="#CBD5E1"
    strokeWidth="2"
    strokeLinecap="round"
    opacity="0.65"
  />
</g>

      {/* Idle front arm */}
      <path
        d="
          M124 91
          C142 85 151 75 158 64
        "
        fill="none"
        stroke="#F2B184"
        strokeWidth="11"
        strokeLinecap="round"
      />


      {/* Idle hand */}
      <circle
        cx="158"
        cy="64"
        r="6"
        fill="#F2B184"
      />
    </g>
  </>
)}
            </g>
          </g>


            {/* Impact dust */}
            <g
              className={
                isMining
                  ? "genz-miner-dust genz-miner-dust-active"
                  : "genz-miner-dust"
              }
            >
              <circle
                cx="210"
                cy="84"
                r="5"
                fill="#D6D3D1"
              />

              <circle
                cx="222"
                cy="76"
                r="3.5"
                fill="#A8A29E"
              />

              <circle
                cx="225"
                cy="91"
                r="4"
                fill="#E7E5E4"
              />
            </g>


            {/* Gold impact */}
            <g
              className={
                isMining
                  ? "genz-gold-impact genz-gold-impact-active"
                  : "genz-gold-impact"
              }
            >
              <circle
                cx="211"
                cy="84"
                r="4"
                fill="#FACC15"
              />

              <circle
                cx="221"
                cy="89"
                r="3"
                fill="#F59E0B"
              />
            </g>
            {/* Flying gold chips */}
<g
  className={
    isMining
      ? "genz-gold-chips genz-gold-chips-active"
      : "genz-gold-chips"
  }
>
  <rect
    className="
      genz-gold-chip
      genz-gold-chip-1
    "
    x="215"
    y="85"
    width="5"
    height="5"
    rx="1"
    fill="#FFD83D"
  />

  <rect
    className="
      genz-gold-chip
      genz-gold-chip-2
    "
    x="219"
    y="88"
    width="4"
    height="4"
    rx="1"
    fill="#F59E0B"
  />

  <circle
    className="
      genz-gold-chip
      genz-gold-chip-3
    "
    cx="216"
    cy="91"
    r="2.8"
    fill="#FACC15"
  />

  <rect
    className="
      genz-gold-chip
      genz-gold-chip-4
    "
    x="223"
    y="84"
    width="4"
    height="6"
    rx="1"
    fill="#FFE66D"
  />

  <circle
    className="
      genz-gold-chip
      genz-gold-chip-5
    "
    cx="221"
    cy="94"
    r="2.4"
    fill="#FFB703"
  />
</g>
          </svg>
        </div>
      </div>


      {/* ===============================================
       * MINE CART
       * ===============================================
       */}
      <div
        className="
          absolute
          left-[748px]
          top-[491px]
          z-20
        "
        aria-hidden="true"
      >
        <svg
          width="150"
          height="105"
          viewBox="0 0 150 105"
        >
          {/* Cart */}
          <path
            d="
              M18 22
              H132
              L116 69
              H35
              Z
            "
            fill="#86532D"
            stroke="#4B2D18"
            strokeWidth="5"
          />

          <rect
            x="25"
            y="25"
            width="99"
            height="10"
            rx="3"
            fill="#AA6C39"
          />


          {/* Gold */}
          <circle
            cx="50"
            cy="19"
            r="12"
            fill="#F6C81B"
          />

          <circle
            cx="74"
            cy="14"
            r="14"
            fill="#FFD83D"
          />

          <circle
            cx="101"
            cy="20"
            r="12"
            fill="#F0B90B"
          />


          {/* Wheels */}
          <circle
            cx="48"
            cy="80"
            r="16"
            fill="#333333"
            stroke="#7C7C7C"
            strokeWidth="5"
          />

          <circle
            cx="103"
            cy="80"
            r="16"
            fill="#333333"
            stroke="#7C7C7C"
            strokeWidth="5"
          />

          <circle
            cx="48"
            cy="80"
            r="6"
            fill="#111111"
          />

          <circle
            cx="103"
            cy="80"
            r="6"
            fill="#111111"
          />
        </svg>
      </div>


      {/* ===============================================
       * SMALL WORLD DETAILS
       * ===============================================
       */}

      {/* Gold chunks */}
      <div
        className="
          absolute
          left-[391px]
          top-[456px]
          h-4
          w-7
          rotate-[-12deg]
          rounded-full
          bg-amber-400
          shadow
        "
      />

      <div
        className="
          absolute
          left-[425px]
          top-[470px]
          h-3
          w-5
          rotate-[16deg]
          rounded-full
          bg-yellow-300
          shadow
        "
      />


      {/* Lantern */}
      <div
        className="
          absolute
          left-[850px]
          top-[224px]
          z-20
          flex
          flex-col
          items-center
        "
        aria-hidden="true"
      >
        <div
          className="
            h-10
            w-[2px]
            bg-stone-700
          "
        />

        <div
          className="
            h-7
            w-6
            rounded-full
            border-2
            border-amber-600
            bg-yellow-300
            shadow-[0_0_25px_rgba(253,224,71,0.8)]
          "
        />
      </div>
    </div>
  </div>


  {/* ===================================================
   * FIXED GAME HUD
   * ===================================================
   *
   * These elements are OUTSIDE the scrollable world.
   *
   * They stay fixed while the user swipes the map.
   */}


  {/* Mining HUD - top left */}
  <div
    className="
      pointer-events-none
      absolute
      left-3
      top-3
      z-40
      w-[45%]
      max-w-[225px]
      rounded-2xl
      border
      border-white/20
      bg-black/70
      p-3
      text-white
      shadow-xl
      backdrop-blur-md
      sm:left-5
      sm:top-5
      sm:p-4
    "
  >
    <div
      className="
        flex
        items-start
        justify-between
        gap-2
      "
    >
      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            text-[8px]
            font-black
            uppercase
            tracking-[0.16em]
            text-white/55
            sm:text-[10px]
          "
        >
          Mining
        </p>

        <p
          className="
            truncate
            text-[11px]
            font-black
            sm:text-sm
          "
        >
          {
            isIdle
              ? "Ready"
              : isFull
                ? "Storage Full"
                : "Mining..."
          }
        </p>
      </div>


      <div
        className="
          flex
          shrink-0
          items-center
          gap-1
          text-[10px]
          font-black
          text-amber-300
          sm:text-xs
        "
      >
        <Clock3
          className="
            h-3.5
            w-3.5
          "
        />

        {
          isIdle
            ? "15:00"
            : isFull
              ? "0:00"
              : formatMineTime(
                  remainingSeconds,
                )
        }
      </div>
    </div>


    {/* HUD progress */}
    <div
      className="
        mt-2
        h-2.5
        overflow-hidden
        rounded-full
        bg-white/15
        sm:h-3
      "
    >
      <div
        className="
          h-full
          rounded-full
          bg-emerald-400
          transition-[width]
          duration-500
          ease-linear
        "
        style={{
          width:
            `${progress}%`,
        }}
      />
    </div>


    <div
      className="
        mt-1
        flex
        items-center
        justify-between
        gap-2
        text-[7px]
        font-bold
        text-white/55
        sm:text-[9px]
      "
    >
      <span>
        100 Gold Ore / min
      </span>

      <span>
        {
          Math.floor(
            progress,
          )
        }
        %
      </span>
    </div>
  </div>


  {/* Balance HUD - top right */}
  <div
    className="
      pointer-events-none
      absolute
      right-3
      top-3
      z-40
      w-[43%]
      max-w-[200px]
      rounded-2xl
      border
      border-amber-200/30
      bg-gradient-to-br
      from-[#FF4E00]/95
      via-orange-500/95
      to-amber-500/95
      p-3
      text-white
      shadow-xl
      backdrop-blur-md
      sm:right-5
      sm:top-5
      sm:p-4
    "
  >
    <div
      className="
        flex
        items-start
        justify-between
        gap-2
      "
    >
      <div>
        <p
          className="
            text-[8px]
            font-black
            uppercase
            tracking-[0.15em]
            text-white/65
            sm:text-[9px]
          "
        >
          Gold Balance
        </p>

        <p
          className="
            mt-0.5
            text-lg
            font-black
            sm:text-2xl
          "
        >
          {
            formatGoldMg(
              goldBalanceNanograms,
            )
          } mg
        </p>


        <p className="mt-1 text-[9px] font-black text-cyan-100">
          💎
          {" "}
          {
            summary
              ?.diamonds
              .today ??
            0
          }
          {" "}
          today
        </p>

      </div>


      <WalletCards
        className="
          h-5
          w-5
          shrink-0
          text-white/90
          sm:h-6
          sm:w-6
        "
      />
    </div>


    <div
      className="
        mt-2
        flex
        items-center
        justify-between
        gap-2
        border-t
        border-white/20
        pt-2
      "
    >
      <span
        className="
          text-[8px]
          font-black
          uppercase
          text-white/65
        "
      >
        Reward
      </span>

      <span
        className="
          text-[10px]
          font-black
          text-lime-200
          sm:text-xs
        "
      >
        Gold + {
          diamondsPerCollection
        } 💎
      </span>
    </div>
  </div>


  {/* Swipe information */}
  <div
    className="
      pointer-events-none
      absolute
      left-1/2
      top-[98px]
      z-30
      -translate-x-1/2
      whitespace-nowrap
      rounded-full
      border
      border-white/10
      bg-black/45
      px-3
      py-1
      text-[8px]
      font-bold
      text-white/60
      backdrop-blur-sm
      sm:top-[112px]
      sm:text-[9px]
    "
  >
    Swipe to explore mine
  </div>


  {/* Cycle - bottom left */}
  <div
    className="
      pointer-events-none
      absolute
      bottom-3
      left-3
      z-40
      rounded-xl
      border
      border-white/15
      bg-black/70
      px-3
      py-2
      text-white
      shadow-lg
      backdrop-blur-md
      sm:bottom-5
      sm:left-5
    "
  >
    <p
      className="
        text-[7px]
        font-black
        uppercase
        tracking-wider
        text-white/50
        sm:text-[8px]
      "
    >
      Cycle
    </p>

    <p
      className="
        text-xs
        font-black
        sm:text-sm
      "
    >
      15 Min
    </p>
  </div>


  {/* Gold storage - bottom center */}
  <div
    className="
      pointer-events-none
      absolute
      bottom-3
      left-1/2
      z-40
      min-w-[120px]
      -translate-x-1/2
      rounded-2xl
      border
      border-amber-300/30
      bg-black/80
      px-4
      py-2
      text-center
      text-white
      shadow-xl
      backdrop-blur-md
      sm:bottom-5
      sm:min-w-[150px]
      sm:px-5
      sm:py-2.5
    "
  >
    <div
  className="
    flex
    items-center
    justify-center
    gap-1.5
  "
>
  {/* Animated storage coin */}
  <span
    className={`
      genz-storage-coin
      flex
      h-5
      w-5
      shrink-0
      items-center
      justify-center
      rounded-full
      border
      border-yellow-200
      bg-gradient-to-br
      from-yellow-200
      via-amber-400
      to-orange-500
      text-[7px]
      font-black
      text-amber-950
      shadow
      sm:h-6
      sm:w-6
      sm:text-[8px]
      ${
        isMining
          ? "genz-storage-coin-active"
          : ""
      }
    `}
    aria-hidden="true"
  >
    G
  </span>


  <span
    className="
      text-lg
      font-black
      text-amber-300
      sm:text-2xl
    "
  >
    {
      displayedOre
    }
  </span>


  <span
    className="
      text-[10px]
      font-black
      text-white/60
      sm:text-sm
    "
  >
    /
    {
      capacityOre
    }
  </span>
</div>


    <p
      className="
        text-[7px]
        font-black
        uppercase
        tracking-widest
        text-white/50
        sm:text-[8px]
      "
    >
      Gold Ore Storage
    </p>
  </div>


  {/* Collected - bottom right */}
  <div
    className="
      pointer-events-none
      absolute
      bottom-3
      right-3
      z-40
      rounded-xl
      border
      border-white/15
      bg-black/70
      px-3
      py-2
      text-right
      text-white
      shadow-lg
      backdrop-blur-md
      sm:bottom-5
      sm:right-5
    "
  >
    <p
      className="
        text-[7px]
        font-black
        uppercase
        tracking-wider
        text-white/50
        sm:text-[8px]
      "
    >
      Collected
    </p>

    <p
      className="
        text-xs
        font-black
        sm:text-sm
      "
    >
      {
        collectedCycles
      }
    </p>
  </div>


  {/* ===================================================
   * START MINING BUTTON
   * ===================================================
   */}
  {isIdle && (
    <button
      type="button"
      disabled={
        isStarting ||
        isCollecting
      }
      onClick={() => {
        void handleStartMining();
      }}
      className="
        absolute
        bottom-[76px]
        left-1/2
        z-50
        -translate-x-1/2
        whitespace-nowrap
        rounded-2xl
        border-2
        border-orange-300
        bg-gradient-to-b
        from-orange-400
        to-[#FF4E00]
        px-6
        py-3
        text-xs
        font-black
        text-white
        shadow-2xl
        transition
        active:scale-95
        disabled:opacity-60
        sm:bottom-[88px]
        sm:px-8
        sm:py-3.5
        sm:text-sm
      "
    >
      {
        isStarting
          ? (
              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <LoaderCircle
                  className="
                    h-4
                    w-4
                    animate-spin
                  "
                />

                Starting Mine...
              </span>
            )
          : (
              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <Play
                  className="
                    h-4
                    w-4
                    fill-current
                  "
                />

                Start Mining
              </span>
            )
      }
    </button>
  )}


  {/* ===================================================
   * MINING STATUS
   * ===================================================
   */}
  {isMining && (
    <div
      className="
        pointer-events-none
        absolute
        bottom-[78px]
        left-1/2
        z-40
        -translate-x-1/2
        whitespace-nowrap
        rounded-full
        border
        border-emerald-300/30
        bg-emerald-950/80
        px-4
        py-2
        text-[9px]
        font-black
        text-emerald-200
        shadow-lg
        backdrop-blur-md
        sm:bottom-[92px]
        sm:text-[10px]
      "
    >
      Miner is working
    </div>
  )}


  {/* ===================================================
   * COLLECT BUTTON
   * ===================================================
   */}
  {isFull && (
    <button
      type="button"
      disabled={
        isCollecting ||
        isStarting
      }
      onClick={() => {
        void handleCollect();
      }}
      className="
        absolute
        bottom-[76px]
        left-1/2
        z-50
        -translate-x-1/2
        whitespace-nowrap
        rounded-2xl
        border-2
        border-emerald-300
        bg-gradient-to-b
        from-emerald-400
        to-emerald-600
        px-6
        py-3
        text-xs
        font-black
        text-white
        shadow-2xl
        transition
        active:scale-95
        disabled:opacity-60
        sm:bottom-[88px]
        sm:px-8
        sm:py-3.5
        sm:text-sm
      "
    >
      {
        isCollecting
          ? (
              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <LoaderCircle
                  className="
                    h-4
                    w-4
                    animate-spin
                  "
                />

                Collecting...
              </span>
            )
          : (
              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <WalletCards
                  className="
                    h-4
                    w-4
                  "
                />

                Collect Gold
              </span>
            )
      }
    </button>
  )}
</div>


        <p
          className="
            mt-4
            px-2
            text-center
            text-[10px]
            leading-relaxed
            app-text-muted
          "
        >
          Real Gold is credited to your Gold Balance after a completed mining cycle. Each collection also gives 10 💎.
        </p>
      </div>


      <style>
  {`
    /*
     * =================================================
     * GOLD MINE WORLD VIEWPORT
     * =================================================
     */

    .genz-mine-viewport {
      scrollbar-width:
        none;

      -ms-overflow-style:
        none;

      scroll-behavior:
        smooth;

      touch-action:
        pan-x pan-y;

      cursor:
        grab;
    }


    .genz-mine-viewport:active {
      cursor:
        grabbing;
    }


    .genz-mine-viewport::-webkit-scrollbar {
      display:
        none;
    }


    /*
     * Prevent selection while the
     * user is exploring the map.
     */
    .genz-mine-viewport,
    .genz-mine-viewport * {
      -webkit-user-select:
        none;

      user-select:
        none;
    }

        /*
     * =================================================
     * MINING IMPACT EFFECTS
     * =================================================
     */

    .genz-hit-rock {
      transform-origin:
        215px 112px;

      transform-box:
        view-box;
    }


    .genz-hit-rock-active {
      animation:
        genzRockHit
        900ms
        ease-in-out
        infinite;
    }


    .genz-rock-flash {
      opacity:
        0;

      pointer-events:
        none;

      transform-origin:
        215px 112px;

      transform-box:
        view-box;
    }


    .genz-rock-flash-active {
      animation:
        genzRockFlash
        900ms
        ease-out
        infinite;
    }


    .genz-gold-chips {
      pointer-events:
        none;
    }


    .genz-gold-chip {
      opacity:
        0;

      transform-box:
        fill-box;

      transform-origin:
        center;
    }


    .genz-gold-chips-active
    .genz-gold-chip {
      animation:
        genzGoldChipFly
        900ms
        ease-out
        infinite;
    }


    .genz-gold-chip-1 {
      --chip-x:
        18px;

      --chip-y:
        -19px;
    }


    .genz-gold-chip-2 {
      --chip-x:
        28px;

      --chip-y:
        -8px;
    }


    .genz-gold-chip-3 {
      --chip-x:
        15px;

      --chip-y:
        13px;
    }


    .genz-gold-chip-4 {
      --chip-x:
        4px;

      --chip-y:
        -25px;
    }


    .genz-gold-chip-5 {
      --chip-x:
        28px;

      --chip-y:
        12px;
    }


    .genz-storage-coin {
      transform-origin:
        center;
    }


    .genz-storage-coin-active {
      animation:
        genzStorageCoinBounce
        900ms
        ease-out
        infinite;
    }


    .genz-miner-body {
      transform-origin: 108px 126px;
      transform-box: view-box;
    }

    .genz-miner-swing {
      transform-origin: 124px 91px;
      transform-box: view-box;
    }

    .genz-miner-dust,
    .genz-gold-impact {
      opacity: 0;
      transform-origin: 213px 84px;
      transform-box: view-box;
    }


    /*
     * Whole body follows the digging motion.
     */
    .genz-miner-body-active {
      animation:
        genzMinerBodyDig
        900ms
        ease-in-out
        infinite;
    }


    /*
     * Arm + pickaxe perform the actual strike.
     */
    .genz-miner-swing-active {
      animation:
        genzMinerPickaxeStrike
        900ms
        cubic-bezier(
          0.45,
          0,
          0.25,
          1
        )
        infinite;
    }


    /*
     * Dust appears exactly around impact.
     */
    .genz-miner-dust-active {
      animation:
        genzMinerDust
        900ms
        ease-out
        infinite;
    }


    /*
     * Small gold sparkle on impact.
     */
    .genz-gold-impact-active {
      animation:
        genzMinerGoldImpact
        900ms
        ease-out
        infinite;
    }


    @keyframes genzMinerBodyDig {
      0%,
      15%,
      100% {
        transform:
          translateY(0)
          rotate(0deg);
      }

      42% {
        transform:
          translateY(2px)
          rotate(1deg);
      }

      58% {
        transform:
          translateY(5px)
          translateX(2px)
          rotate(3deg);
      }

      72% {
        transform:
          translateY(1px)
          rotate(1deg);
      }
    }


    @keyframes genzMinerPickaxeStrike {
  /*
   * Pickaxe lifted behind miner.
   */
  0%,
  12% {
    transform:
      rotate(-48deg)
      scale(1);
  }


  /*
   * Swing starts.
   */
  35% {
    transform:
      rotate(-20deg)
      scale(1);
  }


  /*
   * Rock impact.
   *
   * Tiny scale increase makes the
   * axe hit feel heavier.
   */
  55% {
    transform:
      rotate(34deg)
      scale(1.045);
  }


  /*
   * Small rebound after impact.
   */
  63% {
    transform:
      rotate(27deg)
      scale(0.985);
  }


  /*
   * Recover from the hit.
   */
  72% {
    transform:
      rotate(8deg)
      scale(1);
  }


  /*
   * Lift for next strike.
   */
  100% {
    transform:
      rotate(-48deg)
      scale(1);
  }
}


    @keyframes genzMinerDust {
      0%,
      48% {
        opacity: 0;
        transform:
          translate(0, 0)
          scale(0.35);
      }

      55% {
        opacity: 0.9;
        transform:
          translate(0, 0)
          scale(1);
      }

      76% {
        opacity: 0;
        transform:
          translate(8px, -10px)
          scale(1.45);
      }

      100% {
        opacity: 0;
      }
    }


    @keyframes genzMinerGoldImpact {
      0%,
      50% {
        opacity: 0;
        transform:
          scale(0.2);
      }

      57% {
        opacity: 1;
        transform:
          scale(1.35);
      }

      77% {
        opacity: 0;
        transform:
          translate(6px, -8px)
          scale(0.6);
      }

      100% {
        opacity: 0;
      }
    }
      /*
 * =================================================
 * ROCK HIT
 * =================================================
 *
 * Synchronized with the axe impact around
 * the 55% point of the 900ms mining cycle.
 */
@keyframes genzRockHit {
  0%,
  48%,
  100% {
    transform:
      translate(0, 0)
      rotate(0deg);
  }


  /*
   * Initial axe contact.
   */
  53% {
    transform:
      translate(2px, -1px)
      rotate(1deg);
  }


  /*
   * Opposite-direction vibration.
   */
  57% {
    transform:
      translate(-2px, 1px)
      rotate(-1deg);
  }


  61% {
    transform:
      translate(1.5px, 0)
      rotate(0.7deg);
  }


  66% {
    transform:
      translate(-1px, 0)
      rotate(-0.4deg);
  }


  72% {
    transform:
      translate(0, 0)
      rotate(0deg);
  }
}


/*
 * =================================================
 * GOLD ROCK FLASH
 * =================================================
 *
 * Short light flash at the exact hit.
 */
@keyframes genzRockFlash {
  0%,
  49% {
    opacity:
      0;

    transform:
      scale(0.98);
  }


  54% {
    opacity:
      0.9;

    transform:
      scale(1.035);
  }


  60% {
    opacity:
      0.45;

    transform:
      scale(1.015);
  }


  69% {
    opacity:
      0;

    transform:
      scale(1);
  }


  100% {
    opacity:
      0;

    transform:
      scale(1);
  }
}


/*
 * =================================================
 * FLYING GOLD CHIPS
 * =================================================
 *
 * Small pieces break away from the rock
 * at each successful visual impact.
 */
@keyframes genzGoldChipFly {
  0%,
  49% {
    opacity:
      0;

    transform:
      translate(0, 0)
      rotate(0deg)
      scale(0.35);
  }


  /*
   * Chips appear exactly after impact.
   */
  54% {
    opacity:
      1;

    transform:
      translate(0, 0)
      rotate(0deg)
      scale(1);
  }


  /*
   * Chips spread away from the rock.
   */
  78% {
    opacity:
      0.9;

    transform:
      translate(
        var(--chip-x),
        var(--chip-y)
      )
      rotate(110deg)
      scale(0.82);
  }


  /*
   * Continue travelling while fading.
   */
  100% {
    opacity:
      0;

    transform:
      translate(
        var(--chip-x),
        calc(
          var(--chip-y) + 8px
        )
      )
      rotate(190deg)
      scale(0.45);
  }
}


/*
 * =================================================
 * STORAGE COIN BOUNCE
 * =================================================
 *
 * Very small synchronized bounce.
 * It gives the feeling that mined Gold is
 * moving into storage without being noisy.
 */
@keyframes genzStorageCoinBounce {
  0%,
  48%,
  100% {
    transform:
      translateY(0)
      scale(1);
  }


  55% {
    transform:
      translateY(-6px)
      scale(1.1);
  }


  64% {
    transform:
      translateY(1px)
      scale(0.96);
  }


  73% {
    transform:
      translateY(-2px)
      scale(1.025);
  }


  82% {
    transform:
      translateY(0)
      scale(1);
  }
}


    /*
     * Accessibility:
     * respect Android/browser reduced-motion.
     */
    @media (
  prefers-reduced-motion:
  reduce
) {
  .genz-miner-body-active,
  .genz-miner-swing-active,
  .genz-miner-dust-active,
  .genz-gold-impact-active,
  .genz-hit-rock-active,
  .genz-rock-flash-active,
  .genz-gold-chips-active
    .genz-gold-chip,
  .genz-storage-coin-active {
    animation:
      none !important;
  }
}
  `}
</style>
    </div>

    </>
  );
};