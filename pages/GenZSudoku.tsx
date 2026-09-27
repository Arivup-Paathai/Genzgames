import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Eraser,
  Lightbulb,
  Lock,
  Pencil,
  Play,
  RefreshCw,
  Trophy,
  WalletCards,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";

import type {
  CompleteGenZSudokuLevelResponse,
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
  boardToNumberMatrix,
  clearSavedGenZSudokuGame,
  cloneGenZSudokuBoard,
  createGenZSudokuBoard,
  formatGamePaise,
  generateGenZSudokuLevel,
  loadSavedGenZSudokuGame,
  saveGenZSudokuGame,
} from "../services/genzGames";

import type {
  GenZSudokuBoard,
  GenZSudokuGameStatus,
} from "../services/genzGames";


interface GenZSudokuProps {
  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onBack: () => void;
}


interface SudokuGameState {
  board:
    GenZSudokuBoard;

  solution:
    number[][];

  elapsedSeconds:
    number;

  lives:
    number;

  status:
    GenZSudokuGameStatus;
}


const MAX_SUDOKU_LEVEL =
  1000;


const SUDOKU_LEVELS_PER_PAGE =
  100;


const SUDOKU_LEVEL_PAGE_COUNT =
  Math.ceil(
    MAX_SUDOKU_LEVEL /
      SUDOKU_LEVELS_PER_PAGE,
  );


const formatTime = (
  seconds: number,
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


export const GenZSudoku:
React.FC<
  GenZSudokuProps
> = ({
  summary,
  onSummaryChange,
  onBack,
}) => {
  const {
    currentUser,
    addToast,
  } = useAuth();


  const [
    selectedLevel,
    setSelectedLevel,
  ] =
    useState<
      number |
      null
    >(
      null,
    );


  const [
    levelPage,
    setLevelPage,
  ] = useState(
    0,
  );


  const [
    game,
    setGame,
  ] =
    useState<
      SudokuGameState |
      null
    >(
      null,
    );


  const [
    selectedCell,
    setSelectedCell,
  ] =
    useState<
      {
        row:
          number;

        column:
          number;
      } |
      null
    >(
      null,
    );


  const [
    notesMode,
    setNotesMode,
  ] = useState(
    false,
  );


  const [
    busyAd,
    setBusyAd,
  ] = useState(
    false,
  );


  const [
    busyLevel,
    setBusyLevel,
  ] =
    useState<
      number |
      null
    >(
      null,
    );


  const [
    isCompleting,
    setIsCompleting,
  ] = useState(
    false,
  );


  const [
    completion,
    setCompletion,
  ] =
    useState<
      CompleteGenZSudokuLevelResponse |
      null
    >(
      null,
    );
  const [
    diamondAnimation,
    setDiamondAnimation,
  ] =
    useState<
      {
        id:
          number;

        amount:
          number;
      } |
      null
    >(
      null,
    );


  const clearDiamondAnimation =
    useCallback(
      () => {
        setDiamondAnimation(
          null,
        );
      },
      [],
    );

  const [
    completionError,
    setCompletionError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const wrongCleanupTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const [
    boardAlert,
    setBoardAlert,
  ] = useState(
    false,
  );


  const boardAlertTimerRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const triggerBoardAlert =
    useCallback(
      () => {
        if (
          boardAlertTimerRef
            .current !==
          null
        ) {
          window.clearTimeout(
            boardAlertTimerRef
              .current,
          );
        }


        setBoardAlert(
          true,
        );


        boardAlertTimerRef
          .current =
          window.setTimeout(
            () => {
              setBoardAlert(
                false,
              );

              boardAlertTimerRef
                .current =
                null;
            },
            420,
          );
      },
      [],
    );





  const completedLevels =
    useMemo(
      () =>
        new Set(
          summary
            ?.sudoku
            .completedLevelNumbers ??
          [],
        ),
      [
        summary
          ?.sudoku
          .completedLevelNumbers,
      ],
    );


  const highestUnlockedLevel =
    summary
      ?.sudoku
      .highestUnlockedLevel ??
    1;


  const levelPageStart =
    levelPage *
      SUDOKU_LEVELS_PER_PAGE +
    1;


  const levelPageEnd =
    Math.min(
      MAX_SUDOKU_LEVEL,

      levelPageStart +
        SUDOKU_LEVELS_PER_PAGE -
        1,
    );


   const closeLevel =
    useCallback(
      () => {
        if (
          wrongCleanupTimerRef
            .current !==
          null
        ) {
          window.clearTimeout(
            wrongCleanupTimerRef
              .current,
          );

          wrongCleanupTimerRef
            .current =
            null;
        }


        if (
          boardAlertTimerRef
            .current !==
          null
        ) {
          window.clearTimeout(
            boardAlertTimerRef
              .current,
          );

          boardAlertTimerRef
            .current =
            null;
        }


        setBoardAlert(
          false,
        );


        setSelectedLevel(
          null,
        );

        setGame(
          null,
        );

        setSelectedCell(
          null,
        );

        setCompletion(
          null,
        );

        setDiamondAnimation(
          null,
        );

        setCompletionError(
          null,
        );

        setNotesMode(
          false,
        );

        setBusyAd(
          false,
        );

        setIsCompleting(
          false,
        );
      },
      [],
    );


  /*
   * Android Back:
   *
   * Game -> Levels
   * Levels -> GenZGames Home
   */
  useEffect(() => {
    return registerNativeBackHandler(
      () => {
        if (
          selectedLevel !==
          null
        ) {
          closeLevel();

          return;
        }


        onBack();
      },
    );
  }, [
    selectedLevel,
    closeLevel,
    onBack,
  ]);


  useEffect(() => {
    return () => {
      if (
        wrongCleanupTimerRef
          .current !==
        null
      ) {
        window.clearTimeout(
          wrongCleanupTimerRef
            .current,
        );
      }


      if (
        boardAlertTimerRef
          .current !==
        null
      ) {
        window.clearTimeout(
          boardAlertTimerRef
            .current,
        );
      }
    };
  }, []);


  const refreshSummary =
    useCallback(
      async () => {
        try {
          const next =
            await cloudflareR2
              .getGenZGamesSummary();


          onSummaryChange(
            next,
          );


          return next;
        } catch (error) {
          console.error(
            "Unable to refresh Sudoku summary:",
            error,
          );


          return null;
        }
      },
      [
        onSummaryChange,
      ],
    );


  useEffect(() => {
    if (!summary) {
      void refreshSummary();
    }
  }, [
    summary,
    refreshSummary,
  ]);


  const openLevel =
    useCallback(
      (
        level:
          number,
        forceFresh =
          false,
      ) => {
        if (
          !currentUser
        ) {
          return;
        }


        if (
          level >
          highestUnlockedLevel
        ) {
          return;
        }


        const generated =
          generateGenZSudokuLevel(
            level,
          );


        const shouldStartFresh =
          forceFresh ||
          completedLevels.has(
            level,
          );


        const saved =
          shouldStartFresh
            ? null
            : loadSavedGenZSudokuGame(
                currentUser.id,
                level,
              );


        const board =
          saved
            ? cloneGenZSudokuBoard(
                saved.board,
              )
            : createGenZSudokuBoard(
                generated.puzzle,
              );


        setLevelPage(
          Math.floor(
            (
              level -
              1
            ) /
              SUDOKU_LEVELS_PER_PAGE,
          ),
        );


        setSelectedLevel(
          level,
        );


        setGame({
          board,

          solution:
            generated.solution,

          elapsedSeconds:
            saved
              ?.elapsedSeconds ??
            0,

          lives:
            saved
              ?.lives ??
            3,

          status:
            saved
              ?.status ??
            "playing",
        });


        setSelectedCell(
          null,
        );

        setNotesMode(
          false,
        );

        setCompletion(
          null,
        );

        setCompletionError(
          null,
        );
      },
      [
        currentUser,
        highestUnlockedLevel,
        completedLevels,
      ],
    );


  /*
   * Save active board locally.
   *
   * This allows:
   * close app -> reopen -> exact same
   * board, timer and hearts.
   *
   * Firestore remains authoritative for
   * completed levels and money.
   */
  useEffect(() => {
    if (
      !currentUser ||
      selectedLevel ===
        null ||
      !game ||
      game.status ===
        "gameover" &&
        game.lives >
          0
    ) {
      return;
    }


    saveGenZSudokuGame(
      currentUser.id,
      {
        version:
          1,

        level:
          selectedLevel,

        board:
          game.board,

        elapsedSeconds:
          game.elapsedSeconds,

        lives:
          game.lives,

        status:
          game.status,

        updatedAt:
          Date.now(),
      },
    );
  }, [
    currentUser,
    selectedLevel,
    game,
  ]);


  /*
   * Timer pauses while:
   *
   * - ad is open
   * - game is over
   * - backend is validating completion
   */
  useEffect(() => {
    if (
      !game ||
      game.status !==
        "playing" ||
      busyAd ||
      isCompleting ||
      completion
    ) {
      return;
    }


    const timer =
      window.setInterval(
        () => {
          setGame(
            (
              previous,
            ) =>
              previous
                ? {
                    ...previous,

                    elapsedSeconds:
                      previous
                        .elapsedSeconds +
                      1,
                  }
                : previous,
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
    game?.status,
    busyAd,
    isCompleting,
    completion,
  ]);


  const completedNumbers =
    useMemo(
      () => {
        const counts =
          Array(
            10,
          ).fill(
            0,
          );


        game
          ?.board
          .forEach(
            (row) => {
              row.forEach(
                (cell) => {
                  if (
                    cell.value !==
                      null &&
                    !cell.error
                  ) {
                    counts[
                      cell.value
                    ] +=
                      1;
                  }
                },
              );
            },
          );


        return counts.map(
          (
            count,
          ) =>
            count >=
            9,
        );
      },
      [
        game?.board,
      ],
    );

    /*
   * =====================================================
   * COMPLETED 3x3 BOXES
   * =====================================================
   *
   * A box becomes complete only when all 9 cells:
   *
   * - contain a value
   * - are not marked as errors
   * - exactly match the generated Sudoku solution
   *
   * Index:
   *
   * 0 1 2
   * 3 4 5
   * 6 7 8
   */
  const completedBoxes =
    useMemo(
      () => {

        const boxes:
          boolean[] =
          Array(
            9,
          ).fill(
            false,
          );


        if (
          !game
        ) {
          return boxes;
        }


        for (
          let boxRow =
            0;
          boxRow <
            3;
          boxRow +=
            1
        ) {

          for (
            let boxColumn =
              0;
            boxColumn <
              3;
            boxColumn +=
              1
          ) {

            let complete =
              true;


            for (
              let rowOffset =
                0;
              rowOffset <
                3;
              rowOffset +=
                1
            ) {

              for (
                let columnOffset =
                  0;
                columnOffset <
                  3;
                columnOffset +=
                  1
              ) {

                const row =
                  boxRow *
                    3 +
                  rowOffset;

                const column =
                  boxColumn *
                    3 +
                  columnOffset;


                const cell =
                  game
                    .board[
                      row
                    ][
                      column
                    ];


                if (
                  cell.value ===
                    null ||
                  cell.error ||
                  cell.value !==
                    game
                      .solution[
                        row
                      ][
                        column
                      ]
                ) {

                  complete =
                    false;

                  break;
                }
              }


              if (
                !complete
              ) {
                break;
              }
            }


            boxes[
              boxRow *
                3 +
              boxColumn
            ] =
              complete;
          }
        }


        return boxes;
      },
      [
        game?.board,
        game?.solution,
      ],
    );


  const submitCompletion =
    useCallback(
      async (
        board:
          GenZSudokuBoard,
        elapsedSeconds:
          number,
      ) => {
        if (
          !currentUser ||
          selectedLevel ===
            null ||
          isCompleting
        ) {
          return;
        }


        setIsCompleting(
          true,
        );

        setCompletionError(
          null,
        );


        try {
          const result =
            await cloudflareR2
              .completeGenZSudokuLevel({
                level:
                  selectedLevel,

                elapsedSeconds,

                finalBoard:
                  boardToNumberMatrix(
                    board,
                  ),
              });


          clearSavedGenZSudokuGame(
            currentUser.id,
            selectedLevel,
          );


          setCompletion(
            result,
          );


          playGameSound(
            "game-complete",
          );


          if (
            result
              .diamondsGranted >
            0
          ) {

            setDiamondAnimation({
              id:
                Date.now(),

              amount:
                result
                  .diamondsGranted,
            });
          }


          const currentSummary =
            summary ??
            await cloudflareR2
              .getGenZGamesSummary();


          const nextSummary:
            GetGenZGamesSummaryResponse = {
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
                  (
                    currentSummary
                      .diamonds
                      .dayKey ===
                    result
                      .diamondDayKey
                      ? currentSummary
                          .diamonds
                          .sudokuToday
                      : 0
                  ) +
                  result
                    .diamondsGranted,

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
              },


              sudoku: {
                ...currentSummary
                  .sudoku,

                completedLevels:
                  result
                    .completedLevels,

                completedLevelNumbers:
                  result
                    .completedLevelNumbers,

                highestUnlockedLevel:
                  result
                    .highestUnlockedLevel,
              },
            };


          onSummaryChange(
            nextSummary,
          );
        } catch (error) {
          console.error(
            "Unable to complete Sudoku level:",
            error,
          );


          setCompletionError(
            "Completion verification failed. Tap Verify Completion to try again.",
          );


          addToast(
            "Unable to verify this level. Please try again.",
            "error",
          );
        } finally {
          setIsCompleting(
            false,
          );
        }
      },
      [
        currentUser,
        selectedLevel,
        isCompleting,
        summary,
        onSummaryChange,
        addToast,
      ],
    );


  const applyCorrectNumber =
    (
      row:
        number,
      column:
        number,
      number:
        number,
    ) => {
      if (
        !game ||
        game.status !==
          "playing"
      ) {
        return;
      }


      const nextBoard =
        cloneGenZSudokuBoard(
          game.board,
        );


      const cell =
        nextBoard[
          row
        ][
          column
        ];


      if (
        cell.initial
      ) {
        return;
      }


      nextBoard[
        row
      ][
        column
      ] = {
        ...cell,

        value:
          number,

        notes:
          [],

        error:
          false,
      };


      const completedNumberNow =
        nextBoard.reduce(
          (
            count,
            boardRow,
          ) =>
            count +
            boardRow.filter(
              (
                boardCell,
              ) =>
                boardCell.value ===
                  number &&
                !boardCell.error,
            ).length,
          0,
        ) >=
        9;


      const boxIndex =
        Math.floor(
          row /
            3,
        ) *
          3 +
        Math.floor(
          column /
            3,
        );


      const boxStartRow =
        Math.floor(
          row /
            3,
        ) *
        3;


      const boxStartColumn =
        Math.floor(
          column /
            3,
        ) *
        3;


      let completedBoxNow =
        true;


      for (
        let rowOffset = 0;
        rowOffset < 3;
        rowOffset += 1
      ) {
        for (
          let columnOffset = 0;
          columnOffset < 3;
          columnOffset += 1
        ) {
          const checkRow =
            boxStartRow +
            rowOffset;

          const checkColumn =
            boxStartColumn +
            columnOffset;


          const checkCell =
            nextBoard[
              checkRow
            ][
              checkColumn
            ];


          if (
            checkCell.value !==
              game
                .solution[
                  checkRow
                ][
                  checkColumn
                ] ||
            checkCell.error
          ) {
            completedBoxNow =
              false;

            break;
          }
        }


        if (
          !completedBoxNow
        ) {
          break;
        }
      }


      const isWon =
        nextBoard.every(
          (
            boardRow,
            rowIndex,
          ) =>
            boardRow.every(
              (
                boardCell,
                columnIndex,
              ) =>
                boardCell
                  .value ===
                game
                  .solution[
                    rowIndex
                  ][
                    columnIndex
                  ],
            ),
        );


      setGame({
        ...game,

        board:
          nextBoard,
      });


      if (
        !isWon
      ) {
        const numberJustCompleted =
          completedNumberNow &&
          !completedNumbers[
            number
          ];

        const boxJustCompleted =
          completedBoxNow &&
          !completedBoxes[
            boxIndex
          ];


        if (
          numberJustCompleted
        ) {
          playGameSound(
            "sudoku-number-complete",
          );
        }


        if (
          boxJustCompleted
        ) {
          if (
            numberJustCompleted
          ) {
            window.setTimeout(
              () => {
                playGameSound(
                  "sudoku-box-complete",
                );
              },
              150,
            );
          } else {
            playGameSound(
              "sudoku-box-complete",
            );
          }
        }
      }


      if (
        isWon
      ) {
        void submitCompletion(
          nextBoard,
          game.elapsedSeconds,
        );
      }
    };


  const handleNumberInput =
    (
      number:
        number,
    ) => {
      if (
        !game ||
        !selectedCell ||
        game.status !==
          "playing" ||
        busyAd ||
        isCompleting
      ) {
        return;
      }


      if (
        completedNumbers[
          number
        ]
      ) {
        return;
      }


      const {
        row,
        column,
      } =
        selectedCell;


      const cell =
        game
          .board[
            row
          ][
            column
          ];


      if (
        cell.initial
      ) {
        return;
      }


      if (
        notesMode
      ) {
        const nextBoard =
          cloneGenZSudokuBoard(
            game.board,
          );


        const notes =
          cell.notes.includes(
            number,
          )
            ? cell.notes.filter(
                (note) =>
                  note !==
                  number,
              )
            : [
                ...cell.notes,
                number,
              ].sort(
                (
                  first,
                  second,
                ) =>
                  first -
                  second,
              );


        nextBoard[
          row
        ][
          column
        ] = {
          ...cell,

          value:
            null,

          notes,

          error:
            false,
        };


        setGame({
          ...game,

          board:
            nextBoard,
        });


        return;
      }


      if (
        game
          .solution[
            row
          ][
            column
          ] ===
        number
      ) {
        applyCorrectNumber(
          row,
          column,
          number,
        );


        return;
      }


      /*
       * Wrong number:
       *
       * show it in red first, then remove
       * automatically unless it was the
       * final heart.
       */
      const nextBoard =
        cloneGenZSudokuBoard(
          game.board,
        );


      nextBoard[
        row
      ][
        column
      ] = {
        ...cell,

        value:
          number,

        notes:
          [],

        error:
          true,
      };


      const nextLives =
        Math.max(
          0,
          game.lives -
            1,
        );


      triggerBoardAlert();


      if (
        nextLives ===
        0
      ) {
        playGameSound(
          "game-failed",
        );
      } else {
        playGameSound(
          "wrong-move",
        );
      }


      setGame({
        ...game,

        board:
          nextBoard,

        lives:
          nextLives,

        status:
          nextLives ===
          0
            ? "gameover"
            : "playing",
      });


      if (
        nextLives >
        0
      ) {
        if (
          wrongCleanupTimerRef
            .current !==
          null
        ) {
          window.clearTimeout(
            wrongCleanupTimerRef
              .current,
          );
        }


        wrongCleanupTimerRef
          .current =
          window.setTimeout(
            () => {
              setGame(
                (
                  previous,
                ) => {
                  if (
                    !previous
                  ) {
                    return previous;
                  }


                  const cleaned =
                    cloneGenZSudokuBoard(
                      previous
                        .board,
                    );


                  const wrongCell =
                    cleaned[
                      row
                    ][
                      column
                    ];


                  if (
                    wrongCell
                      .error
                  ) {
                    cleaned[
                      row
                    ][
                      column
                    ] = {
                      ...wrongCell,

                      value:
                        null,

                      error:
                        false,
                    };
                  }


                  return {
                    ...previous,

                    board:
                      cleaned,
                  };
                },
              );


              wrongCleanupTimerRef
                .current =
                null;
            },
            450,
          );
      }
    };


  const handleErase =
    () => {
      if (
        !game ||
        !selectedCell ||
        game.status !==
          "playing"
      ) {
        return;
      }


      const {
        row,
        column,
      } =
        selectedCell;


      const cell =
        game
          .board[
            row
          ][
            column
          ];


      if (
        cell.initial
      ) {
        return;
      }


      const nextBoard =
        cloneGenZSudokuBoard(
          game.board,
        );


      nextBoard[
        row
      ][
        column
      ] = {
        ...cell,

        value:
          null,

        notes:
          [],

        error:
          false,
      };


      setGame({
        ...game,

        board:
          nextBoard,
      });
    };


  const handleHint =
    async () => {
      if (
        !game ||
        !selectedCell ||
        game.status !==
          "playing" ||
        busyAd
      ) {
        return;
      }


      const {
        row,
        column,
      } =
        selectedCell;


      const cell =
        game
          .board[
            row
          ][
            column
          ];


      if (
        cell.initial ||
        (
          cell.value !==
            null &&
          !cell.error
        )
      ) {
        addToast(
          "Select an empty box for a Hint.",
          "info",
        );

        return;
      }


      setBusyAd(
        true,
      );


      try {
        const rewarded =
          await showGenZGamesRewardedAd();


        if (
          !rewarded
        ) {
          addToast(
            "Complete the rewarded ad to use a Hint.",
            "info",
          );

          return;
        }


        applyCorrectNumber(
          row,
          column,
          game
            .solution[
              row
            ][
              column
            ],
        );
      } finally {
        setBusyAd(
          false,
        );
      }
    };


  /*
   * IMPORTANT:
   *
   * At 0 hearts the board is NOT reset.
   *
   * Rewarded ad restores all 3 hearts,
   * removes only the final wrong number,
   * and continues the exact same puzzle.
   */
  const handleContinueAfterGameOver =
    async () => {
      if (
        !game ||
        game.status !==
          "gameover" ||
        busyAd
      ) {
        return;
      }


      setBusyAd(
        true,
      );


      try {
        const rewarded =
          await showGenZGamesRewardedAd();


        if (
          !rewarded
        ) {
          addToast(
            "Complete the rewarded ad to continue.",
            "info",
          );

          return;
        }


        const nextBoard =
          cloneGenZSudokuBoard(
            game.board,
          );


        for (
          let row = 0;
          row < 9;
          row += 1
        ) {
          for (
            let column = 0;
            column < 9;
            column += 1
          ) {
            if (
              nextBoard[
                row
              ][
                column
              ].error
            ) {
              nextBoard[
                row
              ][
                column
              ] = {
                ...nextBoard[
                  row
                ][
                  column
                ],

                value:
                  null,

                error:
                  false,
              };
            }
          }
        }


        setGame({
          ...game,

          board:
            nextBoard,

          lives:
            3,

          status:
            "playing",
        });
      } finally {
        setBusyAd(
          false,
        );
      }
    };


  const canUnlockWithAd =
  (
    level:
      number,
  ) => {

    if (
      level <=
        highestUnlockedLevel ||
      level !==
        highestUnlockedLevel +
          1 ||
      level <=
        1 ||
      level >
        MAX_SUDOKU_LEVEL
    ) {

      return false;
    }


    const previousLevel =
      level -
      1;


    const completedInSummary =
      completedLevels.has(
        previousLevel,
      );


    const completedInCurrentResult =
      completion
        ?.completedLevelNumbers
        .includes(
          previousLevel,
        ) ??
      false;


    return (
      completedInSummary ||
      completedInCurrentResult
    );
  };


  const handleUnlockWithAd =
  async (
    level:
      number,
    openAfter =
      true,
  ) => {

    if (
      busyLevel !==
      null
    ) {

      return;
    }


    if (
      level <=
        highestUnlockedLevel
    ) {

      if (
        openAfter
      ) {

        openLevel(
          level,
          false,
        );
      }


      return;
    }


    if (
      level <=
        1 ||
      level >
        MAX_SUDOKU_LEVEL ||
      level !==
        highestUnlockedLevel +
          1
    ) {

      addToast(
        "Unlock Sudoku levels in order.",
        "info",
      );

      return;
    }


    let previousCompleted =
      canUnlockWithAd(
        level,
      );


    /*
     * If local summary is momentarily
     * behind the completed-level result,
     * refresh once from the backend
     * instead of silently doing nothing.
     */
    if (
      !previousCompleted
    ) {

      const latestSummary =
        await refreshSummary();


      previousCompleted =
        latestSummary
          ?.sudoku
          .completedLevelNumbers
          .includes(
            level -
              1,
          ) ??
        false;
    }


    if (
      !previousCompleted
    ) {

      addToast(
        `Complete Level ${level - 1} before unlocking Level ${level}.`,
        "info",
      );

      return;
    }


    setBusyLevel(
      level,
    );


      try {
        const rewarded =
          await showGenZGamesRewardedAd();


        if (
          !rewarded
        ) {
          addToast(
            `Complete the rewarded ad to unlock Level ${level}.`,
            "info",
          );

          return;
        }


        const result =
          await cloudflareR2
            .unlockGenZSudokuLevel(
              level,
            );


        const currentSummary =
          summary ??
          await cloudflareR2
            .getGenZGamesSummary();


        const nextSummary:
  GetGenZGamesSummaryResponse = {
    ...currentSummary,

    sudoku: {
      ...currentSummary
        .sudoku,

      completedLevels:
        completion
          ?.completedLevels ??
        currentSummary
          .sudoku
          .completedLevels,

      completedLevelNumbers:
        completion
          ?.completedLevelNumbers ??
        currentSummary
          .sudoku
          .completedLevelNumbers,

      highestUnlockedLevel:
        result
          .highestUnlockedLevel,
    },
  };


        onSummaryChange(
          nextSummary,
        );


        if (
          openAfter
        ) {
          const generated =
            generateGenZSudokuLevel(
              level,
            );


          setLevelPage(
            Math.floor(
              (
                level -
                1
              ) /
                SUDOKU_LEVELS_PER_PAGE,
            ),
          );


          setSelectedLevel(
            level,
          );


          setGame({
            board:
              createGenZSudokuBoard(
                generated
                  .puzzle,
              ),

            solution:
              generated
                .solution,

            elapsedSeconds:
              0,

            lives:
              3,

            status:
              "playing",
          });


          setSelectedCell(
            null,
          );

          setCompletion(
            null,
          );

          setCompletionError(
            null,
          );
        }
      } catch (error) {
        console.error(
          "Unable to unlock Sudoku level:",
          error,
        );


        addToast(
          "Unable to unlock this level.",
          "error",
        );
      } finally {
        setBusyLevel(
          null,
        );
      }
    };


  /*
   * =====================================================
   * ACTIVE GAME
   * =====================================================
   */
  if (
    selectedLevel !==
      null &&
    game
  ) {
    const selectedNumber =
      selectedCell
        ? game
            .board[
              selectedCell
                .row
            ][
              selectedCell
                .column
            ]
            .value
        : null;


    const previousBalance =
      completion
        ? Math.max(
            0,
            completion
              .balancePaise -
              completion
                .rewardPaise,
          )
        : 0;


        return (
      <>

        {diamondAnimation && (
          <DiamondFlyReward
            key={
              diamondAnimation.id
            }
            amount={
              diamondAnimation.amount
            }
            onDone={
              clearDiamondAnimation
            }
          />
        )}


      <div
        className="
          relative
          min-h-full
          w-full
          bg-[var(--app-bg)]
          app-text
          overflow-hidden
        "
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <style>
          {`
            @keyframes genzSudokuCelebrate {
              0% {
                opacity: 0;
                transform: scale(0.65);
              }

              70% {
                opacity: 1;
                transform: scale(1.08);
              }

              100% {
                opacity: 1;
                transform: scale(1);
              }
            }

            @keyframes genzSudokuCoinFly {
              0% {
                opacity: 0;
                transform: translate(0, 0) scale(0.6);
              }

              20% {
                opacity: 1;
              }

              100% {
                opacity: 0;
                transform: translate(34vw, -38vh) scale(0.25);
              }
            }

            @keyframes genzSudokuFire {
              0%, 100% {
                transform: translateY(0) rotate(-4deg);
              }

              50% {
                transform: translateY(-8px) rotate(4deg);
              }
            }

            @keyframes genzSudokuWrongShake {
              0%,
              100% {
                transform: translateX(0);
              }

              20% {
                transform: translateX(-7px);
              }

              40% {
                transform: translateX(7px);
              }

              60% {
                transform: translateX(-5px);
              }

              80% {
                transform: translateX(5px);
              }
            }

            .genzSudokuWrongAlert {
              animation:
                genzSudokuWrongShake
                0.38s
                ease-in-out;

              border-color:
                rgba(
                  239,
                  68,
                  68,
                  0.95
                ) !important;

              background:
                rgba(
                  239,
                  68,
                  68,
                  0.10
                ) !important;

              box-shadow:
                0 0 0 3px
                  rgba(
                    239,
                    68,
                    68,
                    0.22
                  ),
                0 0 28px
                  rgba(
                    239,
                    68,
                    68,
                    0.32
                  ) !important;
            }
          `}
        </style>


        <div className="sticky top-0 z-30 app-bg-secondary border-b app-border px-3 py-3">
          <div className="mx-auto max-w-lg flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={
                closeLevel
              }
              className="w-10 h-10 rounded-full app-surface border app-border flex items-center justify-center"
              aria-label="Back to Sudoku levels"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>


            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF4E00]">
                Sudoku
              </p>

              <p className="text-sm font-black">
                Level
                {" "}
                {
                  selectedLevel
                }
                {" "}
                •
                {" "}
                {
                  formatTime(
                    game
                      .elapsedSeconds,
                  )
                }
              </p>
            </div>


            <div className="flex items-center gap-1.5">

              <div className="rounded-xl bg-[#FF4E00]/10 border border-[#FF4E00]/20 px-2.5 py-2">

                <p className="text-[8px] uppercase font-black text-[#FF4E00]">
                  Balance
                </p>

                <p className="text-[11px] font-black">
                  {
                    formatGamePaise(
                      summary
                        ?.balancePaise ??
                      completion
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
                  completion
                    ?.todayDiamonds ??
                  0
                }
              />

            </div>
          </div>


          <div className="mx-auto max-w-lg mt-2 flex items-center justify-center gap-1">
            {[
              0,
              1,
              2,
            ].map(
              (
                index,
              ) => (
                <span
                  key={
                    index
                  }
                  className={`text-xl transition-all ${
                    index <
                    game.lives
                      ? "scale-100 opacity-100"
                      : "scale-75 grayscale opacity-25"
                  }`}
                >
                  ❤️
                </span>
              ),
            )}
          </div>
        </div>


        <div className="mx-auto w-full max-w-lg px-3 py-4 pb-8">
          <div
            className={`aspect-square w-full overflow-hidden rounded-xl border-2 border-[var(--app-text)]/70 app-surface shadow-xl transition-colors ${
              boardAlert
                ? "genzSudokuWrongAlert"
                : ""
            }`}
          >
            <div className="grid grid-cols-9 w-full h-full">
              {game.board.map(
                (
                  row,
                  rowIndex,
                ) =>
                  row.map(
                    (
                      cell,
                      columnIndex,
                    ) => {
                      const selected =
                        selectedCell
                          ?.row ===
                          rowIndex &&
                        selectedCell
                          ?.column ===
                          columnIndex;

                      const sameRow =
                        selectedCell &&
                        (
                          selectedCell
                            .row ===
                            rowIndex ||
                          selectedCell
                            .column ===
                            columnIndex
                        );

                      const sameBox =
                        selectedCell &&
                        Math.floor(
                          selectedCell
                            .row /
                            3,
                        ) ===
                          Math.floor(
                            rowIndex /
                              3,
                          ) &&
                        Math.floor(
                          selectedCell
                            .column /
                            3,
                        ) ===
                          Math.floor(
                            columnIndex /
                              3,
                          );

                      const sameNumber =
                        selectedNumber !==
                          null &&
                        cell.value ===
                          selectedNumber;


                      const boxIndex =
                        Math.floor(
                          rowIndex /
                            3,
                        ) *
                          3 +
                        Math.floor(
                          columnIndex /
                            3,
                        );


                      const completedBox =
                        completedBoxes[
                          boxIndex
                        ];


                      return (
                        <button
                          key={
                            `${rowIndex}-${columnIndex}`
                          }
                          type="button"
                          disabled={
                            game.status !==
                              "playing" ||
                            busyAd ||
                            isCompleting
                          }
                          onClick={() => {
                            setSelectedCell({
                              row:
                                rowIndex,

                              column:
                                columnIndex,
                            });
                          }}
                          className={`relative flex items-center justify-center aspect-square text-sm sm:text-lg font-black transition-all duration-200 ${
                            selected
                              ? "bg-[#FF4E00]/35 ring-2 ring-inset ring-[#FF4E00]/80"
                              : sameNumber
                                ? "bg-[#FF4E00]/22 ring-1 ring-inset ring-[#FF4E00]/55"
                                : completedBox
                                  ? "bg-emerald-500/12"
                                  : sameRow ||
                                      sameBox
                                    ? "bg-[#FF4E00]/7"
                                    : "app-surface"
                          } ${
                            cell.error
                              ? "text-red-500 bg-red-500/15 ring-1 ring-inset ring-red-500/60"
                              : cell.initial
                                ? "app-text"
                                : "text-[#FF4E00]"
                          }`}
                          style={{
                            borderRightWidth:
                              (
                                columnIndex +
                                1
                              ) %
                                3 ===
                                0 &&
                              columnIndex !==
                                8
                                ? "2px"
                                : "1px",

                            borderBottomWidth:
                              (
                                rowIndex +
                                1
                              ) %
                                3 ===
                                0 &&
                              rowIndex !==
                                8
                                ? "2px"
                                : "1px",

                            borderColor:
                              completedBox
                                ? "rgba(16, 185, 129, 0.48)"
                                : "var(--app-border)",
                          }}
                        >
                          {
                            cell.value ??
                            ""
                          }


                          {cell.value ===
                            null &&
                            cell.notes
                              .length >
                              0 && (
                              <span className="absolute inset-0 grid grid-cols-3 p-[1px] text-[7px] sm:text-[9px] app-text-muted">
                                {[
                                  1,
                                  2,
                                  3,
                                  4,
                                  5,
                                  6,
                                  7,
                                  8,
                                  9,
                                ].map(
                                  (
                                    number,
                                  ) => (
                                    <span
                                      key={
                                        number
                                      }
                                      className="flex items-center justify-center"
                                    >
                                      {
                                        cell.notes.includes(
                                          number,
                                        )
                                          ? number
                                          : ""
                                      }
                                    </span>
                                  ),
                                )}
                              </span>
                            )}
                        </button>
                      );
                    },
                  ),
              )}
            </div>
          </div>


          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={
                busyAd ||
                game.status !==
                  "playing"
              }
              onClick={() =>
                setNotesMode(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              className={`rounded-2xl border py-3 flex flex-col items-center gap-1 text-xs font-black ${
                notesMode
                  ? "bg-[#FF4E00] border-[#FF4E00] text-white"
                  : "app-surface border app-border"
              }`}
            >
              <Pencil className="w-4 h-4" />

              Notes
            </button>


            <button
              type="button"
              disabled={
                busyAd ||
                game.status !==
                  "playing"
              }
              onClick={
                handleErase
              }
              className="rounded-2xl app-surface border app-border py-3 flex flex-col items-center gap-1 text-xs font-black"
            >
              <Eraser className="w-4 h-4" />

              Erase
            </button>


            <button
              type="button"
              disabled={
                busyAd ||
                game.status !==
                  "playing"
              }
              onClick={() =>
                void handleHint()
              }
              className="rounded-2xl bg-amber-500/10 border border-amber-500/30 py-3 flex flex-col items-center gap-1 text-xs font-black text-amber-500"
            >
              <Lightbulb className="w-4 h-4" />

              Hint • Ad
            </button>
          </div>


          <div className="mt-4 grid grid-cols-9 gap-1.5">
            {[
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9,
            ].map(
              (
                number,
              ) => (
                <button
                  key={
                    number
                  }
                  type="button"
                  disabled={
                    completedNumbers[
                      number
                    ] ||
                    game.status !==
                      "playing" ||
                    busyAd ||
                    isCompleting
                  }
                  onClick={() =>
                    handleNumberInput(
                      number,
                    )
                  }
                  className={`aspect-square rounded-xl border text-sm sm:text-lg font-black transition-all active:scale-95 ${
                    completedNumbers[
                      number
                    ]
                      ? "opacity-25 app-surface border app-border"
                      : selectedNumber ===
                          number
                        ? "bg-[#FF4E00] border-[#FF4E00] text-white shadow-lg shadow-orange-500/20 scale-[1.04]"
                        : "app-surface border app-border hover:border-[#FF4E00] text-[#FF4E00]"
                  }`}
                >
                  {
                    number
                  }
                </button>
              ),
            )}
          </div>


          {completionError && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
              <p className="text-xs text-red-400">
                {
                  completionError
                }
              </p>

              <button
                type="button"
                onClick={() =>
                  void submitCompletion(
                    game.board,
                    game
                      .elapsedSeconds,
                  )
                }
                className="mt-3 rounded-xl bg-[#FF4E00] px-4 py-2 text-xs font-black text-white"
              >
                Verify Completion
              </button>
            </div>
          )}
        </div>


        {(busyAd ||
          isCompleting) && (
          <div className="fixed inset-0 z-[170] app-overlay backdrop-blur-sm flex items-center justify-center px-5">

            <div className="w-full max-w-xs rounded-3xl border app-border app-surface app-text app-shadow p-7 text-center">

              <RefreshCw className="mx-auto w-9 h-9 animate-spin text-orange-500" />

              <p className="mt-4 text-sm font-black">
                {
                  busyAd
                    ? "Loading rewarded ad..."
                    : "Verifying level..."
                }
              </p>

            </div>

          </div>
        )}


        {game.status ===
          "gameover" &&
          !busyAd && (
          <div className="fixed inset-0 z-[160] app-overlay backdrop-blur-md flex items-center justify-center px-5">
            <div className="w-full max-w-sm rounded-3xl border app-border app-surface app-text app-shadow p-6 text-center">
              <div className="text-7xl">
                💔
              </div>

              <h2 className="mt-4 text-3xl font-black">
                Out of Hearts
              </h2>

              <p className="mt-2 text-sm app-text-secondary leading-relaxed">
                Your puzzle is saved exactly where you stopped.
                Watch one rewarded ad to restore all 3 hearts and continue.
              </p>


              <button
                type="button"
                onClick={() =>
                  void handleContinueAfterGameOver()
                }
                className="mt-7 w-full rounded-2xl bg-[#FF4E00] py-4 text-sm font-black text-white"
              >
                🎬 Retry • Watch Ad
              </button>


              <button
                type="button"
                onClick={
                  closeLevel
                }
                className="mt-4 text-xs font-bold app-text-muted"
              >
                Back to Levels
              </button>
            </div>
          </div>
        )}


        {completion && (
          <div className="fixed inset-0 z-[180] overflow-hidden app-overlay backdrop-blur-md flex items-center justify-center px-5">
            {completion
              .rewardGranted &&
              Array.from({
                length:
                  12,
              }).map(
                (
                  _,
                  index,
                ) => (
                  <span
                    key={
                      index
                    }
                    className="absolute left-1/2 top-1/2 text-2xl animate-[genzSudokuCoinFly_1.25s_ease-in_forwards]"
                    style={{
                      animationDelay:
                        `${index * 55}ms`,

                      marginLeft:
                        `${(
                          index %
                          5
                        ) *
                          9 -
                        18}px`,

                      marginTop:
                        `${Math.floor(
                          index /
                            5,
                        ) *
                          8}px`,
                    }}
                  >
                    🪙
                  </span>
                ),
              )}


            <div className="relative z-10 w-full max-w-sm rounded-3xl border app-border app-surface app-text app-shadow p-6 text-center animate-[genzSudokuCelebrate_420ms_ease-out_forwards]">
              <div className="text-6xl animate-[genzSudokuFire_900ms_ease-in-out_infinite]">
                🔥🎉🔥
              </div>


              <h2 className="mt-4 text-3xl font-black">
                Level
                {" "}
                {
                  selectedLevel
                }
                {" "}
                Complete!
              </h2>


              {completion
                .rewardGranted ? (
                <>
                  <p className="mt-4 text-sm app-text-secondary">
                    Skill Reward
                  </p>

                  <p className="mt-1 text-4xl font-black text-emerald-400">
                    +
                    {
                      formatGamePaise(
                        completion
                          .rewardPaise,
                      )
                    }
                  </p>
                                    {completion
                    .diamondsGranted >
                    0 && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2">

                      <span>
                        💎
                      </span>

                      <span className="text-sm font-black text-cyan-300">
                        +
                        {
                          completion
                            .diamondsGranted
                        }
                        {" "}
                        Daily Diamonds
                      </span>

                    </div>
                  )}


                  <div className="mt-5 rounded-2xl border app-border app-surface-secondary p-4">
                    <div className="flex items-center justify-center gap-3">
                      <span className="app-text-muted line-through">
                        {
                          formatGamePaise(
                            previousBalance,
                          )
                        }
                      </span>

                      <span>
                        →
                      </span>

                      <span className="text-xl font-black text-emerald-400">
                        {
                          formatGamePaise(
                            completion
                              .balancePaise,
                          )
                        }
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] uppercase tracking-widest app-text-muted">
                      Game Balance
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border app-border app-surface-secondary p-4">
                  <p className="font-black">
                    Replay Complete
                  </p>

                  <p className="mt-1 text-xs app-text-muted">
                    The ₹0.05 reward for this level was already earned.
                  </p>
                </div>
              )}


              {selectedLevel <
                MAX_SUDOKU_LEVEL && (
                <button
                  type="button"
                  disabled={
                    busyLevel !==
                    null
                  }
                  onClick={() => {
                    const nextLevel =
                      selectedLevel +
                      1;


                    if (
                      nextLevel <=
                      highestUnlockedLevel
                    ) {
                      openLevel(
                        nextLevel,
                        false,
                      );

                      return;
                    }


                    void handleUnlockWithAd(
                      nextLevel,
                      true,
                    );
                  }}
                  className="mt-6 w-full rounded-2xl bg-[#FF4E00] py-4 text-sm font-black text-white"
                >
                  {selectedLevel +
                    1 <=
                  highestUnlockedLevel
                    ? `Play Level ${selectedLevel + 1}`
                    : `🎬 Watch Ad & Unlock Level ${selectedLevel + 1}`}
                </button>
              )}


              <button
                type="button"
                onClick={
                  closeLevel
                }
                className="mt-4 text-xs font-bold app-text-muted"
              >
                Back to Sudoku Levels
              </button>
            </div>
          </div>
        )}
            </div>

      </>
    );
  }


  /*
   * =====================================================
   * 1000 LEVEL SCREEN
   * =====================================================
   */
    return (

    <div
      className="
        min-h-full
        w-full
        bg-[var(--app-bg)]
        app-text
      "
      style={{
        paddingTop:
          "calc(env(safe-area-inset-top) + 8px)",
      }}
    >

      <div className="mx-auto w-full max-w-4xl px-4 pb-5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={
              onBack
            }
            className="w-10 h-10 rounded-full app-surface border app-border flex items-center justify-center"
            aria-label="Back to GenZGames"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>


          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black">
              Sudoku
            </h1>

            <p className="text-xs app-text-muted">
              1000 levels • Mixed difficulty
            </p>
          </div>


          <div className="flex items-center gap-2">

            <div className="rounded-xl bg-[#FF4E00]/10 border border-[#FF4E00]/20 px-2.5 py-2 text-right">

              <div className="flex items-center gap-1 text-[#FF4E00]">

                <WalletCards className="w-3.5 h-3.5" />

                <span className="text-[11px] font-black">
                  {
                    formatGamePaise(
                      summary
                        ?.balancePaise ??
                      0,
                    )
                  }
                </span>

              </div>

            </div>


            <DiamondCounter
              compact
              diamonds={
                summary
                  ?.diamonds
                  .today ??
                0
              }
            />

          </div>
        </div>


        <div className="mt-5 rounded-3xl bg-gradient-to-br from-[#FF4E00] via-orange-500 to-amber-400 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                Progress
              </p>

              <p className="mt-1 text-2xl font-black">
                {
                  summary
                    ?.sudoku
                    .completedLevels ??
                  0
                }
                /1000
              </p>
            </div>


            <Trophy className="w-9 h-9 text-white/90" />
          </div>


          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{
                width:
                  `${Math.min(
                    100,

                    (
                      (
                        summary
                          ?.sudoku
                          .completedLevels ??
                        0
                      ) /
                      MAX_SUDOKU_LEVEL
                    ) *
                      100,
                  )}%`,
              }}
            />
          </div>
        </div>


        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {Array.from(
            {
              length:
                SUDOKU_LEVEL_PAGE_COUNT,
            },
            (
              _,
              index,
            ) =>
              index,
          ).map(
            (
              page,
            ) => {
              const start =
                page *
                  SUDOKU_LEVELS_PER_PAGE +
                1;

              const end =
                Math.min(
                  MAX_SUDOKU_LEVEL,

                  start +
                    SUDOKU_LEVELS_PER_PAGE -
                    1,
                );


              return (
                <button
                  key={
                    page
                  }
                  type="button"
                  onClick={() =>
                    setLevelPage(
                      page,
                    )
                  }
                  className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black transition ${
                    levelPage ===
                    page
                      ? "bg-[#FF4E00] border-[#FF4E00] text-white"
                      : "app-surface border app-border app-text"
                  }`}
                >
                  {start}–{end}
                </button>
              );
            },
          )}
        </div>


        <div className="mt-4 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from(
            {
              length:
                levelPageEnd -
                levelPageStart +
                1,
            },
            (
              _,
              index,
            ) =>
              levelPageStart +
              index,
          ).map(
            (
              level,
            ) => {
              const completed =
                completedLevels.has(
                  level,
                );

              const available =
                level <=
                highestUnlockedLevel;

              const adUnlock =
                canUnlockWithAd(
                  level,
                );

              const loading =
                busyLevel ===
                level;


              return (
                <button
                  key={
                    level
                  }
                  type="button"
                  disabled={
                    !available &&
                    !adUnlock
                  }
                  onClick={() => {
                    if (
                      available
                    ) {
                      openLevel(
                        level,
                        completed,
                      );

                      return;
                    }


                    if (
                      adUnlock
                    ) {
                      void handleUnlockWithAd(
                        level,
                        true,
                      );
                    }
                  }}
                  className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition active:scale-95 ${
                    completed
                      ? "app-surface border-emerald-500"
                      : available
                        ? "app-surface border-[#FF4E00]/40 hover:border-[#FF4E00]"
                        : adUnlock
                          ? "app-surface border-amber-400"
                          : "app-surface-secondary border-transparent opacity-45"
                  }`}
                >
                  {completed ? (
                    <span className="text-base">
                      ✅
                    </span>
                  ) : available ? (
                    <Play className="w-4 h-4 text-[#FF4E00]" />
                  ) : adUnlock ? (
                    <span className="text-base">
                      🎬
                    </span>
                  ) : (
                    <Lock className="w-3.5 h-3.5 app-text-muted" />
                  )}


                  <span className="mt-0.5 text-[10px] font-black">
                    {
                      level
                    }
                  </span>


                  {loading && (
                    <RefreshCw className="absolute inset-0 m-auto w-4 h-4 animate-spin" />
                  )}
                </button>
              );
            },
          )}
        </div>


        <div className="mt-6 rounded-2xl app-surface border app-border p-4 text-center">
          <p className="text-xs font-bold app-text-secondary">
            Complete a level → earn ₹0.05 once
          </p>

          <p className="mt-1 text-[10px] app-text-muted">
            Complete the rewarded ad to unlock the next level.
          </p>
        </div>
      </div>
    </div>
  );
};