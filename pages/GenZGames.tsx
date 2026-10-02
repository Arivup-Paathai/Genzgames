import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Gamepad2,
  Instagram,
  Play,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Youtube,
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
  GenZGoldMiners,
} from "./GenZGoldMiners";

import type {
  GenZGoldMinerId,
} from "../services/cloudflare/stream";

import {
  GenZ2048,
} from "./GenZ2048";

import {
  GenZSnake,
} from "./GenZSnake";

import {
  GenZFlappyRocket,
} from "./GenZFlappyRocket";

import {
  GenZKnifeHit,
} from "./GenZKnifeHit";

import {
  GenZBrickBreaker,
} from "./GenZBrickBreaker";

import {
  GenZCandyCascade,
} from "./GenZCandyCascade";

import {
  GenZLeaderboard,
} from "./GenZLeaderboard";

import {
  GenZGameRecords,
} from "./GenZGameRecords";

import genZShortsLogo from "../assets/GenZShorts_logo.png";

import {
  GenZRealGoldMiners,
} from "./GenZRealGoldMiners";

import {
  GenZRealGoldMine,
} from "./GenZRealGoldMine";

import type {
  GenZRealGoldMinerId,
} from "../services/cloudflare/stream";

interface GenZGamesProps {
  onExit?: () => void;

  onHomeVisibilityChange?: (
    isHome: boolean,
  ) => void;
}


type GenZGamesView =
  | "home"
  | "revenue"
  | "sudoku"
  | "goldminers"
  | "goldmine"
  | "realgoldminers"
  | "realgoldmine"
  | "2048"
  | "snake"
  | "flappyRocket"
  | "knifeHit"
  | "brickBreaker"
  | "candyCascade"
  | "genzshorts";


type GenZGamesHomeTab =
  | "games"
  | "leaderboard"
  | "records";


export const GenZGames:
React.FC<
  GenZGamesProps
> = ({
  onExit,
  onHomeVisibilityChange,
}) => {
  const {
  currentUser,
  addToast,
  signInWithGoogle,
} = useAuth();

const homeRootRef =
  useRef<
    HTMLDivElement |
    null
  >(
    null,
  );


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
    selectedGoldMinerId,
    setSelectedGoldMinerId,
  ] =
    useState<
      GenZGoldMinerId
    >(
      1,
    );

    const [
    selectedRealGoldMinerId,
    setSelectedRealGoldMinerId,
  ] =
    useState<
      GenZRealGoldMinerId
    >(
      1,
    );


  useEffect(
    () => {
      onHomeVisibilityChange?.(
        view === "home",
      );
    },
    [
      view,
      onHomeVisibilityChange,
    ],
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
    payoutMethod,
    setPayoutMethod,
  ] =
    useState<
      "upi" |
      "paypal"
    >(
      "upi",
    );


  const [
    upiId,
    setUpiId,
  ] = useState(
    "",
  );


  const [
    paypalEmail,
    setPaypalEmail,
  ] = useState(
    "",
  );


  const [
    payoutCountry,
    setPayoutCountry,
  ] = useState(
    "",
  );

    const [
    whatsappNumber,
    setWhatsappNumber,
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


  const [
    showRealGoldRedeemConfirm,
    setShowRealGoldRedeemConfirm,
  ] = useState(
    false,
  );


  const [
    isRedeemingRealGold,
    setIsRedeemingRealGold,
  ] = useState(
    false,
  );


  const resetGenZGamesScroll =
  useCallback(
    () => {

      /*
       * GenZGames lives inside the app's
       * existing scroll container.
       *
       * When a game is opened from far
       * down the Games list, React swaps
       * the content but the parent keeps
       * its old scrollTop.
       *
       * Reset every scrollable ancestor
       * while the Home root still exists.
       */
      let element:
        HTMLElement |
        null =
        homeRootRef
          .current;


      while (
        element
      ) {

        element.scrollTop =
          0;

        element.scrollLeft =
          0;


        element =
          element
            .parentElement;
      }


      window.scrollTo({
        top:
          0,

        left:
          0,

        behavior:
          "auto",
      });


      document
        .documentElement
        .scrollTop =
        0;

      document
        .documentElement
        .scrollLeft =
        0;


      document
        .body
        .scrollTop =
        0;

      document
        .body
        .scrollLeft =
        0;
    },
    [],
  );

  const openProtectedView =
  useCallback(
    async (
      target:
  | "revenue"
  | "sudoku"
  | "goldminers"
  | "goldmine"
  | "realgoldminers"
  | "realgoldmine"
  | "2048"
  | "snake"
  | "flappyRocket"
  | "knifeHit"
  | "brickBreaker"
  | "candyCascade",
    ) => {
      if (!currentUser) {
        addToast(
          "Sign in with Google to play & earn rewards.",
          "info",
        );

        await signInWithGoogle();

        return;
      }

      resetGenZGamesScroll();


setView(
  target,
);
    },
    [
  currentUser,
  addToast,
  signInWithGoogle,
  resetGenZGamesScroll,
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


    const openRecords =
    useCallback(
      async () => {

        if (
          !currentUser
        ) {

          addToast(
            "Sign in with Google to view Game Records.",
            "info",
          );


          await signInWithGoogle();

          return;
        }


        setHomeTab(
          "records",
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
    "goldminers" ||
  view ===
    "goldmine" ||
  view ===
    "realgoldminers" ||
  view ===
    "realgoldmine" ||
  view ===
    "2048" ||
  view ===
    "snake" ||
  view ===
    "flappyRocket" ||
  view ===
    "knifeHit" ||
  view ===
    "brickBreaker" ||
  view ===
    "candyCascade"
) {
  return;
}


    return registerNativeBackHandler(
      () => {
        if (
  view === "revenue" ||
  view === "genzshorts"
) {
  setView(
    "home",
  );

  return;
}


        if (
          view ===
            "home" &&
          homeTab !==
            "games"
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


  /*
   * Real Gold is stored by the backend
   * as integer nanograms.
   *
   * 1 mg = 1,000,000 ng.
   */
  const realGoldBalanceNanograms =
    summary
      ?.realGold
      .balanceNanograms ??
    0;


  const realGoldBalanceMg =
    realGoldBalanceNanograms /
    1_000_000;


  const pendingRealGoldRedemptionNanograms =
    summary
      ?.realGold
      .pendingRedemptionNanograms ??
    0;


  const pendingRealGoldRedemptionMg =
    pendingRealGoldRedemptionNanograms /
    1_000_000;


  const realGoldRedemptionMinimumPaise =
    summary
      ?.realGold
      .redemptionMinimumPaise ??
    500;


  const realGoldBackendEligible =
    summary
      ?.realGold
      .redemptionEligible ??
    false;





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


  /*
   * The backend decides whether the user's
   * Real Gold has reached the current ₹5
   * redemption value.
   *
   * The frontend never needs the Admin
   * gold rate.
   */
  const realGoldRedeemEligible =
    realGoldBackendEligible &&
    payoutConfigured &&
    pendingRealGoldRedemptionNanograms ===
      0;


  const redeemEligible =
    balancePaise >=
      minimumRedemptionPaise &&
    payoutConfigured &&
    pendingRedemptionPaise ===
      0;


    const handleSavePayout =
    async () => {

      const cleanUpi =
        upiId
          .trim()
          .toLowerCase();


      const cleanPayPal =
        paypalEmail
          .trim()
          .toLowerCase();


      const cleanCountry =
        payoutCountry
          .trim();


      const cleanWhatsApp =
        whatsappNumber
          .trim();


      if (
        payoutMethod ===
          "upi" &&
        !cleanUpi
      ) {

        addToast(
          "Enter your UPI ID.",
          "error",
        );


        return;
      }


      if (
        payoutMethod ===
          "paypal" &&
        !cleanPayPal
      ) {

        addToast(
          "Enter your PayPal email.",
          "error",
        );


        return;
      }


      if (
        payoutMethod ===
          "paypal" &&
        !cleanCountry
      ) {

        addToast(
          "Enter your country.",
          "error",
        );


        return;
      }


      if (
        !cleanWhatsApp
      ) {

        addToast(
          "Enter your WhatsApp number.",
          "error",
        );


        return;
      }


      setIsSavingUpi(
        true,
      );


      try {

        await cloudflareR2
          .saveGenZGamesPayoutDetails({
            payoutMethod,

            upiId:
              payoutMethod ===
              "upi"
                ? cleanUpi
                : undefined,

            paypalEmail:
              payoutMethod ===
              "paypal"
                ? cleanPayPal
                : undefined,

            country:
              payoutMethod ===
              "paypal"
                ? cleanCountry
                : "India",

            whatsappNumber:
              cleanWhatsApp,
          });


        setUpiId(
          "",
        );


        setPaypalEmail(
          "",
        );


        setPayoutCountry(
          "",
        );


        setWhatsappNumber(
          "",
        );


        setShowUpiEditor(
          false,
        );


        await loadSummary();


        addToast(
          "Game payout details saved.",
          "success",
        );

      } catch (
        error
      ) {

        console.error(
          "Unable to save GenZGames payout details:",
          error,
        );


        addToast(
          "Unable to save payout details.",
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


  const handleRealGoldRedeem =
    async () => {
      if (
        !realGoldRedeemEligible ||
        isRedeemingRealGold
      ) {
        return;
      }


      setIsRedeemingRealGold(
        true,
      );


      try {
        const result =
          await cloudflareR2
            .requestGenZRealGoldRedemption();


        setShowRealGoldRedeemConfirm(
          false,
        );


        await loadSummary();


        addToast(
          `${formatGamePaise(
            result.amountPaise,
          )} Real Gold redemption requested successfully.`,
          "success",
        );
      } catch (error) {
        console.error(
          "Unable to request Real Gold redemption:",
          error,
        );


        addToast(
          "Unable to request Real Gold redemption.",
          "error",
        );
      } finally {
        setIsRedeemingRealGold(
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
    "goldminers"
) {
  return (
    <GenZGoldMiners
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onOpenMiner={(
        minerId,
      ) => {
        setSelectedGoldMinerId(
          minerId,
        );

        setView(
          "goldmine",
        );
      }}
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
      minerId={
        selectedGoldMinerId
      }
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onBack={() =>
        setView(
          "goldminers",
        )
      }
    />
  );
}


if (
  view ===
    "realgoldminers"
) {
  return (
    <GenZRealGoldMiners
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onOpenMiner={(
        minerId,
      ) => {
        setSelectedRealGoldMinerId(
          minerId,
        );

        setView(
          "realgoldmine",
        );
      }}
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
    "realgoldmine"
) {
  return (
    <GenZRealGoldMine
      minerId={
        selectedRealGoldMinerId
      }
      summary={
        summary
      }
      onSummaryChange={
        setSummary
      }
      onBack={() =>
        setView(
          "realgoldminers",
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
  "snake"
) {
  return (
    <GenZSnake
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
  "flappyRocket"
) {
  return (
    <GenZFlappyRocket
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
  "knifeHit"
) {
  return (
    <GenZKnifeHit
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
  "brickBreaker"
) {
  return (
    <GenZBrickBreaker
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
  "candyCascade"
) {
  return (
    <GenZCandyCascade
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
  "genzshorts"
) {
  const openGenZShorts =
    () => {
      window.open(
        "https://play.google.com/store/apps/details?id=com.serndhom.matrimony",
        "_blank",
        "noopener,noreferrer",
      );
    };


  return (
    <div
      className="
        min-h-full
        w-full
        bg-[var(--app-bg)]
        app-text
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-3xl
          px-4
          py-5
          sm:px-6
        "
      >

        {/* Header */}
        <div
          className="
            flex
            items-center
            gap-3
            mb-6
          "
        >
          <button
            type="button"
            onClick={() =>
              setView(
                "home",
              )
            }
            className="
              w-10
              h-10
              rounded-full
              app-surface
              border
              app-border
              flex
              items-center
              justify-center
              active:scale-95
              transition
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


          <div>
            <h1
              className="
                text-xl
                font-black
              "
            >
              GenZShorts
            </h1>

            <p
              className="
                text-xs
                app-text-muted
              "
            >
              Watch • Create • Grow
            </p>
          </div>
        </div>


        {/* Main Promo */}
        <div
          className="
            relative
            overflow-hidden
            rounded-[32px]
            border
            app-border
            app-surface
            px-5
            py-8
            text-center
            shadow-xl
          "
        >

          {/* Background Glow */}
          <div
            className="
              pointer-events-none
              absolute
              -top-20
              left-1/2
              h-72
              w-72
              -translate-x-1/2
              rounded-full
              bg-[#FF4E00]/15
              blur-3xl
            "
          />


          {/* Available Badge */}
          <div
            className="
              relative
              z-10
              inline-flex
              items-center
              rounded-full
              border
              border-[#FF4E00]/20
              bg-[#FF4E00]/10
              px-4
              py-2
            "
          >
            <span
              className="
                text-[10px]
                font-black
                uppercase
                tracking-[0.18em]
                text-[#FF4E00]
              "
            >
              The GenZ Creator Platform
            </span>
          </div>


          {/* Logo */}
          <div
            className="
              relative
              z-10
              mt-7
              flex
              justify-center
            "
          >
            <img
              src={
                genZShortsLogo
              }
              alt="GenZShorts"
              className="
                w-48
                max-w-[75%]
                object-contain
                drop-shadow-2xl
              "
            />
          </div>


          {/* Marketing Text */}
          <h2
            className="
              relative
              z-10
              mt-7
              text-3xl
              font-black
              tracking-tight
            "
          >
            Watch.
            {" "}
            Create.
            {" "}
            <span
              className="
                text-[#FF4E00]
              "
            >
              Earn.
            </span>
          </h2>


          <p
            className="
              relative
              z-10
              mx-auto
              mt-3
              max-w-sm
              text-sm
              leading-6
              app-text-muted
            "
          >
            Discover Vibes, connect with people
            and turn your creativity into
            opportunities with GenZShorts.
          </p>


          {/* Feature Cards */}
          <div
            className="
              relative
              z-10
              mt-7
              grid
              grid-cols-2
              gap-3
            "
          >

            <div
              className="
                rounded-2xl
                border
                app-border
                app-surface-secondary
                p-4
                text-left
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#FF4E00]/10
                  text-[#FF4E00]
                "
              >
                <Play
                  className="
                    h-5
                    w-5
                  "
                />
              </div>

              <p
                className="
                  mt-3
                  text-sm
                  font-black
                "
              >
                Watch & Earn
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  leading-4
                  app-text-muted
                "
              >
                Enjoy short-form content and
                explore reward opportunities.
              </p>
            </div>


            <div
              className="
                rounded-2xl
                border
                app-border
                app-surface-secondary
                p-4
                text-left
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-purple-500/10
                  text-purple-500
                "
              >
                <Users
                  className="
                    h-5
                    w-5
                  "
                />
              </div>

              <p
                className="
                  mt-3
                  text-sm
                  font-black
                "
              >
                Create & Earn
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  leading-4
                  app-text-muted
                "
              >
                Share your creativity, grow your
                audience and unlock creator earnings.
              </p>
            </div>

          </div>


          {/* Quote */}
          <div
            className="
              relative
              z-10
              mt-5
              rounded-2xl
              bg-gradient-to-r
              from-[#FF4E00]/10
              via-orange-500/5
              to-purple-500/10
              px-4
              py-4
            "
          >
            <p
              className="
                text-sm
                font-black
              "
            >
              Your Vibe. Your Audience.
              {" "}
              <span
                className="
                  text-[#FF4E00]
                "
              >
                Your Opportunity.
              </span>
            </p>
          </div>


          {/* Install Button */}
          <button
            type="button"
            onClick={
              openGenZShorts
            }
            className="
              relative
              z-10
              mt-7
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-[#FF4E00]
              px-5
              py-4
              text-sm
              font-black
              text-white
              shadow-lg
              shadow-[#FF4E00]/20
              transition
              active:scale-[0.98]
            "
          >
            <Download
              className="
                h-5
                w-5
              "
            />

            Install GenZShorts
          </button>


          <button
            type="button"
            onClick={
              openGenZShorts
            }
            className="
              relative
              z-10
              mt-4
              inline-flex
              items-center
              gap-1.5
              text-xs
              font-bold
              app-text-muted
            "
          >
            View on Google Play

            <ExternalLink
              className="
                h-3.5
                w-3.5
              "
            />
          </button>

        </div>


        <p
          className="
            mt-5
            text-center
            text-[10px]
            leading-5
            app-text-muted
          "
        >
          Rewards and creator earnings are subject
          to GenZShorts eligibility and platform rules.
        </p>

      </div>
    </div>
  );
}


  if (
    view ===
    "revenue"
  ) {
    return (
      <>
        <div className="min-h-full w-full bg-[var(--app-bg)] app-text">
          <div
  className="
    mx-auto
    w-full
    max-w-3xl
    px-4
    pb-5
    sm:px-6
  "
  style={{
    paddingTop:
      "calc(env(safe-area-inset-top) + 14px)",
  }}
>
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


            <div className="mt-4 rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/10 p-5">

              <div className="flex items-start justify-between gap-3">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">
                    Real Gold Balance
                  </p>

                  <p className="mt-2 text-3xl font-black">
                    {
                      realGoldBalanceMg.toFixed(
                        6,
                      )
                    }
                    {" "}
                    <span className="text-base">
                      mg
                    </span>
                  </p>

                  <p className="mt-2 text-[11px] app-text-muted">
                    Real Gold earned from Gold Mining
                  </p>
                </div>


                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">
                  🪙
                </div>

              </div>


              <div className="mt-4 grid grid-cols-2 gap-3">

                <div className="rounded-2xl app-surface-secondary border app-border p-3">
                  <p className="text-[9px] uppercase font-bold app-text-muted">
                    Lifetime Gold
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      (
                        (
                          summary
                            ?.realGold
                            .lifetimeNanograms ??
                          0
                        ) /
                        1_000_000
                      ).toFixed(
                        6,
                      )
                    }
                    {" "}
                    mg
                  </p>
                </div>


                <div className="rounded-2xl app-surface-secondary border app-border p-3">
                  <p className="text-[9px] uppercase font-bold app-text-muted">
                    Redeemed Gold
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      (
                        (
                          summary
                            ?.realGold
                            .redeemedNanograms ??
                          0
                        ) /
                        1_000_000
                      ).toFixed(
                        6,
                      )
                    }
                    {" "}
                    mg
                  </p>
                </div>

              </div>

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


            <div className="mt-4 rounded-3xl border border-purple-500/20 bg-purple-500/5 p-5">

              <div className="flex items-start justify-between gap-3">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">
                    Referral Earnings
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      formatGamePaise(
                        summary
                          ?.referralEarnings
                          ?.lifetimePaise ??
                        0,
                      )
                    }
                  </p>

                  <p className="mt-1 text-[11px] app-text-muted">
                    Lifetime earnings from referred players
                  </p>
                </div>


                <Users className="h-6 w-6 text-purple-500" />

              </div>


              <div className="mt-4 grid grid-cols-3 gap-2">

                <div className="rounded-2xl app-surface-secondary border app-border p-3 text-center">

                  <p className="text-[9px] uppercase font-bold app-text-muted">
                    Today
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      formatGamePaise(
                        summary
                          ?.referralEarnings
                          ?.todayPaise ??
                        0,
                      )
                    }
                  </p>

                </div>


                <div className="rounded-2xl app-surface-secondary border app-border p-3 text-center">

                  <p className="text-[9px] uppercase font-bold app-text-muted">
                    Referred
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      summary
                        ?.referralEarnings
                        ?.referredPlayers ??
                      0
                    }
                  </p>

                </div>


                <div className="rounded-2xl app-surface-secondary border app-border p-3 text-center">

                  <p className="text-[9px] uppercase font-bold app-text-muted">
                    Rewards
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      summary
                        ?.referralEarnings
                        ?.qualifiedEvents ??
                      0
                    }
                  </p>

                </div>

              </div>


              <div className="mt-4 rounded-2xl bg-purple-500/10 px-4 py-3">

                <p className="text-[11px] leading-5 app-text-secondary">
                  Earn
                  {" "}
                  <strong>₹0.01</strong>
{" "}
whenever a referred player completes an eligible Sudoku level, Cash Mine collection, rewarded 2048 run, verified Snake run, verified Flappy Rocket reward, verified Knife Hit run, verified Brick Breaker reward or verified Candy Cascade level.
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
  Your redemption request is being processed. Payment will be sent to your saved payout method within 24 hours.
</p>
              </div>
            )}


            {pendingRealGoldRedemptionNanograms >
              0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">

                <p className="text-xs font-black text-amber-500">
                  Real Gold Redemption Pending
                </p>

                <p className="mt-1 text-xl font-black">
                  {
                    pendingRealGoldRedemptionMg.toFixed(
                      6,
                    )
                  }
                  {" "}
                  mg
                </p>

                <p className="mt-1 text-[11px] app-text-muted">
  Your ₹5 Real Gold redemption is being processed. Payment will be sent to your saved payout method.
</p>

              </div>
            )}


            <div className="mt-5 rounded-3xl app-surface border app-border p-5">

  <div className="flex items-center justify-between gap-3">

    <div>

      <p className="font-black">
        Payout Method
      </p>

      <p className="mt-1 text-xs app-text-muted">
        Choose UPI for India or PayPal for international payouts.
      </p>

    </div>


    <WalletCards className="w-6 h-6 text-[#FF4E00]" />

  </div>


  {payoutConfigured &&
    !showUpiEditor && (

    <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl app-surface-secondary border app-border p-4">

      <div className="min-w-0">

        <p className="text-[10px] uppercase font-bold app-text-muted">
          Payment Method
        </p>

        <p className="mt-1 text-sm font-black">
          {
            summary
              ?.payout
              .payoutMethod ===
            "paypal"
              ? "PayPal"
              : "UPI"
          }
        </p>


        <p className="mt-3 text-[10px] uppercase font-bold app-text-muted">
          {
            summary
              ?.payout
              .payoutMethod ===
            "paypal"
              ? "PayPal Email"
              : "UPI ID"
          }
        </p>

        <p className="mt-1 break-all text-sm font-black">
          {
            summary
              ?.payout
              .destinationMasked
          }
        </p>


        {summary
          ?.payout
          .payoutMethod ===
          "paypal" && (

          <>
            <p className="mt-3 text-[10px] uppercase font-bold app-text-muted">
              Country
            </p>

            <p className="mt-1 text-sm font-black">
              {
                summary
                  ?.payout
                  .country
              }
            </p>
          </>
        )}


        <p className="mt-3 text-[10px] uppercase font-bold app-text-muted">
          WhatsApp
        </p>

        <p className="mt-1 text-sm font-black">
          {
            summary
              ?.payout
              .whatsappNumberMasked
          }
        </p>

      </div>


      <button
        type="button"
        onClick={() => {

          setPayoutMethod(
            summary
              ?.payout
              .payoutMethod ??
            "upi",
          );


          setPayoutCountry(
            summary
              ?.payout
              .country ??
            "",
          );


          setShowUpiEditor(
            true,
          );
        }}
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

      <div className="grid grid-cols-2 gap-2">

        <button
          type="button"
          disabled={
            isSavingUpi
          }
          onClick={() =>
            setPayoutMethod(
              "upi",
            )
          }
          className={`rounded-2xl border px-3 py-3 text-xs font-black transition ${
            payoutMethod ===
            "upi"
              ? "border-[#FF4E00] bg-[#FF4E00]/10 text-[#FF4E00]"
              : "app-border app-surface-secondary app-text-secondary"
          }`}
        >
          🇮🇳 UPI
        </button>


        <button
          type="button"
          disabled={
            isSavingUpi
          }
          onClick={() =>
            setPayoutMethod(
              "paypal",
            )
          }
          className={`rounded-2xl border px-3 py-3 text-xs font-black transition ${
            payoutMethod ===
            "paypal"
              ? "border-blue-500 bg-blue-500/10 text-blue-500"
              : "app-border app-surface-secondary app-text-secondary"
          }`}
        >
          🌍 PayPal
        </button>

      </div>


      {payoutMethod ===
        "upi"
        ? (
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
              className="mt-3 w-full rounded-2xl app-surface-secondary border app-border px-4 py-3 text-sm app-text outline-none focus:border-[#FF4E00]"
            />
          )
        : (
            <>
              <input
                type="email"
                inputMode="email"
                value={
                  paypalEmail
                }
                onChange={(
                  event,
                ) =>
                  setPaypalEmail(
                    event.target
                      .value,
                  )
                }
                placeholder="PayPal email address"
                disabled={
                  isSavingUpi
                }
                className="mt-3 w-full rounded-2xl app-surface-secondary border app-border px-4 py-3 text-sm app-text outline-none focus:border-blue-500"
              />


              <input
                type="text"
                value={
                  payoutCountry
                }
                onChange={(
                  event,
                ) =>
                  setPayoutCountry(
                    event.target
                      .value,
                  )
                }
                placeholder="Country, e.g. United States"
                disabled={
                  isSavingUpi
                }
                className="mt-3 w-full rounded-2xl app-surface-secondary border app-border px-4 py-3 text-sm app-text outline-none focus:border-blue-500"
              />
            </>
          )}


      <input
        type="tel"
        inputMode="tel"
        value={
          whatsappNumber
        }
        onChange={(
          event,
        ) =>
          setWhatsappNumber(
            event.target
              .value,
          )
        }
        placeholder="+91 9876543210"
        disabled={
          isSavingUpi
        }
        className="mt-3 w-full rounded-2xl app-surface-secondary border app-border px-4 py-3 text-sm app-text outline-none focus:border-[#FF4E00]"
      />


      <p className="mt-2 text-[11px] leading-5 app-text-muted">
        {
          payoutMethod ===
          "paypal"
            ? "Enter the email linked to your PayPal account. Payments are processed manually."
            : "UPI payouts are intended for users in India."
        }
      </p>


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

              setPaypalEmail(
                "",
              );

              setPayoutCountry(
                "",
              );

              setWhatsappNumber(
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
            void handleSavePayout()
          }
          className="flex-1 rounded-xl bg-[#FF4E00] py-3 text-xs font-black text-white disabled:opacity-50"
        >
          {
            isSavingUpi
              ? "Saving..."
              : "Save Details"
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
                      ? "Add Payout Method to Redeem"
                      : `Redeem ${formatGamePaise(
                          balancePaise,
                        )}`}
              </button>
            </div>


            <div className="mt-5 rounded-3xl border border-amber-400/30 bg-amber-500/5 p-5">

              <div className="flex items-start justify-between gap-3">

                <div>
                  <p className="font-black">
                    Real Gold Redemption
                  </p>

                  <p className="mt-1 text-xs app-text-muted">
                    Redeem ₹5 when your Real Gold reaches the required value.
                  </p>
                </div>


                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-xl">
                  🪙
                </div>

              </div>


              <div className="mt-5 rounded-2xl app-surface-secondary border app-border p-4">

                <div className="flex items-center justify-between gap-3">

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest app-text-muted">
                      Gold Balance
                    </p>

                    <p className="mt-1 text-lg font-black">
                      {
                        realGoldBalanceMg.toFixed(
                          6,
                        )
                      }
                      {" "}
                      mg
                    </p>
                  </div>


                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest app-text-muted">
                      Redemption
                    </p>

                    <p className="mt-1 text-lg font-black text-amber-500">
                      {
                        formatGamePaise(
                          realGoldRedemptionMinimumPaise,
                        )
                      }
                    </p>
                  </div>

                </div>

              </div>


              <div
                className={`mt-4 rounded-2xl px-4 py-3 ${
                  realGoldBackendEligible
                    ? "bg-emerald-500/10 border border-emerald-500/25"
                    : "bg-[var(--app-hover)] border app-border"
                }`}
              >
                <p
                  className={`text-[11px] font-bold ${
                    realGoldBackendEligible
                      ? "text-emerald-500"
                      : "app-text-muted"
                  }`}
                >
                  {
                    pendingRealGoldRedemptionNanograms >
                    0
                      ? "Your ₹5 Real Gold redemption is already pending."
                      : realGoldBackendEligible
                        ? "✓ Your Real Gold has reached the ₹5 redemption value."
                        : "Keep mining until your Real Gold reaches the ₹5 redemption value."
                  }
                </p>
              </div>


              <button
                type="button"
                disabled={
                  !realGoldRedeemEligible
                }
                onClick={() =>
                  setShowRealGoldRedeemConfirm(
                    true,
                  )
                }
                className={`mt-4 w-full rounded-2xl py-3.5 text-sm font-black ${
                  realGoldRedeemEligible
                    ? "bg-amber-500 text-black"
                    : "bg-[var(--app-hover)] app-text-muted cursor-not-allowed"
                }`}
              >
                {
                  pendingRealGoldRedemptionNanograms >
                  0
                    ? "Real Gold Redemption Pending"
                    : !payoutConfigured
                      ? "Add Payout Method to Redeem"
                      : realGoldBackendEligible
                        ? `Redeem ${formatGamePaise(
                            realGoldRedemptionMinimumPaise,
                          )}`
                        : `Redeem at ${formatGamePaise(
                            realGoldRedemptionMinimumPaise,
                          )} Value`
                }
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
                to your saved{" "}
                <strong>
                  {
                    summary
                      ?.payout
                      .payoutMethod ===
                    "paypal"
                      ? "PayPal account"
                      : "UPI ID"
                  }
                </strong>
                .
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


        {showRealGoldRedeemConfirm && (
          <div className="fixed inset-0 z-[180] app-overlay backdrop-blur-sm flex items-center justify-center px-5">

            <div className="w-full max-w-sm rounded-3xl app-surface border app-border p-5 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl">
                🪙
              </div>


              <h2 className="mt-3 text-xl font-black">
                Redeem Real Gold?
              </h2>


              <p className="mt-2 text-sm app-text-secondary">
                Redeem
                {" "}
                <strong>
                  {
                    formatGamePaise(
                      realGoldRedemptionMinimumPaise,
                    )
                  }
                </strong>
                {" "}
                worth of your Real Gold to your saved{" "}
                <strong>
                  {
                    summary
                      ?.payout
                      .payoutMethod ===
                    "paypal"
                      ? "PayPal account"
                      : "UPI ID"
                  }
                </strong>
                .
              </p>


              <p className="mt-3 text-[11px] leading-5 app-text-muted">
                Only the Real Gold required for this ₹5 redemption will be deducted. Your remaining Real Gold will stay in your balance.
              </p>


              <div className="mt-5 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  disabled={
                    isRedeemingRealGold
                  }
                  onClick={() =>
                    setShowRealGoldRedeemConfirm(
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
                    isRedeemingRealGold
                  }
                  onClick={() =>
                    void handleRealGoldRedeem()
                  }
                  className="rounded-xl bg-amber-500 py-3 text-xs font-black text-black disabled:opacity-50"
                >
                  {
                    isRedeemingRealGold
                      ? "Requesting..."
                      : "Confirm ₹5"
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


      <div
  ref={
    homeRootRef
  }
  className="
    min-h-full
    w-full
    bg-[var(--app-bg)]
    app-text
  "
>
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
          <div className="grid grid-cols-3 gap-2">

  <button
    type="button"
    onClick={() =>
      void openProtectedView(
        "revenue",
      )
    }
    className="h-[132px] rounded-[22px] bg-gradient-to-br from-[#FF4E00] via-orange-500 to-amber-400 p-3 text-left text-white shadow-lg active:scale-[0.99] transition"
  >

    <div className="flex h-full flex-col justify-between">

      <div className="flex items-start justify-between gap-2">

        <div>

          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/75">
            Game Balance
          </p>

          <p className="mt-1 text-xl font-black">
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


  <button
    type="button"
    onClick={() =>
      void openProtectedView(
        "revenue",
      )
    }
    className="h-[132px] rounded-[22px] border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/10 p-3 text-left shadow-sm active:scale-[0.99] transition"
  >

    <div className="flex h-full flex-col justify-between">

      <div className="flex items-start justify-between gap-1">

        <div className="min-w-0">

          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-amber-500">
            Real Gold
          </p>

          <p className="mt-1 text-lg font-black">
            {
              isLoading
                ? "-- mg"
                : `${realGoldBalanceMg.toFixed(
                    6,
                  )} mg`
            }
          </p>

        </div>


        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-lg">
          🪙
        </div>

      </div>


      <p className="text-[9px] font-semibold app-text-muted">
        Tap to redeem
      </p>

    </div>

  </button>


  <div className="h-[132px] rounded-[22px] border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-sky-500/10 to-blue-500/10 p-3 shadow-sm">

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


{/* ==================================================
    7-DAY DAILY STREAK
================================================== */}
{currentUser &&
  summary
    ?.dailyStreak && (
    <div
      className="
        mt-4
        overflow-hidden
        rounded-[26px]
        border
        border-orange-500/25
        bg-gradient-to-br
        from-orange-500/10
        via-amber-500/5
        to-yellow-500/10
        p-4
        shadow-sm
      "
    >

      <div
        className="
          flex
          items-start
          justify-between
          gap-3
        "
      >

        <div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-orange-500/15
                text-xl
              "
            >
              🔥
            </div>


            <div>

              <p
                className="
                  text-[9px]
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-orange-500
                "
              >
                7-Day Daily Streak
              </p>

              <p
                className="
                  mt-0.5
                  text-sm
                  font-black
                "
              >
                Day {
                  summary
                    .dailyStreak
                    .day
                } of {
                  summary
                    .dailyStreak
                    .totalDays
                }
              </p>

            </div>

          </div>

        </div>


        <div
          className="
            rounded-xl
            bg-orange-500/10
            px-3
            py-2
            text-right
          "
        >

          <p
            className="
              text-[8px]
              font-black
              uppercase
              tracking-wider
              app-text-muted
            "
          >
            Pending Streak Bonus
          </p>

          <p
            className="
              mt-0.5
              text-lg
              font-black
              text-orange-500
            "
          >
            {
              formatGamePaise(
                summary
                  .dailyStreak
                  .pendingPaise,
              )
            }
          </p>

        </div>

      </div>


      <div
        className="
          mt-4
          grid
          grid-cols-7
          gap-1.5
        "
      >

        {Array.from({
          length:
            summary
              .dailyStreak
              .totalDays,
        }).map(
          (
            _,
            index,
          ) => {
            const day =
              index +
              1;

            const completedDay =
              day <
                summary
                  .dailyStreak
                  .day ||
              (
                day ===
                  summary
                    .dailyStreak
                    .day &&
                summary
                  .dailyStreak
                  .todayCompleted
              );

            const currentDay =
              day ===
                summary
                  .dailyStreak
                  .day &&
              !summary
                .dailyStreak
                .todayCompleted;


            return (
              <div
                key={
                  day
                }
                className={`
                  flex
                  h-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  text-[10px]
                  font-black
                  ${
                    completedDay
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                      : currentDay
                        ? "border-orange-500/40 bg-orange-500/15 text-orange-500"
                        : "app-border app-surface-secondary app-text-muted"
                  }
                `}
              >
                {
                  completedDay
                    ? "✓"
                    : day
                }
              </div>
            );
          },
        )}

      </div>


      <div
        className="
          mt-4
          flex
          items-end
          justify-between
          gap-3
        "
      >

        <div>

          <p
            className="
              text-[10px]
              font-black
              uppercase
              tracking-wider
              app-text-muted
            "
          >
            Today's Task
          </p>

          <p
            className="
              mt-1
              text-sm
              font-black
            "
          >
            {
              summary
                .dailyStreak
                .todayCompleted
                ? "Daily task completed ✓"
                : `Complete ${
                    summary
                      .dailyStreak
                      .target
                  } game levels`
            }
          </p>

        </div>


        <p
          className={`
            text-xl
            font-black
            ${
              summary
                .dailyStreak
                .todayCompleted
                ? "text-emerald-500"
                : "text-orange-500"
            }
          `}
        >
          {
            summary
              .dailyStreak
              .progress
          }
          /
          {
            summary
              .dailyStreak
              .target
          }
        </p>

      </div>


      <div
        className="
          mt-3
          h-2
          overflow-hidden
          rounded-full
          bg-[var(--app-hover)]
        "
      >

        <div
          className={`
            h-full
            rounded-full
            transition-all
            duration-500
            ${
              summary
                .dailyStreak
                .todayCompleted
                ? "bg-emerald-500"
                : "bg-orange-500"
            }
          `}
          style={{
            width:
              `${
                Math.min(
                  100,
                  (
                    summary
                      .dailyStreak
                      .progress /
                    Math.max(
                      1,
                      summary
                        .dailyStreak
                        .target,
                    )
                  ) *
                    100,
                )
              }%`,
          }}
        />

      </div>


      <div
        className="
          mt-3
          rounded-2xl
          bg-[var(--app-hover)]
          px-3
          py-2.5
        "
      >

        <p
          className="
            text-[10px]
            leading-4
            app-text-secondary
          "
        >
          {
            summary
              .dailyStreak
              .cycleCompletedToday
              ? (
                <>
                  🎉 7-day streak completed!
                  {" "}
                  <strong>
                    {
                      formatGamePaise(
                        summary
                          .dailyStreak
                          .fullRewardPaise,
                      )
                    }
                  </strong>
                  {" "}
                  has been added to your Game Balance.
                </>
              )
              : summary
                  .dailyStreak
                  .todayCompleted
                ? (
                  <>
                    ✓ Day {
                      summary
                        .dailyStreak
                        .day
                    } complete.
                    {" "}
                    Come back tomorrow and complete 3 levels to continue your streak.
                  </>
                )
                : (
                  <>
                    Complete any 3 eligible game levels today to add
                    {" "}
                    <strong>
                      {
                        formatGamePaise(
                          summary
                            .dailyStreak
                            .dailyBonusPaise,
                        )
                      }
                    </strong>
                    {" "}
                    to your Pending Streak Bonus. Finish all 7 days to receive
                    {" "}
                    <strong>
                      {
                        formatGamePaise(
                          summary
                            .dailyStreak
                            .fullRewardPaise,
                        )
                      }
                    </strong>
                    {" "}
                    in your Game Balance.
                  </>
                )
          }
        </p>

      </div>


      <p
        className="
          mt-3
          text-[9px]
          leading-4
          app-text-muted
        "
      >
        Eligible: Sudoku, Snake, Knife Hit, Brick Breaker
        and Candy Cascade. Missing a day resets the streak
        and forfeits the pending bonus.
      </p>

    </div>
  )}


{/* ==================================================
    GENZSHORTS PROMOTION
================================================== */}
<button
  type="button"
  onClick={() =>
    setView(
      "genzshorts",
    )
  }
  className="
    mt-5
    group
    relative
    w-full
    overflow-hidden
    rounded-[26px]
    border
    border-[#FF4E00]/25
    bg-gradient-to-br
    from-[#FF4E00]/10
    via-orange-500/5
    to-purple-500/10
    p-4
    text-left
    shadow-sm
    transition
    active:scale-[0.99]
  "
>

  <div
    className="
      absolute
      -right-10
      -top-10
      h-32
      w-32
      rounded-full
      bg-[#FF4E00]/10
      blur-3xl
    "
  />


  <div
    className="
      relative
      z-10
      flex
      items-center
      gap-4
    "
  >

    <div
      className="
        flex
        h-20
        w-20
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-2xl
        bg-black
        p-1
      "
    >
      <img
        src={
          genZShortsLogo
        }
        alt="GenZShorts"
        className="
          h-full
          w-full
          object-contain
        "
      />
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
          GenZShorts
        </h3>

        <span
          className="
            rounded-full
            bg-[#FF4E00]/10
            px-2
            py-0.5
            text-[8px]
            font-black
            uppercase
            text-[#FF4E00]
          "
        >
          Explore
        </span>
      </div>


      <p
        className="
          mt-1
          text-xs
          font-bold
          app-text-secondary
        "
      >
        Watch • Create • Earn
      </p>


      <p
        className="
          mt-1
          text-[10px]
          leading-4
          app-text-muted
        "
      >
        Discover Vibes, grow your audience
        and unlock new earning opportunities.
      </p>
    </div>


    <ChevronRight
      className="
        h-5
        w-5
        shrink-0
        app-text-muted
        group-hover:text-[#FF4E00]
      "
    />

  </div>
</button>

                    <div className="mt-5 rounded-2xl border app-border app-surface p-1">

            <div className="grid grid-cols-3 gap-1">

  <button
    type="button"
    onClick={() =>
      setHomeTab(
        "games",
      )
    }
    className={`rounded-xl px-2 py-3 text-[11px] font-black transition ${
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
    className={`rounded-xl px-2 py-3 text-[11px] font-black transition ${
      homeTab ===
      "leaderboard"
        ? "bg-orange-500 text-white shadow"
        : "app-text-secondary"
    }`}
  >
    🏆 Leaderboard
  </button>


  <button
    type="button"
    onClick={() =>
      void openRecords()
    }
    className={`rounded-xl px-2 py-3 text-[11px] font-black transition ${
      homeTab ===
      "records"
        ? "bg-orange-500 text-white shadow"
        : "app-text-secondary"
    }`}
  >
    👑 Records
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
              /1000
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
                  1000 progressive brain-training levels
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
  "goldminers",
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
          Cash Mine
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
        Mine Coins and fill your storage
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
          ⛏️ 5 Miners
        </span>

        <span>
          ⏱️ 3 Min / Miner
        </span>

        <span>
          💰 ₹0.05 / Miner
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
      "realgoldminers",
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
    hover:border-yellow-500/50
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
        bg-yellow-400/10
        border
        border-yellow-400/20
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
        🪙
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
          Real Gold Mining
        </h3>


        <span
          className="
            rounded-full
            bg-yellow-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-yellow-500
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
        Mine and collect real gold weight
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
          ⛏️ 2 Gold Miners
        </span>

        <span>
          ⏱️ 15 Min / Miner
        </span>

        <span>
          💎 Gold + 10 Diamonds
        </span>
      </div>
    </div>


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-yellow-500
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


<button
  type="button"
  onClick={() =>
    void openProtectedView(
      "snake",
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
    hover:border-emerald-500/50
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
        bg-emerald-500/10
        border
        border-emerald-500/20
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
        🐍
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
          Snake
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
        Grow your Snake to 50% and earn rewards
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
          🎬 Ad to Start
        </span>

        <span>
          💰 ₹0.05
        </span>

        <span>
          💎 10
        </span>
      </div>
    </div>


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-emerald-500
      "
    />
  </div>
</button>


<button
  type="button"
  onClick={() =>
    void openProtectedView(
      "flappyRocket",
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
    hover:border-sky-500/50
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
        bg-sky-500/10
        border
        border-sky-500/20
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
        🚀
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
          Flappy Rocket
        </h3>


        <span
          className="
            rounded-full
            bg-sky-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-sky-500
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
        Pass 50 gates, earn rewards and keep flying
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
          🎬 Ad to Start
        </span>

        <span>
          💰 ₹0.05
        </span>

        <span>
          💎 10
        </span>
      </div>
    </div>


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-sky-500
      "
    />
  </div>
</button>


<button
  type="button"
  onClick={() =>
    void openProtectedView(
      "knifeHit",
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
    hover:border-red-500/50
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
        bg-red-500/10
        border
        border-red-500/20
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
        🗡️
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
          Knife Hit
        </h3>


        <span
          className="
            rounded-full
            bg-red-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-red-500
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
        Time your throws, avoid knives and clear 5-level batches
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


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-red-500
      "
    />
  </div>
</button>


<button
  type="button"
  onClick={() =>
    void openProtectedView(
      "brickBreaker",
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
        bg-amber-500/10
        border
        border-amber-500/20
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
        🧱
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
          Brick Breaker
        </h3>

        <span
          className="
            rounded-full
            bg-amber-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-amber-500
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
        Break 50% to earn, then clear 100% to unlock
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
          🎬 Ad to Start
        </span>

        <span>
          💰 ₹0.05
        </span>

        <span>
          💎 10
        </span>

        <span>
          🧱 {
            summary
              ?.brickBreaker
              .highestUnlockedLevel ??
            1
          }/200
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
      "candyCascade",
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
    hover:border-fuchsia-500/50
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
        bg-gradient-to-br
        from-fuchsia-500/10
        to-violet-500/10
        border
        border-fuchsia-500/20
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
        🍬
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
          Candy Cascade
        </h3>


        <span
          className="
            rounded-full
            bg-fuchsia-500/10
            px-2
            py-0.5
            text-[9px]
            font-black
            uppercase
            text-fuchsia-500
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
        Match, cascade and complete objectives across 1000 levels
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
          🎬 Ad to Start
        </span>

        <span>
          💰 ₹0.05
        </span>

        <span>
          💎 10
        </span>

        <span>
          ⭐ {
            summary
              ?.candyCascade
              .totalStars ??
            0
          }
        </span>

        <span>
          🍬 {
            summary
              ?.candyCascade
              .highestUnlockedLevel ??
            1
          }/1000
        </span>
      </div>
    </div>


    <ChevronRight
      className="
        w-5
        h-5
        app-text-muted
        group-hover:text-fuchsia-500
      "
    />
  </div>
</button>


{/* GenZCommunity Social Links */}
<div
  className="
    mt-5
    rounded-3xl
    border
    app-border
    app-surface
    p-5
  "
>
  <div className="text-center">

    <p
      className="
        text-sm
        font-black
      "
    >
      Follow GenZCommunity
    </p>

    <p
      className="
        mt-1
        text-[11px]
        app-text-muted
      "
    >
      Stay connected for games, rewards and updates
    </p>

  </div>


  <div
    className="
      mt-4
      grid
      grid-cols-2
      gap-3
    "
  >

    {/* Instagram */}
    <button
      type="button"
      onClick={() => {
        window.open(
          "https://www.instagram.com/genz_community_corp/",
          "_blank",
          "noopener,noreferrer",
        );
      }}
      className="
        flex
        items-center
        justify-center
        gap-2
        rounded-2xl
        border
        border-pink-500/20
        bg-gradient-to-br
        from-pink-500/10
        via-fuchsia-500/10
        to-orange-500/10
        px-4
        py-3.5
        text-sm
        font-black
        transition
        active:scale-[0.98]
      "
    >
      <Instagram
        className="
          h-5
          w-5
          text-pink-500
        "
      />

      Instagram
    </button>


    {/* YouTube */}
    <button
      type="button"
      onClick={() => {
        window.open(
          "https://www.youtube.com/@GenZCommunitycorp",
          "_blank",
          "noopener,noreferrer",
        );
      }}
      className="
        flex
        items-center
        justify-center
        gap-2
        rounded-2xl
        border
        border-red-500/20
        bg-red-500/10
        px-4
        py-3.5
        text-sm
        font-black
        transition
        active:scale-[0.98]
      "
    >
      <Youtube
        className="
          h-5
          w-5
          text-red-500
        "
      />

      YouTube
    </button>

  </div>
</div>


          </div>


          {homeTab ===
            "leaderboard" && (
            <GenZLeaderboard />
          )}


          {homeTab ===
            "records" && (
            <GenZGameRecords />
          )}

        </div>
      </div>
    </>
  );
};