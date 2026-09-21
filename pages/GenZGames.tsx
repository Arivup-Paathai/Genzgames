import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ChevronRight,
  Gamepad2,
  RefreshCw,
  Sparkles,
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
  formatGamePaise,
} from "../services/genzGames";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  showGenZGamesEntryInterstitial,
} from "../services/admob";

import {
  GenZSudoku,
} from "./GenZSudoku";

import {
  GenZGoldMine,
} from "./GenZGoldMine";

import {
  GenZ2048,
} from "./GenZ2048";

import {
  GenZLeaderboard,
} from "./GenZLeaderboard";




interface GenZGamesProps {
  onExit?: () => void;
}


type GenZGamesView =
  | "home"
  | "revenue"
  | "sudoku"
  | "goldmine"
  | "2048";


type GenZGamesHomeTab =
  | "games"
  | "leaderboard";


export const GenZGames:
React.FC<
  GenZGamesProps
> = ({
  onExit,
}) => {
  const {
  currentUser,
  addToast,
  signInWithGoogle,
} = useAuth();


  const [
    view,
    setView,
  ] =
    useState<
      GenZGamesView
    >(
      "home",
    );
  
    const [
    homeTab,
    setHomeTab,
  ] =
    useState<
      GenZGamesHomeTab
    >(
      "games",
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      GetGenZGamesSummaryResponse |
      null
    >(
      null,
    );


  const [
    isLoading,
    setIsLoading,
  ] = useState(
    true,
  );


  const [
    showIntro,
    setShowIntro,
  ] = useState(
    true,
  );


  const [
    showUpiEditor,
    setShowUpiEditor,
  ] = useState(
    false,
  );


  const [
    upiId,
    setUpiId,
  ] = useState(
    "",
  );


  const [
    isSavingUpi,
    setIsSavingUpi,
  ] = useState(
    false,
  );


  const [
    showRedeemConfirm,
    setShowRedeemConfirm,
  ] = useState(
    false,
  );


  const [
    isRedeeming,
    setIsRedeeming,
  ] = useState(
    false,
  );

  const openProtectedView =
  useCallback(
    async (
      target:
        | "revenue"
        | "sudoku"
        | "goldmine"
        | "2048",
    ) => {
      if (!currentUser) {
        addToast(
          "Sign in with Google to play & earn rewards.",
          "info",
        );

        await signInWithGoogle();

        return;
      }

      setView(target);
    },
    [
      currentUser,
      addToast,
      signInWithGoogle,
    ],
  );

    const openLeaderboard =
    useCallback(
      async () => {

        if (
          !currentUser
        ) {

          addToast(
            "Sign in with Google to join the daily leaderboard.",
            "info",
          );


          await signInWithGoogle();

          return;
        }


        setHomeTab(
          "leaderboard",
        );
      },
      [
        currentUser,
        addToast,
        signInWithGoogle,
      ],
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setShowIntro(
            false,
          );
        },
        1250,
      );


    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, []);


  /*
   * Show one interstitial whenever the user
   * opens the GenZGames surface.
   *
   * Ad failure never blocks GenZGames.
   */
  useEffect(() => {
    void showGenZGamesEntryInterstitial();
  }, []);


  const loadSummary =
    useCallback(
      async () => {
        if (
          !currentUser
        ) {
          setSummary(
            null,
          );

          setIsLoading(
            false,
          );

          return;
        }


        setIsLoading(
          true,
        );


        try {
          const result =
            await cloudflareR2
              .getGenZGamesSummary();


          setSummary(
            result,
          );
        } catch (error) {
          console.error(
            "Unable to load GenZGames summary:",
            error,
          );


          addToast(
            "Unable to load your GenZGames balance.",
            "error",
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        currentUser,
        addToast,
      ],
    );


  useEffect(() => {
    void loadSummary();
  }, [
    loadSummary,
  ]);

  /*
 * Refresh financial state whenever the
 * Gamer Revenue screen is opened.
 *
 * This picks up admin-side Paid / Rejected
 * redemption processing without requiring
 * an app restart.
 */
useEffect(() => {
  if (
    view !==
    "revenue"
  ) {
    return;
  }


  void loadSummary();
}, [
  view,
  loadSummary,
]);


  /*
 * Android Back:
 *
 * Revenue -> Games Home
 * Games Home -> Vibes
 *
 * Individual games register their own
 * back handler while open.
 */
useEffect(() => {
  if (
    view ===
      "sudoku" ||
    view ===
      "goldmine" ||
    view ===
      "2048"
  ) {
    return;
  }


    return registerNativeBackHandler(
      () => {
        if (
          view ===
          "revenue"
        ) {
          setView(
            "home",
          );

          return;
        }


        if (
          view ===
            "home" &&
          homeTab ===
            "leaderboard"
        ) {

          setHomeTab(
            "games",
          );

          return;
        }


        onExit?.();
      },
    );
  }, [
    view,
    homeTab,
    onExit,
  ]);


  const balancePaise =
    summary
      ?.balancePaise ??
    0;


  const minimumRedemptionPaise =
    summary
      ?.minimumRedemptionPaise ??
    100;


  const pendingRedemptionPaise =
    summary
      ?.pendingRedemptionPaise ??
    0;


  const redemptionProgress =
    useMemo(
      () =>
        Math.min(
          100,
          Math.max(
            0,
            (
              balancePaise /
              minimumRedemptionPaise
            ) *
              100,
          ),
        ),
      [
        balancePaise,
        minimumRedemptionPaise,
      ],
    );


  const payoutConfigured =
    summary
      ?.payout
      .configured ??
    false;


  const redeemEligible =
    balancePaise >=
      minimumRedemptionPaise &&
    payoutConfigured &&
    pendingRedemptionPaise ===
      0;


  const handleSaveUpi =
    async () => {
      const clean =
        upiId
          .trim()
          .toLowerCase();


      if (!clean) {
        addToast(
          "Enter your UPI ID.",
          "error",
        );

        return;
      }


      setIsSavingUpi(
        true,
      );


      try {
        await cloudflareR2
          .saveGenZGamesUpiId(
            clean,
          );


        setUpiId(
          "",
        );

        setShowUpiEditor(
          false,
        );


        await loadSummary();


        addToast(
          "Game payout UPI ID saved.",
          "success",
        );
      } catch (error) {
        console.error(
          "Unable to save GenZGames UPI:",
          error,
        );


        addToast(
          "Unable to save this UPI ID.",
          "error",
        );
      } finally {
        setIsSavingUpi(
          false,
        );
      }
    };


  const handleRedeem =
    async () => {
      if (
        !redeemEligible ||
        isRedeeming
      ) {
        return;
      }


      setIsRedeeming(
        true,
      );


      try {
        const result =
          await cloudflareR2
            .requestGenZGamesRedemption();


        setShowRedeemConfirm(
          false,
        );


        await loadSummary();


        addToast(
          `${formatGamePaise(
            result.amountPaise,
          )} redemption requested successfully.`,
          "success",
        );
      } catch (error) {
        console.error(
          "Unable to request GenZGames redemption:",
          error,
        );


        addToast(
          "Unable to request redemption.",
          "error",
        );
      } finally {
        setIsRedeeming(
          false,
        );
      }
    };


  if (
    view ===
    "sudoku"
  ) {
    return (
      <GenZSudoku
        summary={
          summary
        }
        onSummaryChange={
          setSummary
        }
        onBack={() =>
          setView(
            "home",
          )
        }
      />
    );
  }
  if (
  view ===
  "goldmine"
) {
  return (
    <GenZGoldMine
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onBack={() =>
        setView(
          "home",
        )
      }
    />
  );
}


if (
  view ===
  "2048"
) {
  return (
    <GenZ2048
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onBack={() =>
        setView(
          "home",
        )
      }
    />
  );
}


  if (
    view ===
    "revenue"
  ) {
    return (
      <>
        <div className="min-h-full w-full bg-[var(--app-bg)] app-text">
          <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() =>
                  setView(
                    "home",
                  )
                }
                className="w-10 h-10 rounded-full app-surface border app-border flex items-center justify-center"
                aria-label="Back to GenZGames"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>


              <div>
                <h1 className="text-xl font-black">
                  Gamer Revenue
                </h1>

                <p className="text-xs app-text-muted">
                  GenZGames wallet earnings
                </p>
              </div>
            </div>


            <div className="rounded-3xl bg-gradient-to-br from-[#FF4E00] via-orange-500 to-amber-400 p-6 text-white shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                Available Game Balance
              </p>

              <p className="mt-2 text-4xl font-black tracking-tight">
                {
                  formatGamePaise(
                    balancePaise,
                  )
                }
              </p>

              <p className="mt-2 text-xs text-white/80">
                Separate from Vibe and Creator earnings
              </p>
            </div>


            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl app-surface border app-border p-4">
                <p className="text-[10px] uppercase tracking-widest app-text-muted font-bold">
                  Lifetime earned
                </p>

                <p className="mt-2 text-xl font-black">
                  {
                    formatGamePaise(
                      summary
                        ?.lifetimeEarningsPaise ??
                      0,
                    )
                  }
                </p>
              </div>


              <div className="rounded-2xl app-surface border app-border p-4">
                <p className="text-[10px] uppercase tracking-widest app-text-muted font-bold">
                  Redeemed
                </p>

                <p className="mt-2 text-xl font-black">
                  {
                    formatGamePaise(
                      summary
                        ?.redeemedPaise ??
                      0,
                    )
                  }
                </p>
              </div>
            </div>


            {pendingRedemptionPaise >
              0 && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs font-black text-amber-500">
                  Redemption Pending
                </p>

                <p className="mt-1 text-xl font-black">
                  {
                    formatGamePaise(
                      pendingRedemptionPaise,
                    )
                  }
                </p>

                <p className="mt-1 text-[11px] app-text-muted">
  Your redemption request is being processed. The amount will be credited to your saved UPI ID within 24 hours.
</p>
              </div>
            )}


            <div className="mt-5 rounded-3xl app-surface border app-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">
                    UPI for Game Redemption
                  </p>

                  <p className="mt-1 text-xs app-text-muted">
                    Your UPI ID is stored securely for GenZGames payouts.
                  </p>
                </div>

                <WalletCards className="w-6 h-6 text-[#FF4E00]" />
              </div>


              {payoutConfigured &&
                !showUpiEditor && (
                <div className="mt-4 flex items-center justify-between rounded-2xl app-surface-secondary border app-border p-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold app-text-muted">
                      Saved UPI
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {
                        summary
                          ?.payout
                          .upiIdMasked
                      }
                    </p>
                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      setShowUpiEditor(
                        true,
                      )
                    }
                    className="text-xs font-black text-[#FF4E00]"
                  >
                    Edit
                  </button>
                </div>
              )}


              {(
                !payoutConfigured ||
                showUpiEditor
              ) && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={
                      upiId
                    }
                    onChange={(
                      event,
                    ) =>
                      setUpiId(
                        event.target
                          .value,
                      )
                    }
                    placeholder="yourname@upi"
                    disabled={
                      isSavingUpi
                    }
                    className="w-full rounded-2xl app-surface-secondary border app-border px-4 py-3 text-sm app-text outline-none focus:border-[#FF4E00]"
                  />


                  <div className="mt-3 flex gap-2">
                    {showUpiEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUpiEditor(
                            false,
                          );

                          setUpiId(
                            "",
                          );
                        }}
                        className="flex-1 rounded-xl app-surface-secondary border app-border py-3 text-xs font-black"
                      >
                        Cancel
                      </button>
                    )}


                    <button
                      type="button"
                      disabled={
                        isSavingUpi
                      }
                      onClick={() =>
                        void handleSaveUpi()
                      }
                      className="flex-1 rounded-xl bg-[#FF4E00] py-3 text-xs font-black text-white disabled:opacity-50"
                    >
                      {
                        isSavingUpi
                          ? "Saving..."
                          : "Save UPI"
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>


            <div className="mt-5 rounded-3xl app-surface border app-border p-5">
              <p className="font-black">
                Redemption
              </p>

              <p className="mt-1 text-xs app-text-muted">
                Minimum redemption is {formatGamePaise(
                  minimumRedemptionPaise,
                )}
              </p>


              <div className="mt-5 h-2 rounded-full bg-[var(--app-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FF4E00] transition-all duration-500"
                  style={{
                    width:
                      `${redemptionProgress}%`,
                  }}
                />
              </div>


              <div className="mt-2 flex justify-between text-[11px]">
                <span className="app-text-muted">
                  {
                    formatGamePaise(
                      balancePaise,
                    )
                  }
                </span>

                <span className="font-black">
                  {
                    formatGamePaise(
                      minimumRedemptionPaise,
                    )
                  }
                </span>
              </div>


              <button
                type="button"
                disabled={
                  !redeemEligible
                }
                onClick={() =>
                  setShowRedeemConfirm(
                    true,
                  )
                }
                className={`mt-5 w-full rounded-2xl py-3.5 text-sm font-black ${
                  redeemEligible
                    ? "bg-emerald-500 text-white"
                    : "bg-[var(--app-hover)] app-text-muted cursor-not-allowed"
                }`}
              >
                {pendingRedemptionPaise >
                0
                  ? "Redemption Pending"
                  : balancePaise <
                      minimumRedemptionPaise
                    ? `Redeem at ${formatGamePaise(
                        minimumRedemptionPaise,
                      )}`
                    : !payoutConfigured
                      ? "Add UPI to Redeem"
                      : `Redeem ${formatGamePaise(
                          balancePaise,
                        )}`}
              </button>
            </div>
          </div>
        </div>


        {showRedeemConfirm && (
          <div className="fixed inset-0 z-[180] app-overlay backdrop-blur-sm flex items-center justify-center px-5">
            <div className="w-full max-w-sm rounded-3xl app-surface border app-border p-5 text-center">
              <WalletCards className="mx-auto w-10 h-10 text-[#FF4E00]" />

              <h2 className="mt-3 text-xl font-black">
                Redeem Game Balance?
              </h2>

              <p className="mt-2 text-sm app-text-secondary">
                Request
                {" "}
                <strong>
                  {
                    formatGamePaise(
                      balancePaise,
                    )
                  }
                </strong>
                {" "}
                to your saved UPI ID.
              </p>


              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={
                    isRedeeming
                  }
                  onClick={() =>
                    setShowRedeemConfirm(
                      false,
                    )
                  }
                  className="rounded-xl app-surface-secondary border app-border py-3 text-xs font-black"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    isRedeeming
                  }
                  onClick={() =>
                    void handleRedeem()
                  }
                  className="rounded-xl bg-emerald-500 py-3 text-xs font-black text-white"
                >
                  {
                    isRedeeming
                      ? "Requesting..."
                      : "Confirm"
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }


  return (
    <>
      {showIntro && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center overflow-hidden bg-[var(--app-bg)]">
          <style>
            {`
              @keyframes genzGamesLogoIn {
                0% {
                  opacity: 0;
                  transform: scale(0.55) translateY(26px);
                  filter: blur(12px);
                }

                65% {
                  opacity: 1;
                  transform: scale(1.08);
                  filter: blur(0);
                }

                100% {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              @keyframes genzGamesGlow {
                0%, 100% {
                  transform: scale(0.9);
                  opacity: 0.28;
                }

                50% {
                  transform: scale(1.2);
                  opacity: 0.6;
                }
              }

              @keyframes genzGamesSpark {
                0%, 100% {
                  transform: translateY(0) scale(0.8);
                  opacity: 0.35;
                }

                50% {
                  transform: translateY(-12px) scale(1.15);
                  opacity: 1;
                }
              }
            `}
          </style>


          <div className="absolute w-72 h-72 rounded-full bg-[#FF4E00]/25 blur-3xl animate-[genzGamesGlow_1.4s_ease-in-out_infinite]" />

          <Sparkles className="absolute left-[18%] top-[30%] w-5 h-5 text-orange-400 animate-[genzGamesSpark_1.1s_ease-in-out_infinite]" />

          <Sparkles className="absolute right-[18%] bottom-[32%] w-4 h-4 text-amber-400 animate-[genzGamesSpark_1.3s_ease-in-out_infinite]" />


          <div className="relative z-10 text-center animate-[genzGamesLogoIn_650ms_ease-out_forwards]">
            <div className="mx-auto w-20 h-20 rounded-[26px] bg-gradient-to-br from-[#FF4E00] to-orange-400 flex items-center justify-center shadow-2xl">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>

            <h1 className="mt-5 text-4xl font-black app-text">
  GenZ
  <span className="text-[#FF4E00]">
    Games
  </span>
</h1>

            <p className="mt-2 text-sm font-bold app-text-muted">
              Play More. Earn More.
            </p>
          </div>
        </div>
      )}


      <div className="min-h-full w-full bg-[var(--app-bg)] app-text">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={
                onExit
              }
              className="w-10 h-10 rounded-full app-surface border app-border flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-xl font-black">
  GenZGames
</h1>

              <p className="text-xs app-text-muted">
                Play More. Earn More.
              </p>
            </div>
          </div>


          <div className="grid grid-cols-2 gap-3">

  <button
    type="button"
    onClick={() =>
      void openProtectedView(
        "revenue",
      )
    }
    className="h-[132px] rounded-[24px] bg-gradient-to-br from-[#FF4E00] via-orange-500 to-amber-400 p-4 text-left text-white shadow-lg active:scale-[0.99] transition"
  >

    <div className="flex h-full flex-col justify-between">

      <div className="flex items-start justify-between gap-2">

        <div>

          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/75">
            Game Balance
          </p>

          <p className="mt-1 text-2xl font-black">
            {
              isLoading
                ? "₹--"
                : formatGamePaise(
                    balancePaise,
                  )
            }
          </p>

        </div>


        <WalletCards className="h-5 w-5 shrink-0" />

      </div>


      <p className="text-[9px] font-semibold text-white/80">
        Tap for revenue
      </p>

    </div>

  </button>


  <div className="h-[132px] rounded-[24px] border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-sky-500/10 to-blue-500/10 p-4 shadow-sm">

    <div className="flex h-full flex-col justify-between">

      <div className="flex items-start justify-between gap-2">

        <div>

          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-500">
            Today Diamonds
          </p>

          <p className="mt-1 text-2xl font-black">
            {
              summary
                ?.diamonds
                .today ??
              0
            }
          </p>

        </div>


        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl">
          💎
        </div>

      </div>


      <p className="text-[9px] font-semibold app-text-muted">
        Daily leaderboard score
      </p>

    </div>

  </div>

</div>

                    <div className="mt-5 rounded-2xl border app-border app-surface p-1">

            <div className="grid grid-cols-2 gap-1">

              <button
                type="button"
                onClick={() =>
                  setHomeTab(
                    "games",
                  )
                }
                className={`rounded-xl px-4 py-3 text-xs font-black transition ${
                  homeTab ===
                  "games"
                    ? "bg-orange-500 text-white shadow"
                    : "app-text-secondary"
                }`}
              >
                🎮 Games
              </button>


              <button
                type="button"
                onClick={() =>
                  void openLeaderboard()
                }
                className={`rounded-xl px-4 py-3 text-xs font-black transition ${
                  homeTab ===
                  "leaderboard"
                    ? "bg-orange-500 text-white shadow"
                    : "app-text-secondary"
                }`}
              >
                🏆 Leaderboard
              </button>

            </div>

          </div>


          <div
            className={
              homeTab ===
              "games"
                ? ""
                : "hidden"
            }
          >


          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-black app-text-muted">
                Play & Earn
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Games
              </h2>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-[#FF4E00]">
              <Trophy className="w-4 h-4" />

              {
                summary
                  ?.sudoku
                  .completedLevels ??
                0
              }
              /100
            </div>
          </div>


          <button
  type="button"
  onClick={() =>
    void openProtectedView(
      "sudoku",
    )
  }
            className="mt-4 group w-full overflow-hidden rounded-3xl app-surface border app-border text-left shadow-sm hover:border-[#FF4E00]/50 transition"
          >
            <div className="p-5 flex items-center gap-4">
              <div className="w-16 h-16 shrink-0 rounded-2xl bg-[#FF4E00]/10 border border-[#FF4E00]/20 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-0.5">
                  {[
                    5,
                    3,
                    8,
                    6,
                    7,
                    2,
                    1,
                    9,
                    4,
                  ].map(
                    (
                      value,
                      index,
                    ) => (
                      <span
                        key={
                          index
                        }
                        className="w-3.5 h-3.5 text-[8px] font-black flex items-center justify-center rounded-sm bg-[#FF4E00]/10 text-[#FF4E00]"
                      >
                        {
                          value
                        }
                      </span>
                    ),
                  )}
                </div>
              </div>


              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black">
                    Sudoku
                  </h3>

                  <span className="rounded-full bg-[#FF4E00]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[#FF4E00]">
                    New
                  </span>
                </div>

                <p className="mt-1 text-xs app-text-muted">
                  100 progressive brain-training levels
                </p>

                <div className="mt-2 flex items-center gap-3 text-[10px] font-bold app-text-secondary">
                  <span>
                    ❤️ 3 Hearts
                  </span>

                  <span>
                    ₹0.05 + First Bonus
                  </span>
                </div>
              </div>


              <ChevronRight className="w-5 h-5 app-text-muted group-hover:text-[#FF4E00]" />
            </div>
          </button>


          <button
  type="button"
  onClick={() =>
    void openProtectedView(
      "goldmine",
    )
  }
  className="
    mt-4
    group
    w-full
    overflow-hidden
    rounded-3xl
    app-surface
    border
    app-border
    text-left
    shadow-sm
    hover:border-amber-500/50
    active:scale-[0.99]
    transition
  "
>
  <div
    className="
      p-5
      flex
      items-center
      gap-4
    "
  >
    <div
      className="
        w-16
        h-16
        shrink-0
        rounded-2xl
        bg-amber-400/10
        border
        border-amber-400/20
        flex
        items-center
        justify-center
      "
    >
      <span
        className="
          text-4xl
          select-none
        "
        aria-hidden="true"
      >
        ⛏️
      </span>
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
          gap-2
        "
      >
        <h3
          className="
            text-lg
            font-black
          "
        >
          Gold Mine
        </h3>


        <span
          className="
            rounded-full
            bg-emerald-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-emerald-500
          "
        >
          New
        </span>
      </div>


      <p
        className="
          mt-1
          text-xs
          app-text-muted
        "
      >
        Mine Gold and fill your storage
      </p>


      <div
        className="
          mt-2
          flex
          flex-wrap
          items-center
          gap-3
          text-[10px]
          font-bold
          app-text-secondary
        "
      >
        <span>
          ⏱️ 5 Min Cycle
        </span>

        <span>
          🪙 300 Gold
        </span>

        <span>
  💰 {
    formatGamePaise(
      summary
        ?.goldMine
        .rewardPaise ??
      3,
    )
  } / Cycle
</span>
      </div>
    </div>


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-amber-500
      "
    />
  </div>
</button>


<button
  type="button"
  onClick={() =>
    void openProtectedView(
      "2048",
    )
  }
  className="mt-4 group w-full overflow-hidden rounded-3xl app-surface border app-border text-left shadow-sm hover:border-orange-500/50 active:scale-[0.99] transition"
>
  <div className="p-5 flex items-center gap-4">

    <div className="w-16 h-16 shrink-0 rounded-2xl bg-orange-500/10 border border-orange-500/20 p-2">
      <div className="grid grid-cols-2 gap-1 h-full">
        {[2, 4, 8, 16].map(
          (value) => (
            <span
              key={value}
              className="rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center text-[10px] font-black"
            >
              {value}
            </span>
          ),
        )}
      </div>
    </div>


    <div className="min-w-0 flex-1">

      <div className="flex items-center gap-2">
        <h3 className="text-lg font-black">
          2048
        </h3>

        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-orange-500">
          New
        </span>
      </div>


      <p className="mt-1 text-xs app-text-muted">
        Merge tiles and climb to 2048
      </p>


      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold app-text-secondary">
        <span>
          🎬 Ad to Start
        </span>

        <span>
          💰 Up to ₹0.05
        </span>

        <span>
          💎 Up to 10
        </span>
      </div>

    </div>


    <ChevronRight className="w-5 h-5 app-text-muted group-hover:text-orange-500" />

  </div>
</button>


          </div>


          {homeTab ===
            "leaderboard" && (
            <GenZLeaderboard />
          )}

        </div>
      </div>
    </>
  );
};