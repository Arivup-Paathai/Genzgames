import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  RefreshCw,
  Search,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../../services/firebase/firebase";


type GameRedemptionStatus =
  | "pending"
  | "paid"
  | "rejected";


interface AdminGameRedemption {
  id: string;

  userId: string;

  userName: string;

  username: string;

  email: string;

  amountPaise: number;

  currency: "INR";

  status:
    GameRedemptionStatus;

  upiIdMasked: string;

  requestedAt: string;

  updatedAt: string;

  paidAt?: string;

  rejectedAt?: string;

  paymentReference?: string;

  rejectionReason?: string;
}


interface GetAdminGenZGameRedemptionsResponse {
  redemptions:
    AdminGameRedemption[];
}


interface GetAdminGenZGameRedemptionDetailsRequest {
  redemptionId: string;
}


interface GetAdminGenZGameRedemptionDetailsResponse {
  redemptionId: string;

  userId: string;

  userName: string;

  username: string;

  amountPaise: number;

  upiId: string;

  upiIdMasked: string;

  status:
    GameRedemptionStatus;

  requestedAt: string;
}


interface ReviewGenZGameRedemptionRequest {
  redemptionId: string;

  status:
    | "paid"
    | "rejected";

  paymentReference?: string;

  reason?: string;
}


interface ReviewGenZGameRedemptionResponse {
  success: boolean;

  redemptionId: string;

  status:
    | "paid"
    | "rejected";
}


const getAdminGenZGameRedemptions =
  httpsCallable<
    void,
    GetAdminGenZGameRedemptionsResponse
  >(
    functions,
    "getAdminGenZGameRedemptions",
  );


const getAdminGenZGameRedemptionDetails =
  httpsCallable<
    GetAdminGenZGameRedemptionDetailsRequest,
    GetAdminGenZGameRedemptionDetailsResponse
  >(
    functions,
    "getAdminGenZGameRedemptionDetails",
  );


const reviewGenZGameRedemption =
  httpsCallable<
    ReviewGenZGameRedemptionRequest,
    ReviewGenZGameRedemptionResponse
  >(
    functions,
    "reviewGenZGameRedemption",
  );


const formatPaise =
  (
    paise: number,
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
    value: string,
  ) => {
    if (!value) {
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
      return "—";
    }


    return date.toLocaleString(
      "en-IN",
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      },
    );
  };


export const AdminGameRedemptions:
React.FC = () => {
  const [
    redemptions,
    setRedemptions,
  ] =
    useState<
      AdminGameRedemption[]
    >([]);


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      | "all"
      | GameRedemptionStatus
    >(
      "pending",
    );


  const [
    searchTerm,
    setSearchTerm,
  ] = useState(
    "",
  );


  const [
    isLoading,
    setIsLoading,
  ] = useState(
    true,
  );


  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(
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
    busyRedemptionId,
    setBusyRedemptionId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    visibleUpiRedemptionId,
    setVisibleUpiRedemptionId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    visibleUpiId,
    setVisibleUpiId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const loadRedemptions =
    async (
      showRefresh:
        boolean,
    ) => {
      try {
        if (
          showRefresh
        ) {
          setIsRefreshing(
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
          await getAdminGenZGameRedemptions();


        setRedemptions(
          result.data
            .redemptions,
        );
      } catch (error) {
        console.error(
          "Unable to load GenZGames redemptions:",
          error,
        );


        setErrorMessage(
          "Unable to load GenZGames redemption requests.",
        );
      } finally {
        setIsLoading(
          false,
        );

        setIsRefreshing(
          false,
        );
      }
    };


  useEffect(() => {
    void loadRedemptions(
      false,
    );
  }, []);


  const pendingCount =
    redemptions.filter(
      (
        redemption,
      ) =>
        redemption.status ===
        "pending",
    ).length;


  const paidCount =
    redemptions.filter(
      (
        redemption,
      ) =>
        redemption.status ===
        "paid",
    ).length;


  const rejectedCount =
    redemptions.filter(
      (
        redemption,
      ) =>
        redemption.status ===
        "rejected",
    ).length;


  const pendingAmountPaise =
    redemptions
      .filter(
        (
          redemption,
        ) =>
          redemption.status ===
          "pending",
      )
      .reduce(
        (
          total,
          redemption,
        ) =>
          total +
          redemption
            .amountPaise,
        0,
      );


  const filteredRedemptions =
    useMemo(
      () => {
        const query =
          searchTerm
            .trim()
            .toLowerCase();


        return redemptions.filter(
          (
            redemption,
          ) => {
            if (
              statusFilter !==
                "all" &&
              redemption.status !==
                statusFilter
            ) {
              return false;
            }


            if (!query) {
              return true;
            }


            return (
              redemption
                .userName
                .toLowerCase()
                .includes(
                  query,
                ) ||
              redemption
                .username
                .toLowerCase()
                .includes(
                  query,
                ) ||
              redemption
                .email
                .toLowerCase()
                .includes(
                  query,
                ) ||
              redemption
                .upiIdMasked
                .toLowerCase()
                .includes(
                  query,
                ) ||
              redemption
                .id
                .toLowerCase()
                .includes(
                  query,
                )
            );
          },
        );
      },
      [
        redemptions,
        searchTerm,
        statusFilter,
      ],
    );


  const handleViewUpi =
    async (
      redemptionId:
        string,
    ) => {
      if (
        visibleUpiRedemptionId ===
        redemptionId
      ) {
        setVisibleUpiRedemptionId(
          null,
        );

        setVisibleUpiId(
          null,
        );

        return;
      }


      try {
        setBusyRedemptionId(
          redemptionId,
        );

        setErrorMessage(
          null,
        );


        const result =
          await getAdminGenZGameRedemptionDetails(
            {
              redemptionId,
            },
          );


        setVisibleUpiRedemptionId(
          redemptionId,
        );

        setVisibleUpiId(
          result.data
            .upiId,
        );
      } catch (error) {
        console.error(
          "Unable to access protected GenZGames UPI:",
          error,
        );


        setErrorMessage(
          "Unable to access the protected UPI ID.",
        );
      } finally {
        setBusyRedemptionId(
          null,
        );
      }
    };


  const handleCopyUpi =
    async () => {
      if (
        !visibleUpiId
      ) {
        return;
      }


      try {
        await navigator
          .clipboard
          .writeText(
            visibleUpiId,
          );
      } catch (error) {
        console.error(
          "Unable to copy UPI ID:",
          error,
        );
      }
    };


  const handleMarkPaid =
    async (
      redemption:
        AdminGameRedemption,
    ) => {
      const reference =
        window.prompt(
          "Enter the UPI / UTR transaction reference:",
        );


      if (
        !reference ||
        !reference.trim()
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          `Confirm that ${formatPaise(
            redemption
              .amountPaise,
          )} was successfully transferred and this payout is complete?`,
        );


      if (
        !confirmed
      ) {
        return;
      }


      try {
        setBusyRedemptionId(
          redemption.id,
        );

        setErrorMessage(
          null,
        );


        await reviewGenZGameRedemption(
          {
            redemptionId:
              redemption.id,

            status:
              "paid",

            paymentReference:
              reference.trim(),
          },
        );


        setVisibleUpiRedemptionId(
          null,
        );

        setVisibleUpiId(
          null,
        );


        await loadRedemptions(
          false,
        );
      } catch (error) {
        console.error(
          "Unable to mark GenZGames redemption paid:",
          error,
        );


        setErrorMessage(
          "Unable to mark this redemption as complete.",
        );
      } finally {
        setBusyRedemptionId(
          null,
        );
      }
    };


  const handleReject =
    async (
      redemption:
        AdminGameRedemption,
    ) => {
      const reason =
        window.prompt(
          "Enter the reason for rejecting this redemption:",
        );


      if (
        !reason ||
        !reason.trim()
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          `Reject this ${formatPaise(
            redemption
              .amountPaise,
          )} redemption and return the amount to the user's Game Balance?`,
        );


      if (
        !confirmed
      ) {
        return;
      }


      try {
        setBusyRedemptionId(
          redemption.id,
        );

        setErrorMessage(
          null,
        );


        await reviewGenZGameRedemption(
          {
            redemptionId:
              redemption.id,

            status:
              "rejected",

            reason:
              reason.trim(),
          },
        );


        setVisibleUpiRedemptionId(
          null,
        );

        setVisibleUpiId(
          null,
        );


        await loadRedemptions(
          false,
        );
      } catch (error) {
        console.error(
          "Unable to reject GenZGames redemption:",
          error,
        );


        setErrorMessage(
          "Unable to reject this redemption.",
        );
      } finally {
        setBusyRedemptionId(
          null,
        );
      }
    };


  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold app-text">
            <Gamepad2 className="h-5 w-5 text-orange-400" />

            GenZGames Payouts
          </h2>

          <p className="mt-1 text-xs app-text-muted">
            Process Game Balance redemption requests sent to users' saved UPI IDs.
          </p>
        </div>


        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 app-text-muted" />

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
              placeholder="Search game payouts..."
              className="w-full rounded-xl border app-border app-input py-2 pl-9 pr-3 text-xs app-text outline-none placeholder:text-[var(--app-text-muted)] transition focus:border-orange-500"
            />
          </div>


          <button
            type="button"
            onClick={() =>
              void loadRedemptions(
                true,
              )
            }
            disabled={
              isRefreshing
            }
            className="flex items-center justify-center rounded-xl border app-border app-surface px-3 app-text-secondary transition hover:text-orange-500 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isRefreshing ?
                  "animate-spin" :
                  ""
              }`}
            />
          </button>
        </div>
      </div>


      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border app-border app-surface p-4">
          <p className="text-[10px] uppercase tracking-wider app-text-muted">
            Total Requests
          </p>

          <p className="mt-2 text-xl font-bold app-text">
            {
              redemptions.length
            }
          </p>
        </div>


        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-400">
            Pending
          </p>

          <p className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-300">
            {
              pendingCount
            }
          </p>

          <p className="mt-1 text-[10px] text-amber-400/70">
            {
              formatPaise(
                pendingAmountPaise,
              )
            }
          </p>
        </div>


        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400">
            Paid
          </p>

          <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-300">
            {
              paidCount
            }
          </p>
        </div>


        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-rose-400">
            Rejected
          </p>

          <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-300">
            {
              rejectedCount
            }
          </p>
        </div>
      </div>


      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            [
              "pending",
              "Pending",
            ],
            [
              "paid",
              "Paid",
            ],
            [
              "rejected",
              "Rejected",
            ],
            [
              "all",
              "All",
            ],
          ] as const
        ).map(
          (
            [
              value,
              label,
            ],
          ) => (
            <button
              key={
                value
              }
              type="button"
              onClick={() =>
                setStatusFilter(
                  value,
                )
              }
              className={`shrink-0 rounded-xl border px-4 py-2 text-[10px] font-bold transition ${
                statusFilter ===
                value
                  ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                  : "app-border app-surface app-text-muted hover:text-orange-500"
              }`}
            >
              {
                label
              }
            </button>
          ),
        )}
      </div>


      {errorMessage && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
          <p className="text-xs text-rose-600 dark:text-rose-300">
            {
              errorMessage
            }
          </p>
        </div>
      )}


      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border app-border app-surface">
          <p className="text-xs app-text-muted">
            Loading GenZGames payouts...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRedemptions.map(
            (
              redemption,
            ) => {
              const isBusy =
                busyRedemptionId ===
                redemption.id;

              const upiVisible =
                visibleUpiRedemptionId ===
                redemption.id &&
                Boolean(
                  visibleUpiId,
                );


              return (
                <section
                  key={
                    redemption.id
                  }
                  className="rounded-3xl border app-border app-surface p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold app-text">
                          {
                            redemption
                              .userName
                          }
                        </h3>


                        <span
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${
                            redemption.status ===
                            "paid"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                              : redemption.status ===
                                  "rejected"
                                ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                          }`}
                        >
                          {redemption.status ===
                          "paid"
                            ? "Paid"
                            : redemption.status ===
                                "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </div>


                      <p className="mt-1 text-[10px] app-text-muted">
                        {redemption.username
                          ? `@${redemption.username}`
                          : "GenZGames User"}

                        {redemption.email
                          ? ` • ${redemption.email}`
                          : ""}
                      </p>
                    </div>


                    <p className="text-[10px] app-text-muted">
                      Requested{" "}
                      {
                        formatDate(
                          redemption
                            .requestedAt,
                        )
                      }
                    </p>
                  </div>


                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border app-border app-surface-secondary p-3">
                      <p className="text-[9px] uppercase app-text-muted">
                        Amount
                      </p>

                      <p className="mt-1 text-lg font-bold text-emerald-400">
                        {
                          formatPaise(
                            redemption
                              .amountPaise,
                          )
                        }
                      </p>
                    </div>


                    <div className="rounded-xl border app-border app-surface-secondary p-3">
                      <p className="text-[9px] uppercase app-text-muted">
                        UPI ID
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        <p className="font-mono text-xs font-semibold app-text">
                          {
                            upiVisible
                              ? visibleUpiId
                              : redemption
                                  .upiIdMasked
                          }
                        </p>


                        {upiVisible && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyUpi()
                            }
                            className="app-text-muted transition hover:text-orange-500"
                            aria-label="Copy UPI ID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>


                    <div className="rounded-xl border app-border app-surface-secondary p-3">
                      <p className="text-[9px] uppercase app-text-muted">
                        Request ID
                      </p>

                      <p className="mt-1 break-all font-mono text-[10px] app-text-secondary">
                        {
                          redemption.id
                        }
                      </p>
                    </div>
                  </div>


                  {redemption.paymentReference && (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-[9px] uppercase text-emerald-500">
                        UPI / UTR Reference
                      </p>

                      <p className="mt-1 font-mono text-xs text-emerald-600 dark:text-emerald-300">
                        {
                          redemption
                            .paymentReference
                        }
                      </p>
                    </div>
                  )}


                  {redemption.rejectionReason && (
                    <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <p className="text-[9px] uppercase text-rose-400">
                        Rejection Reason
                      </p>

                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                        {
                          redemption
                            .rejectionReason
                        }
                      </p>
                    </div>
                  )}


                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        isBusy
                      }
                      onClick={() =>
                        void handleViewUpi(
                          redemption.id,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border app-border app-surface-secondary px-3 py-2 text-[10px] font-semibold app-text-secondary transition hover:text-orange-500 disabled:opacity-50"
                    >
                      {upiVisible ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}

                      {upiVisible
                        ? "Hide UPI"
                        : "View UPI"}
                    </button>


                    {redemption.status ===
                      "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={() =>
                            void handleMarkPaid(
                              redemption,
                            )
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />

                          Mark Complete
                        </button>


                        <button
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={() =>
                            void handleReject(
                              redemption,
                            )
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-semibold text-rose-600 dark:text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          <TriangleAlert className="h-3.5 w-3.5" />

                          Reject
                        </button>
                      </>
                    )}
                  </div>


                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                    <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />

                    <p className="text-[10px] leading-relaxed app-text-muted">
                      Full UPI access is restricted to payout administrators and every access is written to the audit log.
                    </p>
                  </div>
                </section>
              );
            },
          )}


          {filteredRedemptions.length ===
            0 && (
            <div className="flex min-h-64 items-center justify-center rounded-3xl border app-border app-surface p-6">
              <div className="text-center">
                <Gamepad2 className="mx-auto h-8 w-8 app-text-muted" />

                <h3 className="mt-3 text-sm font-bold app-text">
                  No GenZGames payouts
                </h3>

                <p className="mt-2 text-xs app-text-muted">
                  Game redemption requests will appear here after users redeem their Game Balance.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};