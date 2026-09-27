import React, {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Coins,
  Gamepad2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserCircle,
  Users,
  WalletCards,
} from "lucide-react";

import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../../services/firebase/firebase";


interface AdminGameUserListItem {
  userId: string;

  displayName: string;

  email: string;

  photoUrl: string;

  country: string;

  role: string;

  accountStatus: string;

  createdAt: string;
}


interface GetAdminGenZGameUsersResponse {
  success: boolean;

  totalUsers: number;

  users:
    AdminGameUserListItem[];

  nextCursorUserId:
    string |
    null;
}


interface GetAdminGenZGameUserDetailsRequest {
  userId:
    string;
}


interface AdminGameUserDetails {
  userId: string;

  displayName: string;

  email: string;

  photoUrl: string;

  phoneNumber: string;

  dateOfBirth: string;

  country: string;

  referralId: string;

  referredByReferralId: string;

  role: string;

  accountStatus: string;

  createdAt: string;
}


interface AdminGameUserWallet {
  balancePaise: number;

  lifetimeEarningsPaise: number;

  redeemedPaise: number;

  pendingRedemptionPaise: number;

  lifetimeDiamonds: number;

  referralEarningsPaise: number;

  referralUsersCount: number;

  referralQualifiedEvents: number;
}


interface AdminGameUserGames {
  sudoku: {
    completedLevels:
      number;

    highestUnlockedLevel:
      number;
  };

  goldMine: {
    collectedCycles:
      number;
  };

  game2048: {
    completedRuns:
      number;

    bestTile:
      number;

    highScore:
      number;
  };

  snake: {
    completedRuns:
      number;

    highestUnlockedLevel:
      number;

    bestScore:
      number;
  };

  flappyRocket: {
    completedRuns:
      number;
  };

  knifeHit: {
    completedRuns:
      number;

    bestScore:
      number;

    highestLevelCleared:
      number;
  };

  brickBreaker: {
    completedRuns:
      number;

    rewardedRuns:
      number;

    bestScore:
      number;

    highestLevelCleared:
      number;

    highestUnlockedLevel:
      number;
  };

  candyCascade: {
    completedRuns:
      number;

    bestScore:
      number;

    highestLevelCleared:
      number;

    highestUnlockedLevel:
      number;

    totalStars:
      number;
  };
}


interface GetAdminGenZGameUserDetailsResponse {
  success:
    boolean;

  user:
    AdminGameUserDetails;

  wallet:
    AdminGameUserWallet;

  games:
    AdminGameUserGames;
}


const getAdminGenZGameUsers =
  httpsCallable<
    {
      cursorUserId?:
        string;
    },
    GetAdminGenZGameUsersResponse
  >(
    functions,
    "getAdminGenZGameUsers",
  );


const getAdminGenZGameUserDetails =
  httpsCallable<
    GetAdminGenZGameUserDetailsRequest,
    GetAdminGenZGameUserDetailsResponse
  >(
    functions,
    "getAdminGenZGameUserDetails",
  );

const sendAdminGenZGamesNotification =
  httpsCallable<
    {
      recipientType:
        "user";

      userId:
        string;

      title:
        string;

      message:
        string;
    },
    {
      success:
        boolean;

      recipientType:
        "user";

      userId:
        string;

      notificationId:
        string;
    }
  >(
    functions,
    "sendAdminGenZGamesNotification",
  );
const formatPaise =
  (
    paise:
      number,
  ) =>
    `₹${(
      Math.max(
        0,
        paise,
      ) /
      100
    ).toFixed(
      2,
    )}`;


const formatDate =
  (
    value:
      string,
  ) => {

    if (
      !value
    ) {
      return "—";
    }


    const date =
      new Date(
        value,
      );


    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return value;
    }


    return date.toLocaleDateString(
      "en-IN",
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "numeric",
      },
    );
  };


export const AdminGameUsers:
React.FC = () => {

  const [
    users,
    setUsers,
  ] =
    useState<
      AdminGameUserListItem[]
    >([]);


  const [
    totalUsers,
    setTotalUsers,
  ] =
    useState(
      0,
    );


  const [
    nextCursorUserId,
    setNextCursorUserId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState(
      "",
    );


  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  


  const [
    isLoadingMore,
    setIsLoadingMore,
  ] =
    useState(
      false,
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<
      GetAdminGenZGameUserDetailsResponse |
      null
    >(
      null,
    );


  const [
    isLoadingDetails,
    setIsLoadingDetails,
  ] =
    useState(
      false,
    );

    const [
    showNotificationComposer,
    setShowNotificationComposer,
  ] =
    useState(
      false,
    );


  const [
    notificationTitle,
    setNotificationTitle,
  ] =
    useState(
      "",
    );


  const [
    notificationMessage,
    setNotificationMessage,
  ] =
    useState(
      "",
    );


  const [
    isSendingNotification,
    setIsSendingNotification,
  ] =
    useState(
      false,
    );


  const [
    notificationStatus,
    setNotificationStatus,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const loadUsers =
    async (
      append:
        boolean,
    ) => {

      try {

        if (
          append
        ) {
          setIsLoadingMore(
            true,
          );
        } else {
          setIsLoading(
            true,
          );
        }


        setErrorMessage(
          null,
        );


        const result =
          await getAdminGenZGameUsers(
            append &&
            nextCursorUserId
              ? {
                  cursorUserId:
                    nextCursorUserId,
                }
              : {},
          );


        setTotalUsers(
          result.data
            .totalUsers,
        );


        setUsers(
          (
            current,
          ) =>
            append
              ? [
                  ...current,
                  ...result.data
                    .users,
                ]
              : result.data
                  .users,
        );


        setNextCursorUserId(
          result.data
            .nextCursorUserId,
        );

      } catch (error) {

        console.error(
          "Unable to load GenZGames users:",
          error,
        );


        setErrorMessage(
          "Unable to load GenZGames users.",
        );

      } finally {

        setIsLoading(
          false,
        );


        setIsLoadingMore(
          false,
        );
      }
    };


  useEffect(
    () => {

      void loadUsers(
        false,
      );

    },
    [],
  );


  const openUser =
    async (
      userId:
        string,
    ) => {

      try {

        setSelectedUserId(
          userId,
        );

                setShowNotificationComposer(
          false,
        );


        setNotificationTitle(
          "",
        );


        setNotificationMessage(
          "",
        );


        setNotificationStatus(
          null,
        );


        setSelectedUser(
          null,
        );


        setIsLoadingDetails(
          true,
        );


        setErrorMessage(
          null,
        );


        const result =
          await getAdminGenZGameUserDetails({
            userId,
          });


        setSelectedUser(
          result.data,
        );

      } catch (error) {

        console.error(
          "Unable to load GenZGames user details:",
          error,
        );


        setErrorMessage(
          "Unable to load this user's details.",
        );

      } finally {

        setIsLoadingDetails(
          false,
        );
      }
    };

    const sendNotificationToSelectedUser =
    async () => {

      if (
        !selectedUserId
      ) {
        return;
      }


      const cleanTitle =
        notificationTitle
          .trim();


      const cleanMessage =
        notificationMessage
          .trim();


      if (
        cleanTitle.length <
          2 ||
        cleanTitle.length >
          80
      ) {
        setNotificationStatus(
          "Title must be between 2 and 80 characters.",
        );

        return;
      }


      if (
        !cleanMessage ||
        cleanMessage.length >
          500
      ) {
        setNotificationStatus(
          "Message must be between 1 and 500 characters.",
        );

        return;
      }


      const confirmed =
        window.confirm(
          "Send this notification only to this user?",
        );


      if (
        !confirmed
      ) {
        return;
      }


      try {

        setIsSendingNotification(
          true,
        );


        setNotificationStatus(
          null,
        );


        await sendAdminGenZGamesNotification({
          recipientType:
            "user",

          userId:
            selectedUserId,

          title:
            cleanTitle,

          message:
            cleanMessage,
        });


        setNotificationTitle(
          "",
        );


        setNotificationMessage(
          "",
        );


        setNotificationStatus(
          "Notification sent successfully.",
        );

      } catch (error) {

        console.error(
          "Unable to send notification to user:",
          error,
        );


        setNotificationStatus(
          "Unable to send notification.",
        );

      } finally {

        setIsSendingNotification(
          false,
        );
      }
    };


  const closeUser =
    () => {

      setSelectedUserId(
        null,
      );


      setSelectedUser(
        null,
      );


      setShowNotificationComposer(
        false,
      );


      setNotificationTitle(
        "",
      );


      setNotificationMessage(
        "",
      );


      setNotificationStatus(
        null,
      );
    };


  const query =
    searchTerm
      .trim()
      .toLowerCase();


  const filteredUsers =
    users.filter(
      (
        user,
      ) => {

        if (
          !query
        ) {
          return true;
        }


        return (
          user.displayName
            .toLowerCase()
            .includes(
              query,
            ) ||
          user.email
            .toLowerCase()
            .includes(
              query,
            ) ||
          user.country
            .toLowerCase()
            .includes(
              query,
            ) ||
          user.userId
            .toLowerCase()
            .includes(
              query,
            )
        );
      },
    );


  if (
    selectedUserId
  ) {

    return (
      <div className="space-y-4">

        <button
          type="button"
          onClick={
            closeUser
          }
          className="flex items-center gap-2 text-xs font-black text-orange-500"
        >

          <ArrowLeft className="h-4 w-4" />

          Back to Users

        </button>


        {isLoadingDetails ? (

          <div className="flex min-h-64 items-center justify-center rounded-3xl border app-border app-surface">

            <p className="text-xs app-text-muted">
              Loading user details...
            </p>

          </div>

        ) : selectedUser ? (

          <div className="space-y-4">

            <section className="rounded-3xl border app-border app-surface p-5">

              <div className="flex items-center gap-4">

                {selectedUser
                  .user
                  .photoUrl ? (

                  <img
                    src={
                      selectedUser
                        .user
                        .photoUrl
                    }
                    alt={
                      selectedUser
                        .user
                        .displayName
                    }
                    className="h-16 w-16 rounded-full object-cover"
                  />

                ) : (

                  <div className="flex h-16 w-16 items-center justify-center rounded-full app-surface-secondary">

                    <UserCircle className="h-9 w-9 app-text-muted" />

                  </div>

                )}


                <div className="min-w-0">

                  <h2 className="truncate text-lg font-black">
                    {
                      selectedUser
                        .user
                        .displayName
                    }
                  </h2>

                  <p className="mt-1 text-xs app-text-muted">
                    {
                      selectedUser
                        .user
                        .role
                    }
                    {" • "}
                    {
                      selectedUser
                        .user
                        .accountStatus
                    }
                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={() => {

                  setShowNotificationComposer(
                    (
                      current,
                    ) =>
                      !current,
                  );


                  setNotificationStatus(
                    null,
                  );
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black text-white transition hover:bg-orange-600"
              >

                <Bell className="h-4 w-4" />

                {
                  showNotificationComposer
                    ? "Close Notification"
                    : "Send Notification"
                }

              </button>


              {showNotificationComposer && (

                <div className="mt-4 rounded-2xl border app-border app-surface-secondary p-4">

                  <div className="flex items-center gap-2">

                    <Bell className="h-4 w-4 text-orange-500" />

                    <p className="text-sm font-black">
                      Notify {
                        selectedUser
                          .user
                          .displayName
                      }
                    </p>

                  </div>


                  <div className="mt-4">

                    <div className="flex items-center justify-between gap-3">

                      <label className="text-[10px] font-black uppercase tracking-wider app-text-muted">
                        Title
                      </label>


                      <span className="text-[10px] app-text-muted">
                        {
                          notificationTitle.length
                        }
                        /80
                      </span>

                    </div>


                    <input
                      type="text"
                      value={
                        notificationTitle
                      }
                      maxLength={
                        80
                      }
                      onChange={(
                        event,
                      ) =>
                        setNotificationTitle(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Example: Special Reward Update"
                      className="mt-2 w-full rounded-xl border app-border app-input px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />

                  </div>


                  <div className="mt-4">

                    <div className="flex items-center justify-between gap-3">

                      <label className="text-[10px] font-black uppercase tracking-wider app-text-muted">
                        Message
                      </label>


                      <span className="text-[10px] app-text-muted">
                        {
                          notificationMessage.length
                        }
                        /500
                      </span>

                    </div>


                    <textarea
                      value={
                        notificationMessage
                      }
                      maxLength={
                        500
                      }
                      rows={
                        4
                      }
                      onChange={(
                        event,
                      ) =>
                        setNotificationMessage(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Write a message for this user..."
                      className="mt-2 w-full resize-none rounded-xl border app-border app-input px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />

                  </div>


                  {notificationStatus && (

                    <p className="mt-3 text-xs app-text-muted">
                      {
                        notificationStatus
                      }
                    </p>

                  )}


                  <button
                    type="button"
                    disabled={
                      isSendingNotification
                    }
                    onClick={() =>
                      void sendNotificationToSelectedUser()
                    }
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    <Send className="h-4 w-4" />

                    {
                      isSendingNotification
                        ? "Sending..."
                        : "Send to This User"
                    }

                  </button>

                </div>

              )}


              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <Mail className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Email
                  </p>
                  <p className="mt-1 break-all text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .email ||
                      "—"
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <Phone className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Phone
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .phoneNumber ||
                      "—"
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Country
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .country ||
                      "—"
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <UserCircle className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Date of Birth
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .dateOfBirth ||
                      "—"
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <Users className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Referral ID
                  </p>
                  <p className="mt-1 break-all text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .referralId ||
                      "—"
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface-secondary p-4">
                  <Users className="h-4 w-4 text-orange-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Referred By
                  </p>
                  <p className="mt-1 break-all text-xs font-bold">
                    {
                      selectedUser
                        .user
                        .referredByReferralId ||
                      "—"
                    }
                  </p>
                </div>

              </div>

            </section>


            <section>

              <div className="mb-3 flex items-center gap-2">

                <WalletCards className="h-5 w-5 text-orange-500" />

                <h3 className="font-black">
                  Wallet
                </h3>

              </div>


              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Balance
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      formatPaise(
                        selectedUser
                          .wallet
                          .balancePaise,
                      )
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Lifetime
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      formatPaise(
                        selectedUser
                          .wallet
                          .lifetimeEarningsPaise,
                      )
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Redeemed
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      formatPaise(
                        selectedUser
                          .wallet
                          .redeemedPaise,
                      )
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Pending
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      formatPaise(
                        selectedUser
                          .wallet
                          .pendingRedemptionPaise,
                      )
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <p className="mt-2 text-[10px] uppercase app-text-muted">
                    Diamonds
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      selectedUser
                        .wallet
                        .lifetimeDiamonds
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Referral Earnings
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      formatPaise(
                        selectedUser
                          .wallet
                          .referralEarningsPaise,
                      )
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Referred Users
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      selectedUser
                        .wallet
                        .referralUsersCount
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="text-[10px] uppercase app-text-muted">
                    Referral Rewards
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {
                      selectedUser
                        .wallet
                        .referralQualifiedEvents
                    }
                  </p>
                </div>

              </div>

            </section>


            <section>

              <div className="mb-3 flex items-center gap-2">

                <Gamepad2 className="h-5 w-5 text-orange-500" />

                <h3 className="font-black">
                  Game Progress
                </h3>

              </div>


              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Sudoku
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Completed: {
                      selectedUser.games
                        .sudoku
                        .completedLevels
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest unlocked: {
                      selectedUser.games
                        .sudoku
                        .highestUnlockedLevel
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Gold Mine
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Collections: {
                      selectedUser.games
                        .goldMine
                        .collectedCycles
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    2048
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .game2048
                        .completedRuns
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Best tile: {
                      selectedUser.games
                        .game2048
                        .bestTile
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    High score: {
                      selectedUser.games
                        .game2048
                        .highScore
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Snake
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .snake
                        .completedRuns
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest unlocked: {
                      selectedUser.games
                        .snake
                        .highestUnlockedLevel
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Best score: {
                      selectedUser.games
                        .snake
                        .bestScore
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Flappy Rocket
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .flappyRocket
                        .completedRuns
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Knife Hit
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .knifeHit
                        .completedRuns
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest cleared: {
                      selectedUser.games
                        .knifeHit
                        .highestLevelCleared
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Best score: {
                      selectedUser.games
                        .knifeHit
                        .bestScore
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Brick Breaker
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .brickBreaker
                        .completedRuns
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest unlocked: {
                      selectedUser.games
                        .brickBreaker
                        .highestUnlockedLevel
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest cleared: {
                      selectedUser.games
                        .brickBreaker
                        .highestLevelCleared
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Best score: {
                      selectedUser.games
                        .brickBreaker
                        .bestScore
                    }
                  </p>
                </div>


                <div className="rounded-2xl border app-border app-surface p-4">
                  <p className="font-black">
                    Candy Cascade
                  </p>
                  <p className="mt-2 text-xs app-text-muted">
                    Runs: {
                      selectedUser.games
                        .candyCascade
                        .completedRuns
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest unlocked: {
                      selectedUser.games
                        .candyCascade
                        .highestUnlockedLevel
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Highest cleared: {
                      selectedUser.games
                        .candyCascade
                        .highestLevelCleared
                    }
                  </p>
                  <p className="mt-1 text-xs app-text-muted">
                    Stars: {
                      selectedUser.games
                        .candyCascade
                        .totalStars
                    }
                  </p>
                </div>

              </div>

            </section>


            <p className="text-center text-[10px] app-text-muted">
              User created {
                formatDate(
                  selectedUser
                    .user
                    .createdAt,
                )
              }
            </p>

          </div>

        ) : (

          <div className="rounded-3xl border app-border app-surface p-6 text-center">

            <p className="text-xs app-text-muted">
              User details are unavailable.
            </p>

          </div>

        )}

      </div>
    );
  }


  return (
    <div className="space-y-5">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h2 className="flex items-center gap-2 text-lg font-bold">

            <Users className="h-5 w-5 text-orange-500" />

            GenZGames Users

          </h2>

          <p className="mt-1 text-xs app-text-muted">
            Load user details only when needed.
          </p>

        </div>


        <button
          type="button"
          onClick={() =>
            void loadUsers(
              false,
            )
          }
          className="flex h-10 items-center justify-center gap-2 rounded-xl border app-border app-surface px-3 text-xs font-black"
        >

          <RefreshCw className="h-4 w-4" />

          Refresh

        </button>

      </div>


      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        <div className="rounded-2xl border app-border app-surface p-4">

          <p className="text-[10px] uppercase tracking-wider app-text-muted">
            Total Users
          </p>

          <p className="mt-2 text-2xl font-black">
            {
              totalUsers
            }
          </p>

        </div>


        <div className="rounded-2xl border app-border app-surface p-4">

          <p className="text-[10px] uppercase tracking-wider app-text-muted">
            Loaded
          </p>

          <p className="mt-2 text-2xl font-black">
            {
              users.length
            }
          </p>

        </div>

      </div>


      <div className="relative">

        <Search className="absolute left-3 top-3 h-4 w-4 app-text-muted" />

        <input
          type="text"
          value={
            searchTerm
          }
          onChange={(
            event,
          ) =>
            setSearchTerm(
              event.target
                .value,
            )
          }
          placeholder="Search loaded users..."
          className="w-full rounded-xl border app-border app-input py-3 pl-10 pr-4 text-xs outline-none focus:border-orange-500"
        />

      </div>


      {errorMessage && (

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">

          <p className="text-xs text-rose-500">
            {
              errorMessage
            }
          </p>

        </div>

      )}


      {isLoading ? (

        <div className="flex min-h-64 items-center justify-center rounded-3xl border app-border app-surface">

          <p className="text-xs app-text-muted">
            Loading users...
          </p>

        </div>

      ) : (

        <div className="space-y-3">

          {filteredUsers.map(
            (
              user,
            ) => (

              <button
                key={
                  user.userId
                }
                type="button"
                onClick={() =>
                  void openUser(
                    user.userId,
                  )
                }
                className="flex w-full items-center gap-3 rounded-2xl border app-border app-surface p-4 text-left transition hover:border-orange-500/40"
              >

                {user.photoUrl ? (

                  <img
                    src={
                      user.photoUrl
                    }
                    alt={
                      user.displayName
                    }
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                ) : (

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full app-surface-secondary">

                    <UserCircle className="h-6 w-6 app-text-muted" />

                  </div>

                )}


                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-black">
                    {
                      user.displayName
                    }
                  </p>

                  <p className="mt-1 truncate text-[10px] app-text-muted">
                    {
                      user.email ||
                      "No email"
                    }

                    {user.country
                      ? ` • ${user.country}`
                      : ""}
                  </p>

                </div>


                <ChevronRight className="h-4 w-4 shrink-0 app-text-muted" />

              </button>

            ),
          )}


          {filteredUsers.length ===
            0 && (

            <div className="rounded-3xl border app-border app-surface p-6 text-center">

              <Users className="mx-auto h-8 w-8 app-text-muted" />

              <p className="mt-3 text-sm font-black">
                No users found
              </p>

            </div>

          )}


          {nextCursorUserId &&
            !query && (

            <button
              type="button"
              disabled={
                isLoadingMore
              }
              onClick={() =>
                void loadUsers(
                  true,
                )
              }
              className="w-full rounded-xl border app-border app-surface py-3 text-xs font-black disabled:opacity-50"
            >

              {
                isLoadingMore
                  ? "Loading..."
                  : "Load 20 More Users"
              }

            </button>

          )}

        </div>

      )}

    </div>
  );
};