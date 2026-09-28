import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Gem,
  LoaderCircle,
  Pickaxe,
  Sparkles,
} from "lucide-react";

import type {
  GenZRealGoldMinerId,
  GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";


interface GenZRealGoldMinersProps {
  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onOpenMiner: (
    minerId:
      GenZRealGoldMinerId,
  ) => void;

  onBack:
    () => void;
}


const formatTime = (
  totalSeconds:
    number,
) => {
  const safe =
    Math.max(
      0,

      Math.floor(
        totalSeconds,
      ),
    );


  const minutes =
    Math.floor(
      safe /
        60,
    );

  const seconds =
    safe %
    60;


  return `${minutes}:${seconds
    .toString()
    .padStart(
      2,
      "0",
    )}`;
};


const formatGoldMg = (
  nanograms:
    number,
) => {
  const safeNanograms =
    Math.max(
      0,
      Math.floor(
        nanograms,
      ),
    );

  const milligrams =
    safeNanograms /
    1_000_000;


  return milligrams
    .toFixed(
      6,
    )
    .replace(
      /0+$/,
      "",
    )
    .replace(
      /\.$/,
      "",
    );
};


export const GenZRealGoldMiners:
React.FC<
  GenZRealGoldMinersProps
> = ({
  summary,
  onSummaryChange,
  onOpenMiner,
  onBack,
}) => {

  /*
   * Always open the Real Gold Miners list
   * from the top.
   */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;
  }, []);


  const [
    nowMillis,
    setNowMillis,
  ] = useState(
    Date.now(),
  );


  const [
    syncAnchorMillis,
    setSyncAnchorMillis,
  ] = useState(
    Date.now(),
  );


  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(
    false,
  );


  const miners =
    summary
      ?.realGold
      ?.miners ??
    [];


  const goldBalanceNanograms =
    summary
      ?.realGold
      ?.balanceNanograms ??
    0;


  const refreshSummary =
    useCallback(
      async () => {
        setIsRefreshing(
          true,
        );


        try {
          const result =
            await cloudflareR2
              .getGenZGamesSummary();


          onSummaryChange(
            result,
          );


          const now =
            Date.now();


          setSyncAnchorMillis(
            now,
          );

          setNowMillis(
            now,
          );

        } catch (error) {
          console.error(
            "Unable to refresh Real Gold Miners:",
            error,
          );

        } finally {
          setIsRefreshing(
            false,
          );
        }
      },
      [
        onSummaryChange,
      ],
    );


  useEffect(() => {
    void refreshSummary();
  }, [
    refreshSummary,
  ]);


  useEffect(() => {
    return registerNativeBackHandler(
      onBack,
    );
  }, [
    onBack,
  ]);


  useEffect(() => {
    const hasActiveMiner =
      miners.some(
        (
          miner,
        ) =>
          miner.status ===
          "mining",
      );


    if (
      !hasActiveMiner
    ) {
      return;
    }


    const timer =
      window.setInterval(
        () => {
          setNowMillis(
            Date.now(),
          );
        },
        1000,
      );


    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    miners,
  ]);


  const localSeconds =
    Math.max(
      0,

      Math.floor(
        (
          nowMillis -
          syncAnchorMillis
        ) /
          1000,
      ),
    );


  const displayMiners =
    useMemo(
      () =>
        miners.map(
          (
            miner,
          ) => {
            if (
              miner.status ===
              "idle"
            ) {
              return {
                ...miner,

                displayOre:
                  0,

                displayRemaining:
                  miner
                    .cycleSeconds,

                displayProgress:
                  0,

                displayStatus:
                  "idle" as const,
              };
            }


            const elapsed =
              miner.status ===
              "full"
                ? miner
                    .cycleSeconds
                : Math.min(
                    miner
                      .cycleSeconds,

                    miner
                      .elapsedSeconds +
                      localSeconds,
                  );


            const full =
              elapsed >=
              miner
                .cycleSeconds;


            const ore =
              full
                ? miner
                    .capacityOre
                : Math.min(
                    miner
                      .capacityOre,

                    Math.floor(
                      (
                        elapsed *
                        miner
                          .orePerMinute
                      ) /
                        60,
                    ),
                  );


            return {
              ...miner,

              displayOre:
                ore,

              displayRemaining:
                Math.max(
                  0,

                  miner
                    .cycleSeconds -
                    elapsed,
                ),

              displayProgress:
                Math.min(
                  100,

                  (
                    ore /
                    miner
                      .capacityOre
                  ) *
                    100,
                ),

              displayStatus:
                full
                  ? "full" as const
                  : "mining" as const,
            };
          },
        ),
      [
        miners,
        localSeconds,
      ],
    );


  return (
    <div
      className="
        min-h-full
        w-full
        bg-[var(--app-bg)]
        app-text
        pb-28
      "
      style={{
        paddingTop:
          "calc(env(safe-area-inset-top) + 8px)",
      }}
    >
      <div
        className="
          mx-auto
          w-full
          max-w-3xl
          px-4
          pb-5
          sm:px-6
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <button
              type="button"
              onClick={
                onBack
              }
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                border
                app-border
                app-surface
              "
              aria-label="Back to GenZGames"
            >
              <ArrowLeft
                className="
                  h-5
                  w-5
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
                Real Gold Mining
              </h1>

              <p
                className="
                  text-xs
                  app-text-muted
                "
              >
                2 independent gold miners
              </p>
            </div>
          </div>


          {isRefreshing && (
            <LoaderCircle
              className="
                h-5
                w-5
                animate-spin
                app-text-muted
              "
            />
          )}
        </div>


        <div
          className="
            mt-5
            rounded-[28px]
            border
            border-amber-500/20
            bg-gradient-to-br
            from-amber-500/10
            to-yellow-500/5
            p-5
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-amber-500/15
              "
            >
              <Pickaxe
                className="
                  h-6
                  w-6
                  text-amber-500
                "
              />
            </div>


            <div>
              <p
                className="
                  font-black
                "
              >
                Gold Mining Fleet
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  app-text-muted
                "
              >
                100 Gold Ore/min • 1,500 Ore • 15 Min
              </p>
            </div>
          </div>


          <div
            className="
              mt-4
              flex
              items-center
              justify-between
              rounded-2xl
              app-surface
              px-4
              py-3
            "
          >
            <span
              className="
                text-xs
                font-bold
                app-text-muted
              "
            >
              Reward per miner
            </span>

            <span
              className="
                font-black
                text-amber-500
              "
            >
              Gold + 10 💎
            </span>
          </div>


          <div
            className="
              mt-3
              flex
              items-center
              justify-between
              rounded-2xl
              app-surface
              px-4
              py-3
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <Sparkles
                className="
                  h-4
                  w-4
                  text-amber-500
                "
              />

              <span
                className="
                  text-xs
                  font-bold
                  app-text-muted
                "
              >
                Gold Balance
              </span>
            </div>

            <span
              className="
                font-black
                text-amber-500
              "
            >
              {
                formatGoldMg(
                  goldBalanceNanograms,
                )
              } mg
            </span>
          </div>
        </div>


        <div
          className="
            mt-5
            space-y-4
          "
        >
          {displayMiners.map(
            (
              miner,
            ) => {
              const isFull =
                miner
                  .displayStatus ===
                "full";

              const isMining =
                miner
                  .displayStatus ===
                "mining";


              return (
                <button
                  key={
                    miner.minerId
                  }
                  type="button"
                  onClick={() =>
                    onOpenMiner(
                      miner.minerId,
                    )
                  }
                  className="
                    w-full
                    rounded-[28px]
                    border
                    app-border
                    app-surface
                    p-5
                    text-left
                    shadow-sm
                    transition
                    active:scale-[0.99]
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
                    <div
                      className="
                        flex
                        items-center
                        gap-3
                      "
                    >
                      <div
                        className="
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          bg-amber-500/15
                        "
                      >
                        <Pickaxe
                          className="
                            h-6
                            w-6
                            text-amber-500
                          "
                        />
                      </div>


                      <div>
                        <p
                          className="
                            text-lg
                            font-black
                          "
                        >
                          Gold Miner {
                            miner.minerId
                          }
                        </p>

                        <p
                          className={`
                            mt-0.5
                            text-[10px]
                            font-black
                            uppercase
                            ${
                              isFull
                                ? "text-emerald-500"
                                : isMining
                                  ? "text-amber-500"
                                  : "app-text-muted"
                            }
                          `}
                        >
                          {
                            isFull
                              ? "Gold Ready"
                              : isMining
                                ? "Mining Gold"
                                : "Ready to Mine"
                          }
                        </p>
                      </div>
                    </div>


                    <ChevronRight
                      className="
                        mt-3
                        h-5
                        w-5
                        app-text-muted
                      "
                    />
                  </div>


                  <div
                    className="
                      mt-5
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <Gem
                        className="
                          h-4
                          w-4
                          text-amber-500
                        "
                      />

                      <span
                        className="
                          text-sm
                          font-black
                        "
                      >
                        {
                          miner
                            .displayOre
                        }
                        {" / "}
                        {
                          miner
                            .capacityOre
                        }
                        {" Gold Ore"}
                      </span>
                    </div>


                    <span
                      className="
                        text-xs
                        font-black
                        app-text-muted
                      "
                    >
                      {
                        Math.floor(
                          miner
                            .displayProgress,
                        )
                      }
                      %
                    </span>
                  </div>


                  <div
                    className="
                      mt-3
                      h-3
                      overflow-hidden
                      rounded-full
                      app-surface-secondary
                    "
                  >
                    <div
                      className={`
                        h-full
                        rounded-full
                        transition-[width]
                        duration-500
                        ${
                          isFull
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }
                      `}
                      style={{
                        width:
                          `${miner.displayProgress}%`,
                      }}
                    />
                  </div>


                  <div
                    className="
                      mt-4
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >
                    <div
                      className="
                        rounded-2xl
                        app-surface-secondary
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-1.5
                          text-[10px]
                          font-bold
                          app-text-muted
                        "
                      >
                        <Clock3
                          className="
                            h-3.5
                            w-3.5
                          "
                        />

                        {
                          isFull
                            ? "Ready"
                            : isMining
                              ? "Remaining"
                              : "Cycle"
                        }
                      </div>

                      <p
                        className="
                          mt-1
                          font-black
                        "
                      >
                        {
                          isFull
                            ? "Collect"
                            : formatTime(
                                miner
                                  .displayRemaining,
                              )
                        }
                      </p>
                    </div>


                    <div
                      className="
                        rounded-2xl
                        app-surface-secondary
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-1.5
                          text-[10px]
                          font-bold
                          app-text-muted
                        "
                      >
                        <Sparkles
                          className="
                            h-3.5
                            w-3.5
                          "
                        />

                        Reward
                      </div>

                      <p
                        className="
                          mt-1
                          font-black
                          text-amber-500
                        "
                      >
                        Gold + {
                          miner
                            .diamondsPerCollection
                        } 💎
                      </p>
                    </div>
                  </div>
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
};