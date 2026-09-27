import React, { useEffect, useState } from "react";
import { ArrowLeft, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

interface Notice {
  id:
    string;

  title:
    string;

  message:
    string;

  type:
    string;

  isRead:
    boolean;

  createdAt:
    string;

  scope?:
    "personal" |
    "global";
}
const getNotifications = httpsCallable<void, {notifications:Notice[]}>(functions, "getMiniGamesNotifications");
const markRead = httpsCallable<void, {success:boolean}>(functions, "markMiniGamesNotificationsRead");

export const Notifications: React.FC<{onBack:()=>void}> = ({ onBack }) => {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const response = (await getNotifications()).data;
      setItems(response.notifications);
      if (response.notifications.some((item) => !item.isRead)) await markRead();
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
  <div className="min-h-full app-bg app-text px-4 pb-5 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-6">
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onBack} className="h-10 w-10 rounded-full app-surface border app-border flex items-center justify-center"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1"><h1 className="text-xl font-black">Notifications</h1><p className="text-xs app-text-muted">
  Rewards, payments and GenZGames updates
</p></div>
        <button onClick={() => void load()} className="h-10 w-10 rounded-full app-surface border app-border flex items-center justify-center"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
            {loading ? (

        <div className="py-16 text-center app-text-muted">
          Loading…
        </div>

      ) : items.length ===
        0 ? (

        <div className="rounded-3xl app-surface border app-border p-10 text-center">

          <Bell className="mx-auto h-10 w-10 text-orange-500" />

          <p className="mt-3 font-black">
            No notifications yet
          </p>

        </div>

      ) : (

        <div className="space-y-3">

          {items.map(
            (
              item,
            ) => (

              <div
                key={
                  item.id
                }
                className="rounded-2xl app-surface border app-border p-4"
              >

                <div className="flex gap-3">

                  {item.type ===
                  "admin_message" ? (

                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />

                  ) : (

                    <CheckCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />

                  )}


                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <p className="font-black">
                        {
                          item.title
                        }
                      </p>


                      {item.scope ===
                        "global" && (

                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-orange-500">

                          GenZGames Update

                        </span>

                      )}

                    </div>


                    <p className="mt-1 text-sm app-text-secondary">

                      {
                        item.message
                      }

                    </p>


                    <p className="mt-2 text-[10px] app-text-muted">

                      {
                        item.createdAt
                          ? new Date(
                              item.createdAt,
                            )
                              .toLocaleString(
                                "en-IN",
                              )
                          : ""
                      }

                    </p>

                  </div>

                </div>

              </div>

            ),
          )}

        </div>

      )}
    </div>
  </div>
);
};
