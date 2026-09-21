export interface GenZSudokuCell {
  value: number | null;

  initial: boolean;

  notes: number[];

  error?: boolean;
}


export type GenZSudokuBoard =
  GenZSudokuCell[][];


export type GenZSudokuGameStatus =
  | "playing"
  | "gameover";


export interface SavedGenZSudokuGame {
  version: 1;

  level: number;

  board: GenZSudokuBoard;

  elapsedSeconds: number;

  lives: number;

  status: GenZSudokuGameStatus;

  updatedAt: number;
}


const MAX_SUDOKU_LEVEL =
  100;


export const formatGamePaise = (
  paise: number,
) => {
  const safePaise =
    Number.isFinite(
      paise,
    )
      ? Math.max(
          0,
          Math.floor(
            paise,
          ),
        )
      : 0;


  return `₹${(
    safePaise /
    100
  ).toFixed(
    2,
  )}`;
};


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


const shuffleWithRandom =
  <T,>(
    values: T[],
    random:
      () => number,
  ): T[] => {
    const result =
      [
        ...values,
      ];


    for (
      let index =
        result.length -
        1;
      index >
      0;
      index -=
        1
    ) {
      const swapIndex =
        Math.floor(
          random() *
            (
              index +
              1
            ),
        );


      [
        result[index],
        result[swapIndex],
      ] = [
        result[swapIndex],
        result[index],
      ];
    }


    return result;
  };


const canPlaceNumber = (
  board: number[][],
  row: number,
  column: number,
  number: number,
) => {
  for (
    let index = 0;
    index < 9;
    index += 1
  ) {
    if (
      board[row][index] ===
        number ||
      board[index][column] ===
        number
    ) {
      return false;
    }
  }


  const boxRow =
    Math.floor(
      row /
        3,
    ) *
    3;

  const boxColumn =
    Math.floor(
      column /
        3,
    ) *
    3;


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
      if (
        board[
          boxRow +
            rowOffset
        ][
          boxColumn +
            columnOffset
        ] ===
        number
      ) {
        return false;
      }
    }
  }


  return true;
};


const getCandidates = (
  board: number[][],
  row: number,
  column: number,
) => {
  const candidates:
    number[] = [];


  for (
    let number = 1;
    number <= 9;
    number += 1
  ) {
    if (
      canPlaceNumber(
        board,
        row,
        column,
        number,
      )
    ) {
      candidates.push(
        number,
      );
    }
  }


  return candidates;
};


const countSolutions = (
  sourceBoard:
    number[][],
  limit =
    2,
) => {
  const board =
    sourceBoard.map(
      (row) => [
        ...row,
      ],
    );


  let solutions =
    0;


  const search =
    () => {
      if (
        solutions >=
        limit
      ) {
        return;
      }


      let targetRow =
        -1;

      let targetColumn =
        -1;

      let bestCandidates:
        number[] |
        null =
        null;


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
            board[row][column] !==
            0
          ) {
            continue;
          }


          const candidates =
            getCandidates(
              board,
              row,
              column,
            );


          if (
            candidates.length ===
            0
          ) {
            return;
          }


          if (
            bestCandidates ===
              null ||
            candidates.length <
              bestCandidates.length
          ) {
            targetRow =
              row;

            targetColumn =
              column;

            bestCandidates =
              candidates;
          }


          if (
            candidates.length ===
            1
          ) {
            break;
          }
        }


        if (
          bestCandidates
            ?.length ===
          1
        ) {
          break;
        }
      }


      if (
        targetRow ===
        -1 ||
        targetColumn ===
        -1
      ) {
        solutions +=
          1;

        return;
      }


      for (
        const number of
        bestCandidates ??
        []
      ) {
        board[
          targetRow
        ][
          targetColumn
        ] =
          number;


        search();


        board[
          targetRow
        ][
          targetColumn
        ] =
          0;


        if (
          solutions >=
          limit
        ) {
          return;
        }
      }
    };


  search();


  return solutions;
};


const getSudokuSeed = (
  level: number,
) =>
  (
    0x9e3779b9 ^
    Math.imul(
      level,
      0x85ebca6b,
    )
  ) >>>
  0;


export const generateGenZSudokuLevel =
  (
    requestedLevel:
      number,
  ) => {
    const level =
      Math.min(
        MAX_SUDOKU_LEVEL,
        Math.max(
          1,
          Math.floor(
            requestedLevel,
          ),
        ),
      );


    const random =
      createSeededRandom(
        getSudokuSeed(
          level,
        ),
      );


    const groups =
      [
        0,
        1,
        2,
      ];


    const rows =
      shuffleWithRandom(
        groups,
        random,
      ).flatMap(
        (group) =>
          shuffleWithRandom(
            groups,
            random,
          ).map(
            (row) =>
              group *
                3 +
              row,
          ),
      );


    const columns =
      shuffleWithRandom(
        groups,
        random,
      ).flatMap(
        (group) =>
          shuffleWithRandom(
            groups,
            random,
          ).map(
            (column) =>
              group *
                3 +
              column,
          ),
      );


    const numbers =
      shuffleWithRandom(
        [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
        ],
        random,
      );


    const pattern =
      (
        row:
          number,
        column:
          number,
      ) =>
        (
          row *
            3 +
          Math.floor(
            row /
              3,
          ) +
          column
        ) %
        9;


    const solution =
      rows.map(
        (row) =>
          columns.map(
            (column) =>
              numbers[
                pattern(
                  row,
                  column,
                )
              ],
          ),
      );


    const puzzle =
      solution.map(
        (row) => [
          ...row,
        ],
      );


    /*
     * Level 1:
     * approximately 51 clues.
     *
     * Level 100:
     * approximately 25 clues.
     *
     * Every removal is accepted only
     * when the puzzle still has exactly
     * one solution.
     */
    const targetRemovals =
      30 +
      Math.floor(
        (
          (
            level -
            1
          ) *
          26
        ) /
          99,
      );


    const positions =
      shuffleWithRandom(
        Array.from(
          {
            length:
              81,
          },
          (
            _,
            index,
          ) =>
            index,
        ),
        random,
      );


    let removed =
      0;


    for (
      const position of
      positions
    ) {
      if (
        removed >=
        targetRemovals
      ) {
        break;
      }


      const row =
        Math.floor(
          position /
            9,
        );

      const column =
        position %
        9;

      const previousValue =
        puzzle[row][column];


      puzzle[row][column] =
        0;


      if (
        countSolutions(
          puzzle,
          2,
        ) ===
        1
      ) {
        removed +=
          1;
      } else {
        puzzle[row][column] =
          previousValue;
      }
    }


    return {
      level,

      puzzle,

      solution:
        solution.map(
          (row) => [
            ...row,
          ],
        ),
    };
  };


export const createGenZSudokuBoard =
  (
    puzzle:
      number[][],
  ): GenZSudokuBoard =>
    puzzle.map(
      (row) =>
        row.map(
          (value) => ({
            value:
              value ===
              0
                ? null
                : value,

            initial:
              value !==
              0,

            notes:
              [],

            error:
              false,
          }),
        ),
    );


export const cloneGenZSudokuBoard =
  (
    board:
      GenZSudokuBoard,
  ): GenZSudokuBoard =>
    board.map(
      (row) =>
        row.map(
          (cell) => ({
            ...cell,

            notes:
              [
                ...cell.notes,
              ],
          }),
        ),
    );


const getStorageKey = (
  userId: string,
  level: number,
) =>
  `mini_games_hub_sudoku_${userId}_${level}`;


export const loadSavedGenZSudokuGame =
  (
    userId: string,
    level: number,
  ):
    | SavedGenZSudokuGame
    | null => {
    try {
      const raw =
        localStorage.getItem(
          getStorageKey(
            userId,
            level,
          ),
        );


      if (!raw) {
        return null;
      }


      const parsed =
        JSON.parse(
          raw,
        ) as
          Partial<
            SavedGenZSudokuGame
          >;


      if (
        parsed.version !==
          1 ||
        parsed.level !==
          level ||
        !Array.isArray(
          parsed.board,
        ) ||
        parsed.board.length !==
          9
      ) {
        return null;
      }


      return {
        version:
          1,

        level,

        board:
          cloneGenZSudokuBoard(
            parsed.board as
              GenZSudokuBoard,
          ),

        elapsedSeconds:
          typeof parsed
            .elapsedSeconds ===
          "number"
            ? Math.max(
                0,
                Math.floor(
                  parsed
                    .elapsedSeconds,
                ),
              )
            : 0,

        lives:
          typeof parsed.lives ===
          "number"
            ? Math.min(
                3,
                Math.max(
                  0,
                  Math.floor(
                    parsed.lives,
                  ),
                ),
              )
            : 3,

        status:
          parsed.status ===
          "gameover"
            ? "gameover"
            : "playing",

        updatedAt:
          typeof parsed.updatedAt ===
          "number"
            ? parsed.updatedAt
            : Date.now(),
      };
    } catch {
      return null;
    }
  };


export const saveGenZSudokuGame =
  (
    userId: string,
    game:
      SavedGenZSudokuGame,
  ) => {
    try {
      localStorage.setItem(
        getStorageKey(
          userId,
          game.level,
        ),
        JSON.stringify({
          ...game,

          board:
            cloneGenZSudokuBoard(
              game.board,
            ),

          updatedAt:
            Date.now(),
        }),
      );
    } catch {
      /*
       * Local resume is optional.
       * Backend earnings/progress are
       * still authoritative.
       */
    }
  };


export const clearSavedGenZSudokuGame =
  (
    userId: string,
    level: number,
  ) => {
    try {
      localStorage.removeItem(
        getStorageKey(
          userId,
          level,
        ),
      );
    } catch {
      // Ignore local storage errors.
    }
  };


export const boardToNumberMatrix =
  (
    board:
      GenZSudokuBoard,
  ) =>
    board.map(
      (row) =>
        row.map(
          (cell) =>
            cell.value ??
            0,
        ),
    );