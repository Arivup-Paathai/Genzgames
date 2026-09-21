import React from "react";

import {
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

import {
  AdminGameRedemptions,
} from "../components/admin/AdminGameRedemptions";


interface AdminPanelProps {
  onBack:
    () => void;
}


export const AdminPanel:
React.FC<
  AdminPanelProps
> = ({
  onBack,
}) => {

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

        <AdminGameRedemptions />

      </div>

    </div>
  );
};