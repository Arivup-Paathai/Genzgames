import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  Bell,
  Coins,
  LoaderCircle,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  AdminGameRedemptions,
} from "../components/admin/AdminGameRedemptions";

import {
  AdminGameUsers,
} from "../components/admin/AdminGameUsers";

import {
  AdminGameNotifications,
} from "../components/admin/AdminGameNotifications";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";


interface AdminPanelProps {
  onBack:
    () => void;
}


type AdminPanelTab =
  | "redemptions"
  | "users"
  | "notifications"
  | "goldRate";


export const AdminPanel:
React.FC<
  AdminPanelProps
> = ({
  onBack,
}) => {

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      AdminPanelTab
    >(
      "redemptions",
    );

  const [
    goldRate,
    setGoldRate,
  ] =
    useState(
      "12000",
    );

  const [
    savedGoldRate,
    setSavedGoldRate,
  ] =
    useState(
      12000,
    );

  const [
    goldRateUpdatedAt,
    setGoldRateUpdatedAt,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    usingDefaultGoldRate,
    setUsingDefaultGoldRate,
  ] =
    useState(
      true,
    );

  const [
    loadingGoldRate,
    setLoadingGoldRate,
  ] =
    useState(
      false,
    );

  const [
    savingGoldRate,
    setSavingGoldRate,
  ] =
    useState(
      false,
    );

  const [
    goldRateMessage,
    setGoldRateMessage,
  ] =
    useState(
      "",
    );


  const loadGoldRate =
    useCallback(
      async () => {

        setLoadingGoldRate(
          true,
        );

        try {
          const result =
            await cloudflareR2
              .getAdminGenZGamesGoldRate();

          setSavedGoldRate(
            result
              .goldRateRupeesPerGram,
          );

          setGoldRate(
            String(
              result
                .goldRateRupeesPerGram,
            ),
          );

          setGoldRateUpdatedAt(
            result.updatedAt,
          );

          setUsingDefaultGoldRate(
            result.usingDefault ===
              true,
          );

          setGoldRateMessage(
            "",
          );
        } catch (error) {
          console.error(
            "Unable to load gold rate:",
            error,
          );

          setGoldRateMessage(
            "Unable to load gold rate.",
          );
        } finally {
          setLoadingGoldRate(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      if (
        activeTab !==
        "goldRate"
      ) {
        return;
      }

      void loadGoldRate();
    },
    [
      activeTab,
      loadGoldRate,
    ],
  );


  const saveGoldRate =
    async () => {

      const value =
        Number(
          goldRate,
        );

      if (
        !Number.isFinite(
          value,
        ) ||
        value <=
          0
      ) {
        setGoldRateMessage(
          "Enter a valid gold rate.",
        );

        return;
      }

      setSavingGoldRate(
        true,
      );

      setGoldRateMessage(
        "",
      );

      try {
        const result =
          await cloudflareR2
            .saveAdminGenZGamesGoldRate(
              value,
            );

        setSavedGoldRate(
          result
            .goldRateRupeesPerGram,
        );

        setGoldRate(
          String(
            result
              .goldRateRupeesPerGram,
          ),
        );

        setGoldRateUpdatedAt(
          result.updatedAt,
        );

        setUsingDefaultGoldRate(
          false,
        );

        setGoldRateMessage(
          "Gold rate saved successfully.",
        );
      } catch (error) {
        console.error(
          "Unable to save gold rate:",
          error,
        );

        setGoldRateMessage(
          "Unable to save gold rate.",
        );
      } finally {
        setSavingGoldRate(
          false,
        );
      }
    };


  return (
    <div className="min-h-full app-bg app-text">

      <div
        className="sticky top-0 z-20 border-b app-border bg-[var(--app-bg)]/95 px-4 py-3 backdrop-blur"
        style={{
          paddingTop:
            "calc(env(safe-area-inset-top) + 12px)",
        }}
      >

        <div className="mx-auto flex max-w-5xl items-center gap-3">

          <button
            type="button"
            onClick={
              onBack
            }
            className="flex h-10 w-10 items-center justify-center rounded-full border app-border app-surface"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <ShieldCheck className="h-6 w-6 text-orange-500" />

          <div>
            <h1 className="font-black">
              Admin Panel
            </h1>

            <p className="text-xs app-text-muted">
              GenZGames administration
            </p>
          </div>

        </div>

      </div>


      <div className="mx-auto max-w-5xl px-3 py-4">

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border app-border app-surface p-1 sm:grid-cols-4">

          {[
            {
              id:
                "redemptions" as const,
              label:
                "Redemptions",
              icon:
                ShieldCheck,
            },
            {
              id:
                "users" as const,
              label:
                "Users",
              icon:
                Users,
            },
            {
              id:
                "notifications" as const,
              label:
                "Notifications",
              icon:
                Bell,
            },
            {
              id:
                "goldRate" as const,
              label:
                "Gold Rate",
              icon:
                Coins,
            },
          ].map(
            (
              item,
            ) => {

              const Icon =
                item.icon;

              return (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      item.id,
                    )
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-black transition ${
                    activeTab ===
                    item.id
                      ? "bg-orange-500 text-white shadow"
                      : "app-text-secondary hover:bg-[var(--app-hover)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />

                  {
                    item.label
                  }
                </button>
              );
            },
          )}

        </div>


        {activeTab ===
        "redemptions" ? (

          <AdminGameRedemptions />

        ) : activeTab ===
          "users" ? (

          <AdminGameUsers />

        ) : activeTab ===
          "notifications" ? (

          <AdminGameNotifications />

        ) : (

          <div className="rounded-3xl border app-border app-surface p-5">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
                <Coins className="h-6 w-6 text-amber-500" />
              </div>

              <div>
                <h2 className="font-black">
                  Real Gold Rate
                </h2>

                <p className="text-xs app-text-muted">
                  Change whenever the market rate changes
                </p>
              </div>

            </div>


            <div className="mt-5 rounded-2xl border app-border p-4">

              <p className="text-xs font-bold app-text-muted">
                Current Gold Rate
              </p>

              <p className="mt-1 text-3xl font-black text-amber-500">
                ₹
                {
                  savedGoldRate
                    .toLocaleString(
                      "en-IN",
                    )
                }
              </p>

              <p className="text-xs app-text-muted">
                per 1 gram
              </p>

              {usingDefaultGoldRate && (
                <p className="mt-2 text-[11px] font-bold text-orange-500">
                  Default backend rate
                </p>
              )}

            </div>


            <label className="mt-5 block">

              <span className="text-xs font-black">
                New Gold Rate (₹ / gram)
              </span>

              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={
                  goldRate
                }
                onChange={(
                  event,
                ) =>
                  setGoldRate(
                    event
                      .target
                      .value,
                  )
                }
                className="mt-2 w-full rounded-2xl border app-border app-bg px-4 py-4 text-lg font-black outline-none focus:border-amber-500"
                placeholder="12000"
              />

            </label>


            <button
              type="button"
              disabled={
                savingGoldRate ||
                loadingGoldRate
              }
              onClick={() =>
                void saveGoldRate()
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 font-black text-black disabled:opacity-50"
            >

              {savingGoldRate ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}

              {
                savingGoldRate
                  ? "Saving..."
                  : "Save Gold Rate"
              }

            </button>


            {goldRateMessage && (
              <p className="mt-3 text-center text-xs font-bold app-text-secondary">
                {
                  goldRateMessage
                }
              </p>
            )}


            <div className="mt-5 rounded-2xl bg-amber-500/10 p-4">

              <p className="text-xs font-black">
                Real Gold Mining
              </p>

              <p className="mt-2 text-xs leading-5 app-text-secondary">
                The latest saved rate is used when a player collects Real Gold. Changing this rate does not change gold the player already owns.
              </p>

            </div>


            <p className="mt-4 text-[11px] app-text-muted">
              Last updated:{" "}
              {
                goldRateUpdatedAt
                  ? new Date(
                      goldRateUpdatedAt,
                    ).toLocaleString(
                      "en-IN",
                    )
                  : "Not updated yet"
              }
            </p>

          </div>

        )}

      </div>

    </div>
  );
};