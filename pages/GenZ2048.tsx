import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Play,
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
  CompleteGenZ2048RunResponse,
  GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  showGenZGamesRewardedAd,
} from "../services/admob";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  playGameSound,
} from "../audioManager";

import {
  DiamondCounter,
} from "../components/DiamondCounter";

import {
  DiamondFlyReward,
} from "../components/DiamondFlyReward";

import {
  formatGamePaise,
} from "../services/genzGames";


type Board = number[][];

type MoveDirection =
  | "up"
  | "down"
  | "left"
  | "right";


interface Saved2048Run {
  version: 1;

  runId: string;

  seed: number;

  board: Board;

  score: number;

  elapsedSeconds: number;

  moves:
    MoveDirection[];

  randomStep: number;

  freeUndoUsed: boolean;

  history: Array<{
    board: Board;

    score: number;

    elapsedSeconds: number;

    moves:
      MoveDirection[];

    randomStep: number;
  }>;

  rewardClaimed: boolean;

  continueEndless: boolean;

  startedAt: number;

  updatedAt: number;
}


interface Runtime2048Run
  extends Saved2048Run {}


interface GenZ2048Props {
  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onBack: () => void;
}


const SIZE =
  4;


const STORAGE_KEY =
  "genzgames_2048_active_run_v1";


const cloneBoard = (
  board: Board,
): Board =>
  board.map(
    row => [
      ...row,
    ],
  );


const createEmptyBoard =
  (): Board =>
    Array.from(
      {
        length:
          SIZE,
      },
      () =>
        Array(
          SIZE,
        ).fill(
          0,
        ),
    );


const createSeededRandom = (
  seed: number,
) => {

  let value =
    seed >>> 0;


  return () => {

    value =
      (
        value +
        0x6d2b79f5
      ) >>>
      0;


    let result =
      value;


    result =
      Math.imul(
        result ^
          (
            result >>>
            15
          ),
        result |
          1,
      );


    result ^=
      result +
      Math.imul(
        result ^
          (
            result >>>
            7
          ),
        result |
          61,
      );


    return (
      (
        result ^
          (
            result >>>
            14
          )
      ) >>>
      0
    ) /
      4294967296;
  };
};


const randomAtStep = (
  seed: number,
  step: number,
) => {

  const random =
    createSeededRandom(
      seed,
    );


  let value =
    0;


  for (
    let index = 0;
    index <= step;
    index += 1
  ) {

    value =
      random();
  }


  return value;
};


const getEmptyCells = (
  board: Board,
) => {

  const cells:
    Array<{
      row: number;
      column: number;
    }> =
    [];


  for (
    let row = 0;
    row < SIZE;
    row += 1
  ) {

    for (
      let column = 0;
      column < SIZE;
      column += 1
    ) {

      if (
        board[row][column] ===
        0
      ) {

        cells.push({
          row,
          column,
        });
      }
    }
  }


  return cells;
};


const addSeededTile = (
  board: Board,
  seed: number,
  randomStep: number,
) => {

  const next =
    cloneBoard(
      board,
    );


  const empty =
    getEmptyCells(
      next,
    );


  if (
    empty.length ===
    0
  ) {

    return {
      board:
        next,

      randomStep,
    };
  }


  const cellRandom =
    randomAtStep(
      seed,
      randomStep,
    );


  const valueRandom =
    randomAtStep(
      seed,
      randomStep + 1,
    );


  const selected =
    empty[
      Math.min(
        empty.length - 1,

        Math.floor(
          cellRandom *
            empty.length,
        ),
      )
    ];


  next[
    selected.row
  ][
    selected.column
  ] =
    valueRandom <
    0.9
      ? 2
      : 4;


  return {
    board:
      next,

    randomStep:
      randomStep +
      2,
  };
};


const createInitialRunBoard = (
  seed: number,
) => {

  let board =
    createEmptyBoard();


  let randomStep =
    0;


  const first =
    addSeededTile(
      board,
      seed,
      randomStep,
    );


  board =
    first.board;

  randomStep =
    first.randomStep;


  const second =
    addSeededTile(
      board,
      seed,
      randomStep,
    );


  return {
    board:
      second.board,

    randomStep:
      second.randomStep,
  };
};


const reverseRows = (
  board: Board,
): Board =>
  board.map(
    row =>
      [
        ...row,
      ].reverse(),
  );


const transpose = (
  board: Board,
): Board => {

  const next =
    createEmptyBoard();


  for (
    let row = 0;
    row < SIZE;
    row += 1
  ) {

    for (
      let column = 0;
      column < SIZE;
      column += 1
    ) {

      next[
        column
      ][
        row
      ] =
        board[
          row
        ][
          column
        ];
    }
  }


  return next;
};
const slideRowLeft = (
  row: number[],
) => {

  const filtered =
    row.filter(
      value =>
        value !== 0,
    );


  const merged:
    number[] =
    [];


  let scoreGained =
    0;


  for (
    let index = 0;
    index <
      filtered.length;
    index += 1
  ) {

    if (
      filtered[index] ===
      filtered[index + 1]
    ) {

      const value =
        filtered[index] *
        2;


      playGameSound(
        "2048-merge",
        value,
      );


      merged.push(
        value,
      );


      scoreGained +=
        value;


      index += 1;

    } else {

      merged.push(
        filtered[index],
      );
    }
  }


  while (
    merged.length <
    SIZE
  ) {

    merged.push(
      0,
    );
  }


  return {
    row:
      merged,

    scoreGained,
  };
};


const moveLeft = (
  board: Board,
) => {

  let scoreGained =
    0;


  const next =
    board.map(
      row => {

        const result =
          slideRowLeft(
            row,
          );


        scoreGained +=
          result
            .scoreGained;


        return result
          .row;
      },
    );


  return {
    board:
      next,

    scoreGained,
  };
};


const moveBoard = (
  board: Board,

  direction:
    MoveDirection,
) => {

  if (
    direction ===
    "left"
  ) {

    return moveLeft(
      board,
    );
  }


  if (
    direction ===
    "right"
  ) {

    const moved =
      moveLeft(
        reverseRows(
          board,
        ),
      );


    return {
      board:
        reverseRows(
          moved.board,
        ),

      scoreGained:
        moved
          .scoreGained,
    };
  }


  if (
    direction ===
    "up"
  ) {

    const moved =
      moveLeft(
        transpose(
          board,
        ),
      );


    return {
      board:
        transpose(
          moved.board,
        ),

      scoreGained:
        moved
          .scoreGained,
    };
  }


  const transposed =
    transpose(
      board,
    );


  const moved =
    moveLeft(
      reverseRows(
        transposed,
      ),
    );


  return {
    board:
      transpose(
        reverseRows(
          moved.board,
        ),
      ),

    scoreGained:
      moved
        .scoreGained,
  };
};


const boardsEqual = (
  first: Board,
  second: Board,
) =>
  first.every(
    (
      row,
      rowIndex,
    ) =>
      row.every(
        (
          value,
          columnIndex,
        ) =>
          value ===
          second[
            rowIndex
          ][
            columnIndex
          ],
      ),
  );


const canMove = (
  board: Board,
) => {

  if (
    getEmptyCells(
      board,
    ).length >
    0
  ) {

    return true;
  }


  for (
    let row = 0;
    row <
      SIZE;
    row += 1
  ) {

    for (
      let column = 0;
      column <
        SIZE;
      column += 1
    ) {

      const value =
        board[row][column];


      if (
        row + 1 <
          SIZE &&
        board[
          row + 1
        ][column] ===
          value
      ) {

        return true;
      }


      if (
        column + 1 <
          SIZE &&
        board[row][
          column + 1
        ] ===
          value
      ) {

        return true;
      }
    }
  }


  return false;
};


const highestTile = (
  board: Board,
) =>
  Math.max(
    0,
    ...board.flat(),
  );


const formatTime = (
  seconds: number,
) => {

  const minutes =
    Math.floor(
      seconds / 60,
    );


  const remainder =
    seconds %
    60;


  return `${minutes}:${remainder
    .toString()
    .padStart(
      2,
      "0",
    )}`;
};


const getTileClasses = (
  value: number,
) => {

  switch (
    value
  ) {

    case 0:
      return "bg-black/5 dark:bg-white/5 text-transparent";

    case 2:
      return "bg-stone-100 text-stone-700";

    case 4:
      return "bg-orange-100 text-orange-900";

    case 8:
      return "bg-orange-400 text-white";

    case 16:
      return "bg-orange-500 text-white";

    case 32:
      return "bg-orange-600 text-white";

    case 64:
      return "bg-red-500 text-white";

    case 128:
      return "bg-amber-400 text-amber-950";

    case 256:
      return "bg-amber-500 text-white";

    case 512:
      return "bg-yellow-500 text-white";

    case 1024:
      return "bg-yellow-400 text-yellow-950";

    case 2048:
      return "bg-gradient-to-br from-[#FF4E00] to-amber-400 text-white";

    default:
      return "bg-slate-800 text-white";
  }
};


const getRewardPreview = (
  tile: number,
) => {

  if (
    tile >= 2048
  ) {

    return {
      paise: 5,
      diamonds: 10,
    };
  }


  if (
    tile >= 1024
  ) {

    return {
      paise: 4,
      diamonds: 7,
    };
  }


  if (
    tile >= 512
  ) {

    return {
      paise: 3,
      diamonds: 5,
    };
  }


  if (
    tile >= 256
  ) {

    return {
      paise: 2,
      diamonds: 3,
    };
  }


  if (
    tile >= 128
  ) {

    return {
      paise: 1,
      diamonds: 2,
    };
  }


  return {
    paise: 0,
    diamonds: 0,
  };
};
const createRunId = () => {

  const randomPart =
    Math.random()
      .toString(36)
      .slice(
        2,
        12,
      );


  const timePart =
    Date.now()
      .toString(36);


  return `${timePart}-${randomPart}`;
};


const createSeed = () => {

  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.getRandomValues ===
      "function"
  ) {

    const values =
      new Uint32Array(
        1,
      );


    crypto.getRandomValues(
      values,
    );


    return values[0] >>>
      0;
  }


  return Math.floor(
    Math.random() *
      4294967296,
  ) >>> 0;
};


const saveRun = (
  run:
    Runtime2048Run |
    null,
) => {

  if (
    !run
  ) {

    localStorage.removeItem(
      STORAGE_KEY,
    );

    return;
  }


  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(
      run,
    ),
  );
};


const loadRun = ():
Runtime2048Run | null => {

  const raw =
    localStorage.getItem(
      STORAGE_KEY,
    );


  if (
    !raw
  ) {

    return null;
  }


  try {

    const parsed =
      JSON.parse(
        raw,
      ) as Partial<Runtime2048Run>;


    if (
      parsed.version !==
        1 ||
      typeof parsed.runId !==
        "string" ||
      !Number.isInteger(
        parsed.seed,
      ) ||
      !Array.isArray(
        parsed.board,
      ) ||
      !Array.isArray(
        parsed.moves,
      )
    ) {

      localStorage.removeItem(
        STORAGE_KEY,
      );

      return null;
    }


    return parsed as
      Runtime2048Run;

  } catch {

    localStorage.removeItem(
      STORAGE_KEY,
    );

    return null;
  }
};


const createNewRun = (
  seed: number,
  runId: string,
):
Runtime2048Run => {

  const initial =
    createInitialRunBoard(
      seed,
    );


  const now =
    Date.now();


  return {
    version:
      1,

    runId,

    seed,

    board:
      initial.board,

    score:
      0,

    elapsedSeconds:
      0,

    moves:
      [],

    randomStep:
      initial.randomStep,

    freeUndoUsed:
      false,

    history:
      [],

    rewardClaimed:
      false,

    continueEndless:
      false,

    startedAt:
      now,

    updatedAt:
      now,
  };
};


export const GenZ2048:
React.FC<
  GenZ2048Props
> = ({
  summary,
  onSummaryChange,
  onBack,
}) => {

  const {
  currentUser,
} =
  useAuth();


  const [
    run,
    setRun,
  ] =
    useState<
      Runtime2048Run |
      null
    >(
      () =>
        loadRun(),
    );


  const [
    starting,
    setStarting,
  ] =
    useState(
      false,
    );


  const [
    claiming,
    setClaiming,
  ] =
    useState(
      false,
    );


  const [
    claimResult,
    setClaimResult,
  ] =
    useState<
      CompleteGenZ2048RunResponse |
      null
    >(
      null,
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
    showDiamondFly,
    setShowDiamondFly,
  ] =
    useState(
      false,
    );


  const touchStartRef =
    useRef<{
      x: number;
      y: number;
    } | null>(
      null,
    );


  const resultSoundRef =
    useRef<
      string |
      null
    >(
      null,
    );


  const currentHighestTile =
    useMemo(
      () =>
        run
          ? highestTile(
              run.board,
            )
          : 0,

      [
        run,
      ],
    );


  const currentReward =
    useMemo(
      () =>
        getRewardPreview(
          currentHighestTile,
        ),

      [
        currentHighestTile,
      ],
    );


  const gameOver =
    useMemo(
      () =>
        run
          ? !canMove(
              run.board,
            )
          : false,

      [
        run,
      ],
    );


  const reached2048 =
    currentHighestTile >=
    2048;


  const hasActiveRun =
    Boolean(
      run &&
      !run.rewardClaimed &&
      (
        !gameOver ||
        reached2048
      ),
    );


  /*
   * Play result sounds once per run state.
   *
   * Reaching 2048:
   * -> completion sound
   *
   * No moves remaining:
   * -> game-over sound
   *
   * Continue Endless can later produce
   * its own game-over sound.
   */
  useEffect(
    () => {

      if (
        !run
      ) {

        resultSoundRef
          .current =
          null;

        return;
      }


      if (
        reached2048 &&
        !run.continueEndless
      ) {

        const soundKey =
          `${run.runId}:2048`;


        if (
          resultSoundRef
            .current !==
          soundKey
        ) {

          resultSoundRef
            .current =
            soundKey;


          playGameSound(
            "game-complete",
          );
        }


        return;
      }


      if (
        gameOver
      ) {

        const soundKey =
          `${run.runId}:gameover`;


        if (
          resultSoundRef
            .current !==
          soundKey
        ) {

          resultSoundRef
            .current =
            soundKey;


          playGameSound(
            "game-failed",
          );
        }
      }

    },
    [
      run,
      reached2048,
      gameOver,
    ],
  );


      useEffect(
    () => {

      if (
        !run
      ) {
        return;
      }


      saveRun(
        run,
      );

    },
    [
      run,
    ],
  );


  useEffect(
    () => {

      if (
        !run ||
        gameOver ||
        (
          reached2048 &&
          !run.continueEndless
        ) ||
        (
          run.rewardClaimed &&
          !run.continueEndless
        )
      ) {

        return;
      }


      const timer =
        window.setInterval(
          () => {

            setRun(
              current => {

                if (
                  !current
                ) {
                  return current;
                }


                return {
                  ...current,

                  elapsedSeconds:
                    current
                      .elapsedSeconds +
                    1,

                  updatedAt:
                    Date.now(),
                };
              },
            );

          },
          1000,
        );


      return () => {

        window.clearInterval(
          timer,
        );
      };

    },
    [
      run?.runId,
      gameOver,
      reached2048,
      run?.rewardClaimed,
      run?.continueEndless,
    ],
  );


  useEffect(
    () => {

      return registerNativeBackHandler(
        onBack,
      );

    },
    [
      onBack,
    ],
  );


  const startNewGame =
    useCallback(
      async () => {

        if (
          starting
        ) {
          return;
        }


        if (
          !currentUser
        ) {

          setErrorMessage(
            "Sign in to play 2048 and earn rewards.",
          );

          return;
        }


        setStarting(
          true,
        );

        setErrorMessage(
          null,
        );


        try {

          /*
           * IMPORTANT:
           *
           * There is NO backend call
           * here.
           *
           * The user must first finish
           * the rewarded ad.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            setErrorMessage(
              "Watch the full rewarded ad to start a new 2048 game.",
            );

            return;
          }


          /*
           * Ad completed.
           *
           * Now create the entire run
           * locally.
           */
          const seed =
            createSeed();


          const runId =
            createRunId();


          const nextRun =
            createNewRun(
              seed,
              runId,
            );


          setClaimResult(
            null,
          );


          setShowDiamondFly(
            false,
          );


          setRun(
            nextRun,
          );


          saveRun(
            nextRun,
          );

        } catch (
          error
        ) {

          console.error(
            "Unable to start 2048:",
            error,
          );


          setErrorMessage(
            "Unable to start 2048 right now. Please try again.",
          );

        } finally {

          setStarting(
            false,
          );
        }
      },
      [
        starting,
        currentUser,
      ],
    );
      const performMove =
    useCallback(
      (
        direction:
          MoveDirection,
      ) => {

        setRun(
          current => {

            if (
              !current ||
              !canMove(
                current.board,
              ) ||
              (
                current.rewardClaimed &&
                !current.continueEndless
              )
            ) {
              return current;
            }


            const moved =
              moveBoard(
                current.board,
                direction,
              );


            /*
             * Invalid swipe.
             *
             * Board did not move,
             * so don't save this
             * direction for backend
             * verification.
             */
            if (
              boardsEqual(
                moved.board,
                current.board,
              )
            ) {
              return current;
            }


            const history = [
              ...current.history,

              {
                board:
                  cloneBoard(
                    current.board,
                  ),

                score:
                  current.score,

                elapsedSeconds:
                  current.elapsedSeconds,

                moves: [
                  ...current.moves,
                ],

                randomStep:
                  current.randomStep,
              },
            ].slice(
              -20,
            );


            const withTile =
              addSeededTile(
                moved.board,
                current.seed,
                current.randomStep,
              );


            return {
              ...current,

              board:
                withTile.board,

              score:
                current.score +
                moved.scoreGained,

              moves: [
                ...current.moves,
                direction,
              ],

              randomStep:
                withTile.randomStep,

              history,

              updatedAt:
                Date.now(),
            };
          },
        );
      },
      [],
    );


  /*
   * Desktop / browser testing.
   */
  useEffect(
    () => {

      const onKeyDown = (
        event:
          KeyboardEvent,
      ) => {

        if (
          event.key ===
          "ArrowLeft"
        ) {

          event.preventDefault();

          performMove(
            "left",
          );

        } else if (
          event.key ===
          "ArrowRight"
        ) {

          event.preventDefault();

          performMove(
            "right",
          );

        } else if (
          event.key ===
          "ArrowUp"
        ) {

          event.preventDefault();

          performMove(
            "up",
          );

        } else if (
          event.key ===
          "ArrowDown"
        ) {

          event.preventDefault();

          performMove(
            "down",
          );
        }
      };


      window.addEventListener(
        "keydown",
        onKeyDown,
      );


      return () => {

        window.removeEventListener(
          "keydown",
          onKeyDown,
        );
      };

    },
    [
      performMove,
    ],
  );


  /*
   * One free undo per run.
   *
   * Undo also restores:
   * - moves
   * - randomStep
   *
   * so frontend and backend
   * deterministic replay
   * continue to match.
   */
  const undo = () => {

    setRun(
      current => {

        if (
          !current ||
          current.freeUndoUsed ||
          current.history.length ===
            0 ||
          current.rewardClaimed
        ) {

          return current;
        }


        const previous =
          current.history[
            current.history.length -
            1
          ];


        return {
          ...current,

          board:
            cloneBoard(
              previous.board,
            ),

          score:
            previous.score,

          elapsedSeconds:
            previous.elapsedSeconds,

          moves: [
            ...previous.moves,
          ],

          randomStep:
            previous.randomStep,

          history:
            current.history.slice(
              0,
              -1,
            ),

          freeUndoUsed:
            true,

          updatedAt:
            Date.now(),
        };
      },
    );
  };


  /*
   * ONLY backend call used
   * during a 2048 reward run.
   */
  const completeRun =
    useCallback(
      async () => {

        if (
          !run ||
          run.rewardClaimed ||
          claiming
        ) {

          return;
        }


        /*
         * Below 128 there is
         * no cash/diamond reward,
         * so don't waste a
         * Firebase Function call.
         */
        if (
          currentHighestTile <
          128
        ) {

          setRun(
            current =>
              current
                ? {
                    ...current,

                    rewardClaimed:
                      true,

                    updatedAt:
                      Date.now(),
                  }
                : current,
          );


          setClaimResult(
            null,
          );


          return;
        }


        setClaiming(
          true,
        );


        setErrorMessage(
          null,
        );


        try {

          const result =
            await cloudflareR2
              .completeGenZ2048Run({
                runId:
                  run.runId,

                seed:
                  run.seed,

                moves:
                  run.moves,

                elapsedSeconds:
                  run.elapsedSeconds,
              });


          setClaimResult(
            result,
          );


          setRun(
            current =>
              current
                ? {
                    ...current,

                    rewardClaimed:
                      true,

                    updatedAt:
                      Date.now(),
                  }
                : current,
          );


          if (
            result
              .diamondsGranted >
            0
          ) {

            setShowDiamondFly(
              true,
            );
          }


          /*
           * Reuse current summary
           * when already loaded.
           *
           * Only fetch summary if
           * this page somehow opened
           * without one.
           */
          const currentSummary =
            summary ??
            await cloudflareR2
              .getGenZGamesSummary();


          onSummaryChange({
            ...currentSummary,

            balancePaise:
              result
                .balancePaise,

            lifetimeEarningsPaise:
              result
                .lifetimeEarningsPaise,

            diamonds: {
              ...currentSummary
                .diamonds,

              dayKey:
                result
                  .diamondDayKey,

              today:
                result
                  .todayDiamonds,

              lifetime:
                result
                  .lifetimeDiamonds,

              sudokuToday:
                currentSummary
                  .diamonds
                  .dayKey ===
                result
                  .diamondDayKey
                  ? currentSummary
                      .diamonds
                      .sudokuToday
                  : 0,

              miningToday:
                currentSummary
                  .diamonds
                  .dayKey ===
                result
                  .diamondDayKey
                  ? currentSummary
                      .diamonds
                      .miningToday
                  : 0,

              referralToday:
                currentSummary
                  .diamonds
                  .dayKey ===
                result
                  .diamondDayKey
                  ? currentSummary
                      .diamonds
                      .referralToday
                  : 0,

              game2048Today:
                (
                  currentSummary
                    .diamonds
                    .dayKey ===
                  result
                    .diamondDayKey
                    ? currentSummary
                        .diamonds
                        .game2048Today
                    : 0
                ) +
                result
                  .diamondsGranted,
            },

            game2048: {
              completedRuns:
                result
                  .completedRuns,

              bestTile:
                result
                  .bestTile,

              highScore:
                result
                  .highScore,
            },
          });


          if (
            !result
              .rewardGranted
          ) {

            setErrorMessage(
              "This 2048 run was already verified. No additional reward was added.",
            );
          }

        } catch (
          error
        ) {

          console.error(
            "Unable to verify 2048 run:",
            error,
          );


          setErrorMessage(
            "Unable to verify this 2048 reward. Please try again.",
          );

        } finally {

          setClaiming(
            false,
          );
        }
      },
      [
        run,
        claiming,
        currentHighestTile,
        summary,
        onSummaryChange,
      ],
    );


  /*
   * Automatically verify:
   *
   * 1. User reaches 2048
   * OR
   * 2. Board has no moves left.
   */
  useEffect(
    () => {

      if (
        !run ||
        run.rewardClaimed ||
        claiming
      ) {

        return;
      }


      if (
        reached2048 ||
        gameOver
      ) {

        void completeRun();
      }

    },
    [
      run,
      reached2048,
      gameOver,
      claiming,
      completeRun,
    ],
  );


  /*
   * Delete old run and
   * immediately request a
   * fresh rewarded ad.
   */
  const discardAndStart =
    async () => {

      saveRun(
        null,
      );


      setRun(
        null,
      );


      setClaimResult(
        null,
      );


      setShowDiamondFly(
        false,
      );


      setErrorMessage(
        null,
      );


      await startNewGame();
    };


  /*
   * Return to the 2048
   * home screen.
   */
  const finishRun = () => {

    saveRun(
      null,
    );


    setRun(
      null,
    );


    setClaimResult(
      null,
    );


    setShowDiamondFly(
      false,
    );


    setErrorMessage(
      null,
    );
  };


  return (
    <div
      className="
        min-h-full
        w-full
        bg-[var(--app-bg)]
        app-text
        pb-[calc(var(--safe-bottom)+80px)]
      "
      style={{
        paddingTop:
          "calc(env(safe-area-inset-top) + 8px)",
      }}
    >

      {showDiamondFly &&
        claimResult &&
        claimResult
          .diamondsGranted >
          0 && (

          <DiamondFlyReward
            amount={
              claimResult
                .diamondsGranted
            }
            onDone={() =>
              setShowDiamondFly(
                false,
              )
            }
          />

        )}


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

        {/* HEADER */}
<div
  className="
    flex
    items-center
    justify-between
    gap-2
  "
>

  <div
    className="
      min-w-0
      flex
      items-center
      gap-2
    "
  >

    <button
      type="button"
      onClick={
        onBack
      }
      className="
        w-10
        h-10
        shrink-0
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


    <div
      className="
        min-w-0
      "
    >

      <h1
        className="
          text-lg
          font-black
        "
      >
        2048
      </h1>


      <p
        className="
          truncate
          text-[10px]
          app-text-muted
        "
      >
        {hasActiveRun
          ? "Active Reward Run"
          : "Merge tiles. Reach 2048. Earn."}
      </p>

    </div>

  </div>


  <div
    className="
      flex
      shrink-0
      items-center
      gap-1.5
    "
  >

    <div
      className="
        rounded-xl
        border
        border-[#FF4E00]/20
        bg-[#FF4E00]/10
        px-2.5
        py-2
      "
    >

      <p
        className="
          text-[8px]
          font-black
          uppercase
          text-[#FF4E00]
        "
      >
        Balance
      </p>


      <p
        className="
          text-[11px]
          font-black
        "
      >
        {
          formatGamePaise(
            summary
              ?.balancePaise ??
            claimResult
              ?.balancePaise ??
            0,
          )
        }
      </p>

    </div>


    <DiamondCounter
      compact
      diamonds={
        summary
          ?.diamonds
          .today ??
        claimResult
          ?.todayDiamonds ??
        0
      }
    />

  </div>

</div>


        {/* ERROR / INFO MESSAGE */}
        {errorMessage && (

          <div
            className="
              mt-4
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4
              py-3
              text-xs
              font-bold
              text-red-500
            "
          >
            {errorMessage}
          </div>

        )}


        {/* =========================
            2048 HOME
        ========================== */}
        {!run ? (
          <>

            <div
              className="
                mt-6
                rounded-[28px]
                overflow-hidden
                border
                app-border
                app-surface
                shadow-sm
              "
            >

              <div
                className="
                  bg-gradient-to-br
                  from-orange-500/20
                  via-amber-400/10
                  to-transparent
                  p-6
                "
              >

                <div
                  className="
                    mx-auto
                    grid
                    w-40
                    grid-cols-4
                    gap-2
                    rounded-3xl
                    bg-black/10
                    dark:bg-white/5
                    p-3
                  "
                >

                  {[
                    2,
                    4,
                    8,
                    16,
                    32,
                    64,
                    128,
                    256,
                  ].map(
                    value => (

                      <div
                        key={
                          value
                        }
                        className={`
                          aspect-square
                          rounded-xl
                          flex
                          items-center
                          justify-center
                          text-[10px]
                          font-black
                          ${getTileClasses(
                            value,
                          )}
                        `}
                      >
                        {value}
                      </div>

                    ),
                  )}


                  {[
                    0,
                    0,
                    512,
                    1024,
                    0,
                    0,
                    0,
                    2048,
                  ].map(
                    (
                      value,
                      index,
                    ) => (

                      <div
                        key={`preview-${index}`}
                        className={`
                          aspect-square
                          rounded-xl
                          flex
                          items-center
                          justify-center
                          text-[9px]
                          font-black
                          ${getTileClasses(
                            value,
                          )}
                        `}
                      >
                        {value ||
                          ""}
                      </div>

                    ),
                  )}

                </div>


                <div
                  className="
                    mt-6
                    text-center
                  "
                >

                  <h2
                    className="
                      text-2xl
                      font-black
                    "
                  >
                    Reward Run
                  </h2>


                  <p
                    className="
                      mt-2
                      text-sm
                      app-text-muted
                    "
                  >
                    Watch one rewarded ad, then play one full 2048 board.
                  </p>

                </div>

              </div>


              <div
                className="
                  p-5
                "
              >

                <p
                  className="
                    text-[10px]
                    font-black
                    uppercase
                    tracking-widest
                    app-text-muted
                    mb-3
                  "
                >
                  Reward Tiers
                </p>


                <div
                  className="
                    grid
                    grid-cols-5
                    gap-2
                    text-center
                  "
                >

                  {[
                    [
                      "128",
                      "₹0.01",
                      "2💎",
                    ],

                    [
                      "256",
                      "₹0.02",
                      "3💎",
                    ],

                    [
                      "512",
                      "₹0.03",
                      "5💎",
                    ],

                    [
                      "1024",
                      "₹0.04",
                      "7💎",
                    ],

                    [
                      "2048",
                      "₹0.05",
                      "10💎",
                    ],
                  ].map(
                    reward => (

                      <div
                        key={
                          reward[0]
                        }
                        className="
                          rounded-2xl
                          app-surface-secondary
                          p-2
                        "
                      >

                        <p
                          className="
                            text-xs
                            font-black
                          "
                        >
                          {reward[0]}
                        </p>


                        <p
                          className="
                            mt-1
                            text-[9px]
                            font-black
                            text-[#FF4E00]
                          "
                        >
                          {reward[1]}
                        </p>


                        <p
                          className="
                            text-[9px]
                            app-text-muted
                          "
                        >
                          {reward[2]}
                        </p>

                      </div>

                    ),
                  )}

                </div>


                <button
                  type="button"
                  onClick={() =>
                    void startNewGame()
                  }
                  disabled={
                    starting
                  }
                  className="
                    mt-5
                    w-full
                    rounded-2xl
                    bg-[#FF4E00]
                    px-5
                    py-4
                    text-sm
                    font-black
                    text-white
                    disabled:opacity-60
                    flex
                    items-center
                    justify-center
                    gap-2
                    active:scale-[0.99]
                    transition
                  "
                >

                  {starting ? (

                    <RefreshCw
                      className="
                        w-5
                        h-5
                        animate-spin
                      "
                    />

                  ) : (

                    <Play
                      className="
                        w-5
                        h-5
                        fill-current
                      "
                    />

                  )}


                  {starting
                    ? "Opening Reward Ad..."
                    : "Watch Ad & Start"}

                </button>


                <div
                  className="
                    mt-4
                    rounded-2xl
                    app-surface-secondary
                    p-4
                    text-xs
                    leading-relaxed
                    app-text-secondary
                  "
                >

                  <p
                    className="
                      font-black
                      app-text
                    "
                  >
                    How to play
                  </p>


                  <p
                    className="
                      mt-2
                    "
                  >
                    Swipe up, down, left or right. Matching tiles merge together.
                  </p>


                  <p
                    className="
                      mt-2
                    "
                  >
                    Your run ends when no valid moves remain.
                  </p>


                  <p
                    className="
                      mt-2
                    "
                  >
                    Reach 2048 for the maximum ₹0.05 + 10 💎 reward.
                  </p>

                </div>

              </div>

            </div>


            {/* LIFETIME STATS */}
            <div
              className="
                mt-4
                grid
                grid-cols-3
                gap-3
              "
            >

              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-4
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-bold
                  "
                >
                  Best Tile
                </p>


                <p
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  {summary
                    ?.game2048
                    ?.bestTile ??
                    0}
                </p>

              </div>


              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-4
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-bold
                  "
                >
                  Best Score
                </p>


                <p
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  {summary
                    ?.game2048
                    ?.highScore ??
                    0}
                </p>

              </div>


              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-4
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-bold
                  "
                >
                  Runs
                </p>


                <p
                  className="
                    mt-2
                    text-xl
                    font-black
                  "
                >
                  {summary
                    ?.game2048
                    ?.completedRuns ??
                    0}
                </p>

              </div>

            </div>

          </>

        ) : (

          <>
            {/* =========================
                ACTIVE RUN
            ========================== */}

            <div
              className="
                mt-5
                grid
                grid-cols-3
                gap-2
              "
            >

              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-3
                  text-center
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-black
                  "
                >
                  Score
                </p>


                <p
                  className="
                    mt-1
                    text-lg
                    font-black
                  "
                >
                  {run.score}
                </p>

              </div>


              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-3
                  text-center
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-black
                  "
                >
                  Best Tile
                </p>


                <p
                  className="
                    mt-1
                    text-lg
                    font-black
                    text-[#FF4E00]
                  "
                >
                  {currentHighestTile}
                </p>

              </div>


              <div
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  p-3
                  text-center
                "
              >

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-black
                  "
                >
                  Time
                </p>


                <p
                  className="
                    mt-1
                    text-lg
                    font-black
                  "
                >
                  {formatTime(
                    run
                      .elapsedSeconds,
                  )}
                </p>

              </div>

            </div>


            {/* CURRENT REWARD */}
            <div
              className="
                mt-3
                rounded-2xl
                border
                app-border
                app-surface
                px-4
                py-3
                flex
                items-center
                justify-between
                gap-3
              "
            >

              <div>

                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-widest
                    app-text-muted
                    font-black
                  "
                >
                  Current Reward Tier
                </p>


                <p
                  className="
                    mt-1
                    text-sm
                    font-black
                  "
                >
                  {formatGamePaise(
                    currentReward
                      .paise,
                  )}{" "}
                  +{" "}
                  {currentReward
                    .diamonds}{" "}
                  💎
                </p>

              </div>


              <Trophy
                className="
                  w-5
                  h-5
                  text-amber-500
                "
              />

            </div>


            {/* 2048 BOARD */}
            <div
              className="
                mt-4
                mx-auto
                w-full
                max-w-[390px]
                rounded-[28px]
                bg-gradient-to-br
                from-[#a88b70]
                to-[#8d725c]
                p-3
                shadow-xl
                touch-none
                select-none
              "
              onTouchStart={
                event => {

                  const touch =
                    event
                      .changedTouches[
                        0
                      ];


                  touchStartRef
                    .current = {
                    x:
                      touch
                        .clientX,

                    y:
                      touch
                        .clientY,
                  };
                }
              }
              onTouchEnd={
                event => {

                  if (
                    !touchStartRef
                      .current
                  ) {

                    return;
                  }


                  const touch =
                    event
                      .changedTouches[
                        0
                      ];


                  const dx =
                    touch
                      .clientX -
                    touchStartRef
                      .current
                      .x;


                  const dy =
                    touch
                      .clientY -
                    touchStartRef
                      .current
                      .y;


                  touchStartRef
                    .current =
                    null;


                  if (
                    Math.max(
                      Math.abs(
                        dx,
                      ),

                      Math.abs(
                        dy,
                      ),
                    ) <
                    24
                  ) {

                    return;
                  }


                  if (
                    Math.abs(
                      dx,
                    ) >
                    Math.abs(
                      dy,
                    )
                  ) {

                    performMove(
                      dx > 0
                        ? "right"
                        : "left",
                    );

                  } else {

                    performMove(
                      dy > 0
                        ? "down"
                        : "up",
                    );
                  }
                }
              }
            >

              <div
                className="
                  grid
                  grid-cols-4
                  gap-2
                "
              >

                {run.board.map(
                  (
                    row,
                    rowIndex,
                  ) =>
                    row.map(
                      (
                        value,
                        columnIndex,
                      ) => (

                        <div
                          key={`${rowIndex}-${columnIndex}`}
                          className={`
                            aspect-square
                            rounded-2xl
                            flex
                            items-center
                            justify-center
                            font-black
                            shadow-sm
                            transition-all

                            ${
                              value >=
                              1024
                                ? "text-[18px]"
                                : value >=
                                    128
                                  ? "text-[22px]"
                                  : "text-[28px]"
                            }

                            ${getTileClasses(
                              value,
                            )}
                          `}
                        >
                          {value ||
                            ""}
                        </div>

                      ),
                    ),
                )}

              </div>

            </div>


            <p
              className="
                mt-3
                text-center
                text-[10px]
                font-bold
                uppercase
                tracking-widest
                app-text-muted
              "
            >
              Swipe the board to move tiles
            </p>


            {/* GAME ACTIONS */}
            <div
              className="
                mt-4
                grid
                grid-cols-2
                gap-3
              "
            >

              <button
                type="button"
                onClick={
                  undo
                }
                disabled={
                  run
                    .freeUndoUsed ||
                  run
                    .history
                    .length ===
                    0 ||
                  run
                    .rewardClaimed
                }
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  px-4
                  py-3
                  text-xs
                  font-black
                  disabled:opacity-40
                  active:scale-[0.98]
                  transition
                "
              >
                ↩️{" "}
                {run
                  .freeUndoUsed
                  ? "Undo Used"
                  : "Free Undo"}
              </button>


              <button
                type="button"
                onClick={() =>
                  void discardAndStart()
                }
                disabled={
                  starting ||
                  claiming
                }
                className="
                  rounded-2xl
                  border
                  app-border
                  app-surface
                  px-4
                  py-3
                  text-xs
                  font-black
                  disabled:opacity-40
                  active:scale-[0.98]
                  transition
                "
              >
                🔄 New Run + Ad
              </button>

            </div>


            {/* =========================
                RUN RESULT
            ========================== */}
            {(
              gameOver ||
              (
                reached2048 &&
                !run
                  .continueEndless
              )
            ) && (

              <div
                className="
                  fixed
                  inset-0
                  z-[120]
                  app-overlay
                  backdrop-blur-sm
                  flex
                  items-center
                  justify-center
                  p-5
                "
              >

                <div
                  className="
                    w-full
                    max-w-md
                    rounded-[30px]
                    app-surface
                    border
                    app-border
                    p-6
                    text-center
                    shadow-2xl
                  "
                >

                  <div
                    className="
                      text-5xl
                    "
                  >
                    {reached2048
                      ? "🏆"
                      : "🎮"}
                  </div>


                  <h2
                    className="
                      mt-3
                      text-2xl
                      font-black
                    "
                  >
                    {reached2048
                      ? "2048 Reached!"
                      : "Run Complete"}
                  </h2>


                  <p
                    className="
                      mt-2
                      text-sm
                      app-text-muted
                    "
                  >
                    Highest tile{" "}
                    {currentHighestTile}
                    {" • "}
                    Score{" "}
                    {run.score}
                  </p>


                  <p
                    className="
                      mt-1
                      text-xs
                      app-text-muted
                    "
                  >
                    Time{" "}
                    {formatTime(
                      run
                        .elapsedSeconds,
                    )}
                  </p>


                  <div
                    className="
                      mt-5
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >

                    <div
                      className="
                        rounded-2xl
                        app-surface-secondary
                        p-4
                      "
                    >

                      <p
                        className="
                          text-[9px]
                          uppercase
                          tracking-widest
                          app-text-muted
                          font-black
                        "
                      >
                        Cash
                      </p>


                      <p
                        className="
                          mt-1
                          text-xl
                          font-black
                          text-[#FF4E00]
                        "
                      >
                        {claimResult
                          ? formatGamePaise(
                              claimResult
                                .rewardPaise,
                            )
                          : formatGamePaise(
                              currentReward
                                .paise,
                            )}
                      </p>

                    </div>


                    <div
                      className="
                        rounded-2xl
                        app-surface-secondary
                        p-4
                      "
                    >

                      <p
                        className="
                          text-[9px]
                          uppercase
                          tracking-widest
                          app-text-muted
                          font-black
                        "
                      >
                        Diamonds
                      </p>


                      <p
                        className="
                          mt-1
                          text-xl
                          font-black
                          text-cyan-500
                        "
                      >
                        +
                        {claimResult
                          ?.diamondsGranted ??
                          currentReward
                            .diamonds}{" "}
                        💎
                      </p>

                    </div>

                  </div>


                  {/* VERIFYING */}
                  {claiming && (

                    <div
                      className="
                        mt-5
                        flex
                        items-center
                        justify-center
                        gap-2
                        text-xs
                        font-bold
                        app-text-muted
                      "
                    >

                      <RefreshCw
                        className="
                          w-4
                          h-4
                          animate-spin
                        "
                      />

                      Verifying reward...

                    </div>

                  )}


                  {/* VERIFIED / FINISHED */}
                  {!claiming &&
                    run
                      .rewardClaimed && (

                    <div
                      className="
                        mt-5
                        space-y-3
                      "
                    >

                      {claimResult &&
                        claimResult
                          .rewardGranted && (

                        <div
                          className="
                            rounded-2xl
                            bg-emerald-500/10
                            border
                            border-emerald-500/20
                            px-4
                            py-3
                            text-xs
                            font-bold
                            text-emerald-500
                          "
                        >
                          Reward added to your GenZGames wallet.
                        </div>

                      )}


                      {currentHighestTile <
                        128 && (

                        <p
                          className="
                            text-xs
                            app-text-muted
                          "
                        >
                          Reach at least tile 128 to earn cash and diamonds.
                        </p>

                      )}


                      {reached2048 &&
                        !gameOver && (

                        <button
                          type="button"
                          onClick={() => {

                            setRun(
                              current =>
                                current
                                  ? {
                                      ...current,

                                      continueEndless:
                                        true,

                                      updatedAt:
                                        Date.now(),
                                    }
                                  : current,
                            );


                            setErrorMessage(
                              null,
                            );
                          }}
                          className="
                            w-full
                            rounded-2xl
                            border
                            border-amber-400/40
                            bg-amber-400/10
                            px-5
                            py-4
                            text-sm
                            font-black
                            text-amber-500
                            active:scale-[0.99]
                            transition
                          "
                        >
                          Continue Endless • Score Only
                        </button>

                      )}


                      <button
                        type="button"
                        onClick={() =>
                          void discardAndStart()
                        }
                        disabled={
                          starting
                        }
                        className="
                          w-full
                          rounded-2xl
                          bg-[#FF4E00]
                          px-5
                          py-4
                          text-sm
                          font-black
                          text-white
                          disabled:opacity-60
                          active:scale-[0.99]
                          transition
                        "
                      >
                        {starting
                          ? "Opening Ad..."
                          : "Play Again • Watch Ad"}
                      </button>


                      <button
                        type="button"
                        onClick={
                          finishRun
                        }
                        className="
                          w-full
                          rounded-2xl
                          border
                          app-border
                          px-5
                          py-3
                          text-xs
                          font-black
                        "
                      >
                        Back to 2048 Home
                      </button>

                    </div>

                  )}


                  {/* BACKEND VERIFY FAILED */}
                  {!claiming &&
                    !run
                      .rewardClaimed &&
                    currentHighestTile >=
                      128 && (

                    <div
                      className="
                        mt-5
                        space-y-3
                      "
                    >

                      <p
                        className="
                          text-xs
                          app-text-muted
                        "
                      >
                        Reward verification did not finish. Your run is still saved.
                      </p>


                      <button
                        type="button"
                        onClick={() =>
                          void completeRun()
                        }
                        className="
                          w-full
                          rounded-2xl
                          bg-[#FF4E00]
                          px-5
                          py-4
                          text-sm
                          font-black
                          text-white
                        "
                      >
                        Retry Reward Verification
                      </button>

                    </div>

                  )}

                </div>

              </div>

            )}

          </>

        )}

      </div>

    </div>
  );
};
