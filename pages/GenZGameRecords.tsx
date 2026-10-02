import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Crown,
  RefreshCw,
  Trophy,
} from "lucide-react";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";

import type {
  GenZGameRecordGameId,
  GenZGameRecordPlayer,
  GetGenZGamesRecordsResponse,
} from "../services/cloudflare/stream";

import {
  useAuth,
} from "../context/AuthContext";


const GAME_CONFIG:
  Array<{
    id:
      GenZGameRecordGameId;

    name:
      string;

    emoji:
      string;

    metric:
      "score" |
      "level";
  }> = [
    {
      id:
        "2048",

      name:
        "2048",

      emoji:
        "🔢",

      metric:
        "score",
    },

    {
      id:
        "snake",

      name:
        "Snake",

      emoji:
        "🐍",

      metric:
        "score",
    },

    {
      id:
        "flappyRocket",

      name:
        "Flappy Rocket",

      emoji:
        "🚀",

      metric:
        "score",
    },

    {
      id:
        "knifeHit",

      name:
        "Knife Hit",

      emoji:
        "🔪",

      metric:
        "level",
    },

    {
      id:
        "brickBreaker",

      name:
        "Brick Breaker",

      emoji:
        "🧱",

      metric:
        "level",
    },

    {
      id:
        "candyCascade",

      name:
        "Candy Cascade",

      emoji:
        "🍬",

      metric:
        "level",
    },
  ];


const medalForRank =
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


    return "🥉";
  };


const formatSudokuTime =
  (
    seconds:
      number,
  ) => {

    const minutes =
      Math.floor(
        seconds /
          60,
      );


    const remaining =
      seconds %
      60;


    return `${minutes}:${remaining
      .toString()
      .padStart(
        2,
        "0",
      )}`;
  };


export const GenZGameRecords:
React.FC = () => {

  const {
    currentUser,
    addToast,
  } =
    useAuth();


  const [
    sudokuPage,
    setSudokuPage,
  ] =
    useState(
      0,
    );


  const [
    data,
    setData,
  ] =
    useState<
      GetGenZGamesRecordsResponse |
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


  const loadRecords =
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
              .getGenZGamesRecords(
                sudokuPage,
              );


          setData(
            result,
          );

        } catch (
          error
        ) {

          console.error(
            "Unable to load GenZGames records:",
            error,
          );


          addToast(
            "Unable to load game records.",
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
        sudokuPage,
        addToast,
      ],
    );


  useEffect(
    () => {

      void loadRecords();

    },
    [
      loadRecords,
    ],
  );


  const sudokuByLevel =
    useMemo(
      () => {

        const map =
          new Map<
            number,
            GetGenZGamesRecordsResponse[
              "sudoku"
            ][
              "records"
            ][number]
          >();


        data
          ?.sudoku
          .records
          .forEach(
            record => {

              map.set(
                record.level,
                record,
              );
            },
          );


        return map;
      },
      [
        data,
      ],
    );


  const renderPlayer =
    (
      player:
        GenZGameRecordPlayer,

      metric:
        "score" |
        "level",
    ) => {

      const isCurrentUser =
        player.userId ===
        currentUser
          ?.id;


      return (
        <div
          key={
            player.userId
          }
          className={`
            flex
            items-center
            gap-3
            rounded-2xl
            border
            p-3
            ${
              isCurrentUser
                ? "border-cyan-400/40 bg-cyan-400/10"
                : "app-border app-surface-secondary"
            }
          `}
        >
          <div className="text-xl">
            {
              medalForRank(
                player.rank,
              )
            }
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
                  className="h-9 w-9 rounded-full object-cover"
                />
              )
            : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-xs font-black text-orange-500">
                  {
                    player
                      .gamerName
                      .slice(
                        0,
                        1,
                      )
                      .toUpperCase()
                  }
                </div>
              )}


          <div className="min-w-0 flex-1">

            <p className="truncate text-xs font-black">
              {
                player.gamerName
              }

              {isCurrentUser && (
                <span className="ml-2 text-[8px] text-cyan-500">
                  YOU
                </span>
              )}
            </p>

          </div>


          <p className="shrink-0 text-sm font-black text-orange-500">
            {
              metric ===
              "level"
                ? `Level ${player.value}`
                : `${player.value.toLocaleString()} pts`
            }
          </p>
        </div>
      );
    };


  if (
    !currentUser
  ) {

    return (
      <div className="mt-5 rounded-3xl border app-border app-surface p-8 text-center">

        <Trophy className="mx-auto h-10 w-10 text-orange-500" />

        <h3 className="mt-3 font-black">
          Sign in to view Game Records
        </h3>

      </div>
    );
  }


  return (
    <div className="mt-5 pb-8">

      <div className="flex items-center justify-between gap-3">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            Hall of Fame
          </p>

          <h2 className="mt-1 text-2xl font-black">
            All-Time Records
          </h2>

          <p className="mt-1 text-xs app-text-muted">
            Beat the record and take the champion spot.
          </p>

        </div>


        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            void loadRecords()
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border app-border app-surface"
          aria-label="Refresh records"
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


      <div className="mt-5 space-y-4">

        {GAME_CONFIG.map(
          game => {

            const players =
              data
                ?.games[
                  game.id
                ]
                ?.players ??
              [];


            return (
              <div
                key={
                  game.id
                }
                className="rounded-3xl border app-border app-surface p-4"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-xl">
                    {
                      game.emoji
                    }
                  </div>


                  <div className="flex-1">

                    <p className="text-sm font-black">
                      {
                        game.name
                      }
                    </p>

                    <p className="text-[10px] app-text-muted">
                      {
                        game.metric ===
                        "level"
                          ? "Highest level cleared"
                          : "Highest verified score"
                      }
                    </p>

                  </div>


                  <Crown className="h-5 w-5 text-amber-500" />

                </div>


                <div className="mt-3 space-y-2">

                  {players.length >
                  0
                    ? players.map(
                        player =>
                          renderPlayer(
                            player,
                            game.metric,
                          ),
                      )
                    : (
                        <div className="rounded-2xl app-surface-secondary p-4 text-center text-xs app-text-muted">
                          No record yet. Be the first champion.
                        </div>
                      )}

                </div>

              </div>
            );
          },
        )}

      </div>


      {/* Sudoku */}
      <div className="mt-6 rounded-3xl border app-border app-surface p-4">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-xl">
            🧩
          </div>


          <div className="flex-1">

            <p className="text-sm font-black">
              Sudoku Champions
            </p>

            <p className="text-[10px] app-text-muted">
              Fastest verified time for each level
            </p>

          </div>


          <Trophy className="h-5 w-5 text-orange-500" />

        </div>


        <div className="mt-4 flex items-center justify-between">

          <button
            type="button"
            disabled={
              sudokuPage <=
              0 ||
              loading
            }
            onClick={() =>
              setSudokuPage(
                previous =>
                  Math.max(
                    0,
                    previous -
                      1,
                  ),
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border app-border app-surface-secondary disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>


          <p className="text-xs font-black">
            Levels
            {" "}
            {
              data
                ?.sudoku
                .startLevel ??
              sudokuPage *
                100 +
              1
            }
            –
            {
              data
                ?.sudoku
                .endLevel ??
              Math.min(
                1000,
                sudokuPage *
                  100 +
                100,
              )
            }
          </p>


          <button
            type="button"
            disabled={
              sudokuPage >=
                9 ||
              loading
            }
            onClick={() =>
              setSudokuPage(
                previous =>
                  Math.min(
                    9,
                    previous +
                      1,
                  ),
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border app-border app-surface-secondary disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

        </div>


        <div className="mt-4 space-y-2">

          {Array.from(
            {
              length:
                (
                  data
                    ?.sudoku
                    .endLevel ??
                  Math.min(
                    1000,
                    sudokuPage *
                      100 +
                    100,
                  )
                ) -
                (
                  data
                    ?.sudoku
                    .startLevel ??
                  sudokuPage *
                    100 +
                  1
                ) +
                1,
            },

            (
              _,
              index,
            ) =>
              (
                data
                  ?.sudoku
                  .startLevel ??
                sudokuPage *
                  100 +
                1
              ) +
              index,
          ).map(
            level => {

              const record =
                sudokuByLevel
                  .get(
                    level,
                  );


              return (
                <div
                  key={
                    level
                  }
                  className="flex items-center gap-3 rounded-2xl border app-border app-surface-secondary p-3"
                >

                  <div className="w-16 text-xs font-black">
                    Level
                    {" "}
                    {
                      level
                    }
                  </div>


                  {record
                    ? (
                        <>
                          <div className="text-lg">
                            🥇
                          </div>


                          <div className="min-w-0 flex-1">

                            <p className="truncate text-xs font-black">
                              {
                                record.gamerName
                              }
                            </p>

                          </div>


                          <p className="text-xs font-black text-orange-500">
                            {
                              formatSudokuTime(
                                record.elapsedSeconds,
                              )
                            }
                          </p>
                        </>
                      )
                    : (
                        <p className="flex-1 text-right text-[10px] app-text-muted">
                          No record yet
                        </p>
                      )}

                </div>
              );
            },
          )}

        </div>

      </div>

    </div>
  );
};