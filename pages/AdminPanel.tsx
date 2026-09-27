import React, {
  useState,
} from "react";

import {
  ArrowLeft,
  Bell,
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

interface AdminPanelProps {
  onBack:
    () => void;
}

type AdminPanelTab =
  | "redemptions"
  | "users"
  | "notifications";

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
              GenZGames payout requests
            </p>

          </div>

        </div>

      </div>


      <div className="mx-auto max-w-5xl px-3 py-4">

        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border app-border app-surface p-1">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "redemptions",
              )
            }
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${
              activeTab ===
              "redemptions"
                ? "bg-orange-500 text-white shadow"
                : "app-text-secondary hover:bg-[var(--app-hover)]"
            }`}
          >

            <ShieldCheck className="h-4 w-4" />

            Redemptions

          </button>


          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "users",
              )
            }
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${
              activeTab ===
              "users"
                ? "bg-orange-500 text-white shadow"
                : "app-text-secondary hover:bg-[var(--app-hover)]"
            }`}
          >

            <Users className="h-4 w-4" />

            Users

          </button>

                    <button
            type="button"
            onClick={() =>
              setActiveTab(
                "notifications",
              )
            }
            className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-black transition ${
              activeTab ===
              "notifications"
                ? "bg-orange-500 text-white shadow"
                : "app-text-secondary hover:bg-[var(--app-hover)]"
            }`}
          >

            <Bell className="h-4 w-4" />

            Notifications

          </button>

        </div>


        {activeTab ===
        "redemptions" ? (

          <AdminGameRedemptions />

        ) : activeTab ===
          "users" ? (

          <AdminGameUsers />

        ) : (

          <AdminGameNotifications />

        )}

      </div>

    </div>
  );
};