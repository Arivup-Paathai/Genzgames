import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Crown,
  Medal,
  RefreshCw,
  Trophy,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";

import type {
  GenZLeaderboardPeriod,
  GenZLeaderboardPlayer,
  GetGenZGamesDailyLeaderboardResponse,
} from "../services/cloudflare/stream";


const getMedal =
  (
    rank:
      number,
  ) => {

    if (
      rank ===
      1
    ) {
      return "🥇";
    }


    if (
      rank ===
      2
    ) {
      return "🥈";
    }


    if (
      rank ===
      3
    ) {
      return "🥉";
    }


    return null;
  };


export const GenZLeaderboard:
React.FC = () => {

  const {
    currentUser,
    addToast,
  } = useAuth();


  const [
    period,
    setPeriod,
  ] =
    useState<
      GenZLeaderboardPeriod
    >(
      "today",
    );


  const [
    data,
    setData,
  ] =
    useState<
      GetGenZGamesDailyLeaderboardResponse |
      null
    >(
      null,
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );


  const [
    rankMovement,
    setRankMovement,
  ] =
    useState(
      0,
    );


  const loadLeaderboard =
    useCallback(
      async () => {

        if (
          !currentUser
        ) {
          setData(
            null,
          );

          return;
        }


        setLoading(
          true,
        );


        try {

          const result =
            await cloudflareR2
              .getGenZGamesDailyLeaderboard(
                period,
              );


          setData(
            result,
          );


          /*
           * Rank movement applies only to
           * the live/current day.
           */
          if (
            period ===
              "today" &&
            result.currentPlayer
          ) {

            const storageKey =
              `genzGamesRank:${result.dayKey}:${currentUser.id}`;


            const previousValue =
              window.localStorage
                .getItem(
                  storageKey,
                );


            const previousRank =
              previousValue
                ? Number(
                    previousValue,
                  )
                : 0;


            const currentRank =
              result
                .currentPlayer
                .rank;


            if (
              Number.isFinite(
                previousRank,
              ) &&
              previousRank >
                0 &&
              currentRank >
                0
            ) {

              setRankMovement(
                previousRank -
                currentRank,
              );

            } else {

              setRankMovement(
                0,
              );
            }


            window.localStorage
              .setItem(
                storageKey,
                String(
                  currentRank,
                ),
              );

          } else {

            setRankMovement(
              0,
            );
          }

        } catch (
          error
        ) {

          console.error(
            "Unable to load GenZGames leaderboard:",
            error,
          );


          addToast(
            "Unable to load the leaderboard.",
            "error",
          );

        } finally {

          setLoading(
            false,
          );
        }
      },
      [
        currentUser,
        period,
        addToast,
      ],
    );


  useEffect(
    () => {

      void loadLeaderboard();

    },
    [
      loadLeaderboard,
    ],
  );


  if (
    !currentUser
  ) {
    return (
      <div className="mt-5 rounded-3xl border app-border app-surface p-8 text-center">

        <Trophy className="mx-auto h-10 w-10 text-orange-500" />

        <h3 className="mt-3 font-black">
          Sign in to view the leaderboard
        </h3>

        <p className="mt-2 text-xs app-text-muted">
          Play games, collect diamonds and compete every day.
        </p>

      </div>
    );
  }


  const renderPlayer =
    (
      player:
        GenZLeaderboardPlayer,
    ) => {

      const isCurrentUser =
        player.userId ===
        currentUser.id;


      const medal =
        getMedal(
          player.rank,
        );


      const showMovement =
        period ===
          "today" &&
        isCurrentUser &&
        rankMovement !==
          0;


      return (
        <div
          key={
            player.userId
          }
          className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
            isCurrentUser
              ? "border-cyan-400/40 bg-cyan-400/10 animate-[genzRankEntry_500ms_ease-out]"
              : "app-border app-surface"
          }`}
        >

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl app-surface-secondary text-sm font-black">

            {medal
              ? (
                  <span className="text-xl">
                    {
                      medal
                    }
                  </span>
                )
              : (
                  `#${player.rank}`
                )}

          </div>


          {player.photoUrl
            ? (
                <img
                  src={
                    player.photoUrl
                  }
                  alt={
                    player.gamerName
                  }
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              )
            : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-sm font-black text-orange-500">
                  {
                    player.gamerName
                      .slice(
                        0,
                        1,
                      )
                      .toUpperCase()
                  }
                </div>
              )}


          <div className="min-w-0 flex-1">

            <div className="flex items-center gap-1.5">

              <p className="truncate text-sm font-black">
                {
                  player.gamerName
                }
              </p>

              {isCurrentUser && (
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[8px] font-black uppercase text-cyan-500">
                  You
                </span>
              )}

            </div>


            {showMovement && (
              <div
                className={`mt-0.5 flex items-center gap-1 text-[10px] font-black ${
                  rankMovement >
                  0
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >

                {rankMovement >
                0
                  ? (
                      <ArrowUp className="h-3 w-3" />
                    )
                  : (
                      <ArrowDown className="h-3 w-3" />
                    )}


                {
                  Math.abs(
                    rankMovement,
                  )
                }

                {
                  rankMovement >
                  0
                    ? " positions"
                    : " positions"
                }

              </div>
            )}

          </div>


          <div className="shrink-0 text-right">

            <p className="text-sm font-black text-cyan-500">
              💎
              {" "}
              {
                player.diamonds
              }
            </p>

          </div>

        </div>
      );
    };


  return (
    <div className="mt-5">

      <style>
        {`
          @keyframes genzRankEntry {
            0% {
              opacity: 0.4;
              transform: translateY(12px) scale(0.98);
            }

            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>


      <div className="rounded-2xl border app-border app-surface p-1">

        <div className="grid grid-cols-2 gap-1">

          <button
            type="button"
            onClick={() =>
              setPeriod(
                "today",
              )
            }
            className={`rounded-xl px-3 py-3 text-xs font-black transition ${
              period ===
              "today"
                ? "bg-orange-500 text-white shadow"
                : "app-text-secondary"
            }`}
          >
            Today
          </button>


          <button
            type="button"
            onClick={() =>
              setPeriod(
                "yesterday",
              )
            }
            className={`rounded-xl px-3 py-3 text-xs font-black transition ${
              period ===
              "yesterday"
                ? "bg-orange-500 text-white shadow"
                : "app-text-secondary"
            }`}
          >
            Yesterday
          </button>

        </div>

      </div>


      <div className="mt-4 flex items-center justify-between gap-3">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            Daily Diamond League
          </p>

          <h2 className="mt-1 text-xl font-black">
            {
              period ===
              "today"
                ? "Today's Top Players"
                : "Yesterday's Final Ranking"
            }
          </h2>


          {data?.dayKey && (
            <p className="mt-1 text-[10px] app-text-muted">
              {
                data.dayKey
              }
              {" "}
              • IST
            </p>
          )}

        </div>


        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            void loadLeaderboard()
          }
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border app-border app-surface disabled:opacity-50"
          aria-label="Refresh leaderboard"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading
                ? "animate-spin"
                : ""
            }`}
          />
        </button>

      </div>


      {loading &&
      !data ? (
        <div className="mt-5 rounded-3xl border app-border app-surface p-10 text-center">

          <RefreshCw className="mx-auto h-6 w-6 animate-spin app-text-muted" />

          <p className="mt-3 text-xs app-text-muted">
            Loading leaderboard...
          </p>

        </div>
      ) : data &&
        data.topPlayers.length >
          0 ? (
        <div className="mt-4 space-y-2">

          {data.topPlayers.map(
            (
              player,
            ) =>
              renderPlayer(
                player,
              ),
          )}

        </div>
      ) : (
        <div className="mt-5 rounded-3xl border app-border app-surface p-8 text-center">

          <Medal className="mx-auto h-9 w-9 text-cyan-500" />

          <h3 className="mt-3 font-black">
            No diamonds yet
          </h3>

          <p className="mt-2 text-xs app-text-muted">
            Be the first player to collect diamonds today.
          </p>

        </div>
      )}


      {data?.currentPlayer &&
        !data
          .isCurrentPlayerInTop10 && (
        <div className="mt-5">

          <div className="mb-2 flex items-center gap-2">

            <Crown className="h-4 w-4 text-cyan-500" />

            <p className="text-[10px] font-black uppercase tracking-[0.18em] app-text-muted">
              Your Rank
            </p>

          </div>

          {
            renderPlayer(
              data.currentPlayer,
            )
          }

        </div>
      )}


      <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">

        <p className="text-xs font-black text-cyan-500">
          💎 How to earn
        </p>

        <p className="mt-2 text-[11px] leading-relaxed app-text-secondary">
  Play GenZGames to earn diamonds and climb the daily leaderboard.
  {" "}
  Refer friends to earn bonus diamonds too.
</p>
      </div>

    </div>
  );
};