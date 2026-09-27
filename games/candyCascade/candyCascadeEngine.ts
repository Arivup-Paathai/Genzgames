import {
  CANDY_CASCADE_ALL_COLORS,
  CANDY_CASCADE_COLUMNS,
  CANDY_CASCADE_EXTRA_MOVES,
  CANDY_CASCADE_MAX_BOARD_BUILD_ATTEMPTS,
  CANDY_CASCADE_MAX_CASCADE_STEPS_PER_MOVE,
  CANDY_CASCADE_MAX_COMBO_MULTIPLIER,
  CANDY_CASCADE_MAX_CONTINUES,
  CANDY_CASCADE_MAX_RUN_EVENTS,
  CANDY_CASCADE_MAX_SHUFFLES,
  CANDY_CASCADE_ROWS,
  CANDY_CASCADE_SCORE_PER_BLOCKER_LAYER,
  CANDY_CASCADE_SCORE_PER_DROP_ITEM,
  CANDY_CASCADE_SCORE_PER_JELLY_LAYER,
  CANDY_CASCADE_SCORE_PER_NORMAL_PIECE,
  CANDY_CASCADE_SCORE_PER_SPECIAL_PIECE,
  generateCandyCascadeLevel,
} from "./candyCascadeConstants";

import type {
  CandyCascadeBoard,
  CandyCascadeCascadeStep,
  CandyCascadeCell,
  CandyCascadeColor,
  CandyCascadeContinueEvent,
  CandyCascadeGameState,
  CandyCascadeLevelConfig,
  CandyCascadeMatchGroup,
  CandyCascadeMoveResolution,
  CandyCascadeObjectiveProgress,
  CandyCascadePoint,
  CandyCascadeRunEvent,
  CandyCascadeSpecialCombination,
  CandyCascadeSpecialCreation,
  CandyCascadeSpecialType,
  CandyCascadeSwapEvent,
} from "./candyCascadeTypes";


/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE DETERMINISTIC ENGINE
 * ============================================================
 *
 * CRITICAL RULE:
 *
 * Never use:
 *
 * Math.random()
 * Date.now()
 * performance.now()
 *
 * anywhere inside deterministic gameplay.
 *
 * Frontend and backend must produce the exact same result from:
 *
 * level
 * + seed
 * + player run events
 */


/*
 * ============================================================
 * INTERNAL TYPES
 * ============================================================
 */

interface RandomContext {
  seed:
    number;

  randomStep:
    number;

  nextPieceId:
    number;

  nextDropItemId:
    number;
}


interface MatchRun {
  color:
    CandyCascadeColor;

  cells:
    CandyCascadePoint[];

  orientation:
    "ROW" |
    "COLUMN";
}


interface RemovalOutcome {
  board:
    CandyCascadeBoard;

  removedPieces:
    number;

  removedSpecialPieces:
    number;

  destroyedJellyLayers:
    number;

  destroyedBlockerLayers:
    number;

  collectedColors:
    Partial<
      Record<
        CandyCascadeColor,
        number
      >
    >;
}


interface GravityOutcome {
  board:
    CandyCascadeBoard;

  droppedItems:
    number;
}


interface ResolutionTotals {
  removedPieces:
    number;

  destroyedJellyLayers:
    number;

  destroyedBlockerLayers:
    number;

  droppedItems:
    number;

  gainedScore:
    number;

  cascadeCount:
    number;

  createdSpecials:
    CandyCascadeSpecialCreation[];
}


interface CascadeResolution {
  state:
    CandyCascadeGameState;

  context:
    RandomContext;

  totals:
    ResolutionTotals;

  steps:
    CandyCascadeCascadeStep[];
}


export interface CandyCascadeContinueResult {
  state:
    CandyCascadeGameState;

  accepted:
    boolean;
}


export interface CandyCascadeReplayResult {
  valid:
    boolean;

  state:
    CandyCascadeGameState;

  invalidEventIndex:
    number |
    null;

  reason:
    string |
    null;
}


/*
 * ============================================================
 * SMALL HELPERS
 * ============================================================
 */

const clamp =
  (
    value:
      number,

    minimum:
      number,

    maximum:
      number,
  ) =>
    Math.max(
      minimum,
      Math.min(
        maximum,
        value,
      ),
    );


const pointKey =
  (
    point:
      CandyCascadePoint,
  ) =>
    `${point.row}:${point.col}`;


const parsePointKey =
  (
    key:
      string,
  ): CandyCascadePoint => {

    const [
      row,
      col,
    ] =
      key
        .split(":")
        .map(
          Number,
        );


    return {
      row,
      col,
    };
  };


const samePoint =
  (
    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,
  ) =>
    first.row ===
      second.row &&
    first.col ===
      second.col;


const insideBoard =
  (
    row:
      number,

    col:
      number,
  ) =>
    row >=
      0 &&
    row <
      CANDY_CASCADE_ROWS &&
    col >=
      0 &&
    col <
      CANDY_CASCADE_COLUMNS;


const areAdjacent =
  (
    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,
  ) =>
    Math.abs(
      first.row -
        second.row,
    ) +
      Math.abs(
        first.col -
          second.col,
      ) ===
    1;


const getOrthogonalNeighbors =
  (
    point:
      CandyCascadePoint,
  ): CandyCascadePoint[] => {

    const candidates:
      CandyCascadePoint[] = [
      {
        row:
          point.row -
          1,

        col:
          point.col,
      },

      {
        row:
          point.row +
          1,

        col:
          point.col,
      },

      {
        row:
          point.row,

        col:
          point.col -
          1,
      },

      {
        row:
          point.row,

        col:
          point.col +
          1,
      },
    ];


    return candidates.filter(
      candidate =>
        insideBoard(
          candidate.row,
          candidate.col,
        ),
    );
  };


/*
 * ============================================================
 * DEEP BOARD CLONE
 * ============================================================
 */

export const cloneCandyCascadeBoard =
  (
    board:
      CandyCascadeBoard,
  ): CandyCascadeBoard =>
    board.map(
      row =>
        row.map(
          cell => ({
            ...cell,

            piece:
              cell.piece
                ? {
                    ...cell.piece,
                  }
                : null,

            blocker: {
              ...cell.blocker,
            },

            dropItem:
              cell.dropItem
                ? {
                    ...cell.dropItem,
                  }
                : null,

            portalTarget:
              cell.portalTarget
                ? {
                    ...cell.portalTarget,
                  }
                : null,
          }),
        ),
    );


/*
 * ============================================================
 * DETERMINISTIC RANDOM
 * ============================================================
 *
 * Same architecture principle we use in the other verified
 * GenZGames engines.
 */

export const candyCascadeRandomAtStep =
  (
    seed:
      number,

    step:
      number,
  ): number => {

    let value =
      (
        (
          seed >>>
          0
        ) +
        Math.imul(
          (
            step +
            1
          ) >>>
            0,

          0x9e3779b9,
        )
      ) >>>
      0;


    value ^=
      value >>>
      16;


    value =
      Math.imul(
        value,
        0x21f0aaad,
      ) >>>
      0;


    value ^=
      value >>>
      15;


    value =
      Math.imul(
        value,
        0x735a2d97,
      ) >>>
      0;


    value ^=
      value >>>
      15;


    return (
      value >>>
      0
    ) /
      4294967296;
  };


const nextRandom =
  (
    context:
      RandomContext,
  ) => {

    const value =
      candyCascadeRandomAtStep(
        context.seed,
        context.randomStep,
      );


    context.randomStep +=
      1;


    return value;
  };


const chooseRandom =
  <T,>(
    values:
      T[],

    context:
      RandomContext,
  ): T => {

    const index =
      Math.min(
        values.length -
          1,

        Math.floor(
          nextRandom(
            context,
          ) *
            values.length,
        ),
      );


    return values[
      Math.max(
        0,
        index,
      )
    ];
  };


/*
 * ============================================================
 * CELL RULES
 * ============================================================
 */

const isHardBlocked =
  (
    cell:
      CandyCascadeCell,
  ) =>
    cell.blocker.layers >
      0 &&
    (
      cell.blocker.type ===
        "LICORICE" ||
      cell.blocker.type ===
        "CRATE"
    );


const canHoldOccupant =
  (
    cell:
      CandyCascadeCell,
  ) =>
    cell.active &&
    !isHardBlocked(
      cell,
    );


const hasOccupant =
  (
    cell:
      CandyCascadeCell,
  ) =>
    Boolean(
      cell.piece ||
      cell.dropItem,
    );


const canPlayerSwapCell =
  (
    cell:
      CandyCascadeCell,
  ) =>
    canHoldOccupant(
      cell,
    ) &&
    hasOccupant(
      cell,
    );


/*
 * ============================================================
 * PIECE HELPERS
 * ============================================================
 */

const createPiece =
  (
    color:
      CandyCascadeColor,

    special:
      CandyCascadeSpecialType,

    context:
      RandomContext,
  ) => {

    const piece = {
      id:
        context.nextPieceId,

      color,

      special,
    };


    context.nextPieceId +=
      1;


    return piece;
  };


const createNormalPiece =
  (
    colors:
      CandyCascadeColor[],

    context:
      RandomContext,
  ) =>
    createPiece(
      chooseRandom(
        colors,
        context,
      ),
      "NONE",
      context,
    );


/*
 * ============================================================
 * TEMPLATE BOARD
 * ============================================================
 */

const createBoardTemplate =
  (
    config:
      CandyCascadeLevelConfig,

    context:
      RandomContext,
  ): CandyCascadeBoard => {

    const blockerMap =
      new Map<
        string,
        {
          type:
            CandyCascadeCell[
              "blocker"
            ]["type"];

          layers:
            number;
        }
      >();


    config.blockers.forEach(
      blocker => {

        blockerMap.set(
          pointKey(
            blocker,
          ),
          {
            type:
              blocker.type,

            layers:
              blocker.layers,
          },
        );
      },
    );


    const dropMap =
      new Map<
        string,
        CandyCascadeCell[
          "dropItem"
        ]
      >();


    config.dropItems.forEach(
      item => {

        dropMap.set(
          pointKey(
            item,
          ),
          {
            id:
              context.nextDropItemId,

            type:
              item.type,
          },
        );


        context.nextDropItemId +=
          1;
      },
    );


    const exitKeys =
      new Set(
        config.dropExits.map(
          pointKey,
        ),
      );


    return Array.from(
      {
        length:
          config.rows,
      },
      (
        _,
        row,
      ) =>
        Array.from(
          {
            length:
              config.columns,
          },
          (
            __,
            col,
          ) => {

            const active =
              Boolean(
                config.activeMask[
                  row
                ]?.[
                  col
                ],
              );


            const key =
              `${row}:${col}`;


            const blocker =
              blockerMap.get(
                key,
              );


            const dropItem =
              dropMap.get(
                key,
              );


            return {
              row,

              col,

              active,

              piece:
                null,

              blocker:
                blocker
                  ? {
                      ...blocker,
                    }
                  : {
                      type:
                        "NONE",

                      layers:
                        0,
                    },

              jellyLayers:
                config.jellyMask[
                  row
                ]?.[
                  col
                ] ??
                0,

              dropItem:
                dropItem
                  ? {
                      ...dropItem,
                    }
                  : null,

              isDropExit:
                exitKeys.has(
                  key,
                ),

              portalId:
                null,

              portalTarget:
                null,

              conveyor:
                "NONE",
            };
          },
        ),
    );
  };


/*
 * ============================================================
 * INITIAL OBJECTIVE PROGRESS
 * ============================================================
 */

const createObjectiveProgress =
  (
    config:
      CandyCascadeLevelConfig,
  ): CandyCascadeObjectiveProgress[] =>
    config.objectives.map(
      objective => {

        if (
          objective.type ===
          "SCORE"
        ) {

          return {
            type:
              "SCORE",

            color:
              null,

            current:
              0,

            target:
              objective.targetScore,

            completed:
              false,
          };
        }


        if (
          objective.type ===
          "COLLECT_COLOR"
        ) {

          return {
            type:
              "COLLECT_COLOR",

            color:
              objective.color,

            current:
              0,

            target:
              objective.targetCount,

            completed:
              false,
          };
        }


        if (
          objective.type ===
          "CLEAR_JELLY"
        ) {

          return {
            type:
              "CLEAR_JELLY",

            color:
              null,

            current:
              0,

            target:
              objective.targetLayers,

            completed:
              false,
          };
        }


        if (
          objective.type ===
          "BREAK_BLOCKERS"
        ) {

          return {
            type:
              "BREAK_BLOCKERS",

            color:
              null,

            current:
              0,

            target:
              objective.targetLayers,

            completed:
              false,
          };
        }


        return {
          type:
            "DROP_ITEMS",

          color:
            null,

          current:
            0,

          target:
            objective.targetCount,

          completed:
            false,
        };
      },
    );


/*
 * ============================================================
 * MATCHABLE PIECE
 * ============================================================
 */

const getMatchPiece =
  (
    board:
      CandyCascadeBoard,

    row:
      number,

    col:
      number,
  ) => {

    const cell =
      board[
        row
      ]?.[
        col
      ];


    if (
      !cell ||
      !cell.active ||
      !cell.piece ||
      cell.piece.special ===
        "COLOR_BOMB"
    ) {
      return null;
    }


    return cell.piece;
  };


/*
 * ============================================================
 * FIND STRAIGHT MATCH RUNS
 * ============================================================
 */

const findMatchRuns =
  (
    board:
      CandyCascadeBoard,
  ): MatchRun[] => {

    const runs:
      MatchRun[] =
      [];


    /*
     * Horizontal.
     */
    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      let col =
        0;


      while (
        col <
        CANDY_CASCADE_COLUMNS
      ) {

        const piece =
          getMatchPiece(
            board,
            row,
            col,
          );


        if (
          !piece
        ) {

          col +=
            1;

          continue;
        }


        let end =
          col +
          1;


        while (
          end <
            CANDY_CASCADE_COLUMNS &&
          getMatchPiece(
            board,
            row,
            end,
          )?.color ===
            piece.color
        ) {

          end +=
            1;
        }


        if (
          end -
            col >=
          3
        ) {

          const cells:
            CandyCascadePoint[] =
            [];


          for (
            let current =
              col;

            current <
              end;

            current +=
              1
          ) {

            cells.push({
              row,

              col:
                current,
            });
          }


          runs.push({
            color:
              piece.color,

            cells,

            orientation:
              "ROW",
          });
        }


        col =
          end;
      }
    }


    /*
     * Vertical.
     */
    for (
      let col =
        0;

      col <
      CANDY_CASCADE_COLUMNS;

      col +=
        1
    ) {

      let row =
        0;


      while (
        row <
        CANDY_CASCADE_ROWS
      ) {

        const piece =
          getMatchPiece(
            board,
            row,
            col,
          );


        if (
          !piece
        ) {

          row +=
            1;

          continue;
        }


        let end =
          row +
          1;


        while (
          end <
            CANDY_CASCADE_ROWS &&
          getMatchPiece(
            board,
            end,
            col,
          )?.color ===
            piece.color
        ) {

          end +=
            1;
        }


        if (
          end -
            row >=
          3
        ) {

          const cells:
            CandyCascadePoint[] =
            [];


          for (
            let current =
              row;

            current <
              end;

            current +=
              1
          ) {

            cells.push({
              row:
                current,

              col,
            });
          }


          runs.push({
            color:
              piece.color,

            cells,

            orientation:
              "COLUMN",
          });
        }


        row =
          end;
      }
    }


    return runs;
  };


/*
 * ============================================================
 * MERGE OVERLAPPING RUNS INTO T / L / CROSS GROUPS
 * ============================================================
 */

const runsOverlap =
  (
    first:
      MatchRun,

    second:
      MatchRun,
  ) => {

    if (
      first.color !==
      second.color
    ) {
      return false;
    }


    const keys =
      new Set(
        first.cells.map(
          pointKey,
        ),
      );


    return second.cells.some(
      point =>
        keys.has(
          pointKey(
            point,
          ),
        ),
    );
  };


const classifyMatchShape =
  (
    cells:
      CandyCascadePoint[],

    orientations:
      Set<
        "ROW" |
        "COLUMN"
      >,
  ):
    CandyCascadeMatchGroup[
      "shape"
    ] => {

    if (
      orientations.size ===
      1
    ) {
      return "LINE";
    }


    const cellKeys =
      new Set(
        cells.map(
          pointKey,
        ),
      );


    let highestArms =
      0;


    cells.forEach(
      point => {

        let arms =
          0;


        const neighbors = [
          {
            row:
              point.row -
              1,

            col:
              point.col,
          },

          {
            row:
              point.row +
              1,

            col:
              point.col,
          },

          {
            row:
              point.row,

            col:
              point.col -
              1,
          },

          {
            row:
              point.row,

            col:
              point.col +
              1,
          },
        ];


        neighbors.forEach(
          neighbor => {

            if (
              cellKeys.has(
                pointKey(
                  neighbor,
                ),
              )
            ) {
              arms +=
                1;
            }
          },
        );


        highestArms =
          Math.max(
            highestArms,
            arms,
          );
      },
    );


    if (
      highestArms >=
      4
    ) {
      return "CROSS";
    }


    if (
      highestArms ===
      3
    ) {
      return "T_SHAPE";
    }


    return "L_SHAPE";
  };


export const findCandyCascadeMatchGroups =
  (
    board:
      CandyCascadeBoard,
  ): CandyCascadeMatchGroup[] => {

    const runs =
      findMatchRuns(
        board,
      );


    const visited =
      new Set<number>();


    const groups:
      CandyCascadeMatchGroup[] =
      [];


    for (
      let index =
        0;

      index <
      runs.length;

      index +=
        1
    ) {

      if (
        visited.has(
          index,
        )
      ) {
        continue;
      }


      const queue = [
        index,
      ];


      visited.add(
        index,
      );


      const componentRuns:
        MatchRun[] =
        [];


      while (
        queue.length >
        0
      ) {

        const currentIndex =
          queue.shift();


        if (
          currentIndex ===
          undefined
        ) {
          break;
        }


        const current =
          runs[
            currentIndex
          ];


        componentRuns.push(
          current,
        );


        for (
          let candidateIndex =
            0;

          candidateIndex <
          runs.length;

          candidateIndex +=
            1
        ) {

          if (
            visited.has(
              candidateIndex,
            )
          ) {
            continue;
          }


          const candidate =
            runs[
              candidateIndex
            ];


          if (
            componentRuns.some(
              existing =>
                runsOverlap(
                  existing,
                  candidate,
                ),
            )
          ) {

            visited.add(
              candidateIndex,
            );


            queue.push(
              candidateIndex,
            );
          }
        }
      }


      const cellsByKey =
        new Map<
          string,
          CandyCascadePoint
        >();


      const orientations =
        new Set<
          "ROW" |
          "COLUMN"
        >();


      componentRuns.forEach(
        run => {

          orientations.add(
            run.orientation,
          );


          run.cells.forEach(
            point => {

              cellsByKey.set(
                pointKey(
                  point,
                ),
                point,
              );
            },
          );
        },
      );


      const cells =
        Array.from(
          cellsByKey.values(),
        );


      groups.push({
        color:
          componentRuns[0]
            .color,

        cells,

        shape:
          classifyMatchShape(
            cells,
            orientations,
          ),

        orientation:
          orientations.size ===
            1
            ? Array.from(
                orientations,
              )[0]
            : null,
      });
    }


    return groups;
  };


/*
 * ============================================================
 * SPECIAL CREATION
 * ============================================================
 */

const getSpecialTypeForMatch =
  (
    group:
      CandyCascadeMatchGroup,
  ): CandyCascadeSpecialType => {

    if (
      group.shape !==
      "LINE"
    ) {
      return "WRAPPED";
    }


    if (
      group.cells.length >=
      5
    ) {
      return "COLOR_BOMB";
    }


    if (
      group.cells.length ===
      4
    ) {

      return group.orientation ===
        "ROW"
        ? "STRIPED_ROW"
        : "STRIPED_COLUMN";
    }


    return "NONE";
  };


const chooseSpecialCreationPoint =
  (
    board:
      CandyCascadeBoard,

    group:
      CandyCascadeMatchGroup,

    preferredPoints:
      CandyCascadePoint[],
  ): CandyCascadePoint |
    null => {

    const groupKeys =
      new Set(
        group.cells.map(
          pointKey,
        ),
      );


    /*
     * Prefer the actual swapped piece.
     */
    for (
      const preferred of
      preferredPoints
    ) {

      if (
        groupKeys.has(
          pointKey(
            preferred,
          ),
        )
      ) {

        const piece =
          board[
            preferred.row
          ]?.[
            preferred.col
          ]?.piece;


        if (
          piece &&
          piece.special ===
            "NONE"
        ) {
          return preferred;
        }
      }
    }


    /*
     * Prefer a normal piece.
     */
    const normal =
      group.cells.filter(
        point =>
          board[
            point.row
          ]?.[
            point.col
          ]?.piece
            ?.special ===
          "NONE",
      );


    const candidates =
      normal.length >
        0
        ? normal
        : group.cells;


    if (
      candidates.length ===
      0
    ) {
      return null;
    }


    const averageRow =
      candidates.reduce(
        (
          total,
          point,
        ) =>
          total +
          point.row,
        0,
      ) /
      candidates.length;


    const averageCol =
      candidates.reduce(
        (
          total,
          point,
        ) =>
          total +
          point.col,
        0,
      ) /
      candidates.length;


    return [
      ...candidates,
    ].sort(
      (
        first,
        second,
      ) => {

        const firstDistance =
          Math.abs(
            first.row -
              averageRow,
          ) +
          Math.abs(
            first.col -
              averageCol,
          );


        const secondDistance =
          Math.abs(
            second.row -
              averageRow,
          ) +
          Math.abs(
            second.col -
              averageCol,
          );


        if (
          firstDistance !==
          secondDistance
        ) {
          return firstDistance -
            secondDistance;
        }


        if (
          first.row !==
          second.row
        ) {
          return first.row -
            second.row;
        }


        return first.col -
          second.col;
      },
    )[0];
  };


const createSpecialsForGroups =
  (
    board:
      CandyCascadeBoard,

    groups:
      CandyCascadeMatchGroup[],

    preferredPoints:
      CandyCascadePoint[],
  ): CandyCascadeSpecialCreation[] => {

    const creations:
      CandyCascadeSpecialCreation[] =
      [];


    const occupied =
      new Set<string>();


    groups.forEach(
      group => {

        const special =
          getSpecialTypeForMatch(
            group,
          );


        if (
          special ===
          "NONE"
        ) {
          return;
        }


        const position =
          chooseSpecialCreationPoint(
            board,
            group,
            preferredPoints,
          );


        if (
          !position
        ) {
          return;
        }


        const key =
          pointKey(
            position,
          );


        if (
          occupied.has(
            key,
          )
        ) {
          return;
        }


        occupied.add(
          key,
        );


        creations.push({
          position,

          special,

          color:
            group.color,
        });
      },
    );


    return creations;
  };


/*
 * ============================================================
 * SPECIAL COMBINATION IDENTIFICATION
 * ============================================================
 */

const isStriped =
  (
    special:
      CandyCascadeSpecialType,
  ) =>
    special ===
      "STRIPED_ROW" ||
    special ===
      "STRIPED_COLUMN";


const getSpecialCombination =
  (
    first:
      CandyCascadeCell[
        "piece"
      ],

    second:
      CandyCascadeCell[
        "piece"
      ],
  ): CandyCascadeSpecialCombination => {

    if (
      !first ||
      !second
    ) {
      return "NONE";
    }


    const a =
      first.special;


    const b =
      second.special;


    if (
      a ===
        "COLOR_BOMB" &&
      b ===
        "COLOR_BOMB"
    ) {
      return "COLOR_BOMB_COLOR_BOMB";
    }


    if (
      a ===
        "COLOR_BOMB" ||
      b ===
        "COLOR_BOMB"
    ) {

      const other =
        a ===
          "COLOR_BOMB"
          ? b
          : a;


      if (
        isStriped(
          other,
        )
      ) {
        return "COLOR_BOMB_STRIPED";
      }


      if (
        other ===
        "WRAPPED"
      ) {
        return "COLOR_BOMB_WRAPPED";
      }


      return "COLOR_BOMB_NORMAL";
    }


    if (
      isStriped(
        a,
      ) &&
      isStriped(
        b,
      )
    ) {
      return "STRIPED_STRIPED";
    }


    if (
      (
        isStriped(
          a,
        ) &&
        b ===
          "WRAPPED"
      ) ||
      (
        isStriped(
          b,
        ) &&
        a ===
          "WRAPPED"
      )
    ) {
      return "STRIPED_WRAPPED";
    }


    if (
      a ===
        "WRAPPED" &&
      b ===
        "WRAPPED"
    ) {
      return "WRAPPED_WRAPPED";
    }


    return "NONE";
  };


/*
 * ============================================================
 * ADD TARGET CELLS
 * ============================================================
 */

const addRow =
  (
    board:
      CandyCascadeBoard,

    affected:
      Set<string>,

    row:
      number,
  ) => {

    if (
      row <
        0 ||
      row >=
        CANDY_CASCADE_ROWS
    ) {
      return;
    }


    for (
      let col =
        0;

      col <
      CANDY_CASCADE_COLUMNS;

      col +=
        1
    ) {

      if (
        board[
          row
        ]?.[
          col
        ]?.active
      ) {

        affected.add(
          `${row}:${col}`,
        );
      }
    }
  };


const addColumn =
  (
    board:
      CandyCascadeBoard,

    affected:
      Set<string>,

    col:
      number,
  ) => {

    if (
      col <
        0 ||
      col >=
        CANDY_CASCADE_COLUMNS
    ) {
      return;
    }


    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      if (
        board[
          row
        ]?.[
          col
        ]?.active
      ) {

        affected.add(
          `${row}:${col}`,
        );
      }
    }
  };


const addRadius =
  (
    board:
      CandyCascadeBoard,

    affected:
      Set<string>,

    center:
      CandyCascadePoint,

    radius:
      number,
  ) => {

    for (
      let row =
        center.row -
        radius;

      row <=
        center.row +
          radius;

      row +=
        1
    ) {

      for (
        let col =
          center.col -
          radius;

        col <=
          center.col +
            radius;

        col +=
          1
      ) {

        if (
          insideBoard(
            row,
            col,
          ) &&
          board[
            row
          ][
            col
          ].active
        ) {

          affected.add(
            `${row}:${col}`,
          );
        }
      }
    }
  };


/*
 * ============================================================
 * EXPAND SPECIAL EFFECTS
 * ============================================================
 */

const expandSpecialEffects =
  (
    board:
      CandyCascadeBoard,

    initialAffected:
      Set<string>,

    protectedKeys:
      Set<string> =
        new Set(),

    suppressedSpecialKeys:
      Set<string> =
        new Set(),
  ) => {

    const affected =
      new Set(
        initialAffected,
      );


    const queue:
      string[] =
      [];


    const queued =
      new Set<string>();


    const queueSpecial =
      (
        key:
          string,
      ) => {

        if (
          protectedKeys.has(
            key,
          ) ||
          suppressedSpecialKeys.has(
            key,
          ) ||
          queued.has(
            key,
          )
        ) {
          return;
        }


        const point =
          parsePointKey(
            key,
          );


        const special =
          board[
            point.row
          ]?.[
            point.col
          ]?.piece
            ?.special;


        if (
          !special ||
          special ===
            "NONE"
        ) {
          return;
        }


        queued.add(
          key,
        );


        queue.push(
          key,
        );
      };


    Array.from(
      affected,
    ).forEach(
      queueSpecial,
    );


    while (
      queue.length >
      0
    ) {

      const key =
        queue.shift();


      if (
        !key
      ) {
        break;
      }


      const point =
        parsePointKey(
          key,
        );


      const piece =
        board[
          point.row
        ]?.[
          point.col
        ]?.piece;


      if (
        !piece
      ) {
        continue;
      }


      const before =
        new Set(
          affected,
        );


      if (
        piece.special ===
        "STRIPED_ROW"
      ) {

        addRow(
          board,
          affected,
          point.row,
        );

      } else if (
        piece.special ===
        "STRIPED_COLUMN"
      ) {

        addColumn(
          board,
          affected,
          point.col,
        );

      } else if (
        piece.special ===
        "WRAPPED"
      ) {

        addRadius(
          board,
          affected,
          point,
          1,
        );

      } else if (
        piece.special ===
        "COLOR_BOMB"
      ) {

        for (
          let row =
            0;

          row <
          CANDY_CASCADE_ROWS;

          row +=
            1
        ) {

          for (
            let col =
              0;

            col <
            CANDY_CASCADE_COLUMNS;

            col +=
              1
          ) {

            const candidate =
              board[
                row
              ]?.[
                col
              ]?.piece;


            if (
              candidate &&
              candidate.color ===
                piece.color
            ) {

              affected.add(
                `${row}:${col}`,
              );
            }
          }
        }
      }


      Array.from(
        affected,
      ).forEach(
        candidateKey => {

          if (
            !before.has(
              candidateKey,
            )
          ) {

            queueSpecial(
              candidateKey,
            );
          }
        },
      );
    }


    protectedKeys.forEach(
      key =>
        affected.delete(
          key,
        ),
    );


    return affected;
  };


/*
 * ============================================================
 * APPLY PIECE / JELLY / BLOCKER REMOVAL
 * ============================================================
 */

const applyRemoval =
  (
    inputBoard:
      CandyCascadeBoard,

    affected:
      Set<string>,
  ): RemovalOutcome => {

    const board =
      cloneCandyCascadeBoard(
        inputBoard,
      );


    let removedPieces =
      0;


    let removedSpecialPieces =
      0;


    let destroyedJellyLayers =
      0;


    let destroyedBlockerLayers =
      0;


    const collectedColors:
      Partial<
        Record<
          CandyCascadeColor,
          number
        >
      > = {};


    const removedPiecePoints:
      CandyCascadePoint[] =
      [];


    /*
     * Remove pieces.
     */
    affected.forEach(
      key => {

        const point =
          parsePointKey(
            key,
          );


        const cell =
          board[
            point.row
          ]?.[
            point.col
          ];


        if (
          !cell ||
          !cell.active
        ) {
          return;
        }


        if (
          cell.piece
        ) {

          const piece =
            cell.piece;


          removedPieces +=
            1;


          if (
            piece.special !==
            "NONE"
          ) {
            removedSpecialPieces +=
              1;
          }


          collectedColors[
            piece.color
          ] =
            (
              collectedColors[
                piece.color
              ] ??
              0
            ) +
            1;


          /*
           * Jelly is damaged when the piece occupying that
           * jelly cell is removed.
           */
          if (
            cell.jellyLayers >
            0
          ) {

            cell.jellyLayers -=
              1;


            destroyedJellyLayers +=
              1;
          }


          cell.piece =
            null;


          removedPiecePoints.push(
            point,
          );
        }
      },
    );


    /*
     * Blocker damage happens at most once per cascade step.
     *
     * A blocker is hit if:
     *
     * - the special blast directly targets the blocker cell
     * - OR a matched/removed piece is adjacent to it
     */
    const blockerDamageKeys =
      new Set<string>();


    affected.forEach(
      key => {

        const point =
          parsePointKey(
            key,
          );


        const cell =
          board[
            point.row
          ]?.[
            point.col
          ];


        if (
          cell &&
          cell.blocker.layers >
            0
        ) {

          blockerDamageKeys.add(
            key,
          );
        }
      },
    );


    removedPiecePoints.forEach(
      point => {

        getOrthogonalNeighbors(
          point,
        ).forEach(
          neighbor => {

            const cell =
              board[
                neighbor.row
              ]?.[
                neighbor.col
              ];


            if (
              cell &&
              cell.blocker.layers >
                0
            ) {

              blockerDamageKeys.add(
                pointKey(
                  neighbor,
                ),
              );
            }
          },
        );
      },
    );


    blockerDamageKeys.forEach(
      key => {

        const point =
          parsePointKey(
            key,
          );


        const cell =
          board[
            point.row
          ]?.[
            point.col
          ];


        if (
          !cell ||
          cell.blocker.layers <=
            0
        ) {
          return;
        }


        cell.blocker.layers -=
          1;


        destroyedBlockerLayers +=
          1;


        if (
          cell.blocker.layers <=
          0
        ) {

          cell.blocker = {
            type:
              "NONE",

            layers:
              0,
          };
        }
      },
    );


    return {
      board,

      removedPieces,

      removedSpecialPieces,

      destroyedJellyLayers,

      destroyedBlockerLayers,

      collectedColors,
    };
  };


/*
 * ============================================================
 * GRAVITY
 * ============================================================
 */

type Occupant = {
  piece:
    CandyCascadeCell[
      "piece"
    ];

  dropItem:
    CandyCascadeCell[
      "dropItem"
    ];
};


const applyGravityPass =
  (
    inputBoard:
      CandyCascadeBoard,

    colors:
      CandyCascadeColor[],

    context:
      RandomContext,
  ): CandyCascadeBoard => {

    const board =
      cloneCandyCascadeBoard(
        inputBoard,
      );


    for (
      let col =
        0;

      col <
      CANDY_CASCADE_COLUMNS;

      col +=
        1
    ) {

      let segment:
        number[] =
        [];


      const flushSegment =
        () => {

          if (
            segment.length ===
            0
          ) {
            return;
          }


          const occupants:
            Occupant[] =
            [];


          segment.forEach(
            row => {

              const cell =
                board[
                  row
                ][
                  col
                ];


              if (
                cell.dropItem ||
                cell.piece
              ) {

                occupants.push({
                  piece:
                    cell.piece
                      ? {
                          ...cell.piece,
                        }
                      : null,

                  dropItem:
                    cell.dropItem
                      ? {
                          ...cell.dropItem,
                        }
                      : null,
                });
              }


              cell.piece =
                null;


              cell.dropItem =
                null;
            },
          );


          let occupantIndex =
            occupants.length -
            1;


          /*
           * Place existing occupants from bottom upward.
           */
          for (
            let index =
              segment.length -
              1;

            index >=
              0;

            index -=
              1
          ) {

            const row =
              segment[
                index
              ];


            const cell =
              board[
                row
              ][
                col
              ];


            if (
              occupantIndex >=
              0
            ) {

              const occupant =
                occupants[
                  occupantIndex
                ];


              cell.piece =
                occupant.piece;


              cell.dropItem =
                occupant.dropItem;


              occupantIndex -=
                1;

            } else {

              cell.piece =
                createNormalPiece(
                  colors,
                  context,
                );


              cell.dropItem =
                null;
            }
          }


          segment =
            [];
        };


      for (
        let row =
          0;

        row <
        CANDY_CASCADE_ROWS;

        row +=
          1
      ) {

        const cell =
          board[
            row
          ][
            col
          ];


        /*
         * Inactive coordinates and hard blockers split
         * gravity into separate vertical segments.
         */
        if (
          !cell.active ||
          isHardBlocked(
            cell,
          )
        ) {

          flushSegment();

          continue;
        }


        segment.push(
          row,
        );
      }


      flushSegment();
    }


    return board;
  };


const collectDropItems =
  (
    inputBoard:
      CandyCascadeBoard,
  ) => {

    const board =
      cloneCandyCascadeBoard(
        inputBoard,
      );


    let droppedItems =
      0;


    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        CANDY_CASCADE_COLUMNS;

        col +=
          1
      ) {

        const cell =
          board[
            row
          ][
            col
          ];


        if (
          cell.active &&
          cell.isDropExit &&
          cell.dropItem
        ) {

          cell.dropItem =
            null;


          droppedItems +=
            1;
        }
      }
    }


    return {
      board,

      droppedItems,
    };
  };


const applyGravityAndRefill =
  (
    inputBoard:
      CandyCascadeBoard,

    colors:
      CandyCascadeColor[],

    context:
      RandomContext,
  ): GravityOutcome => {

    const firstPass =
      applyGravityPass(
        inputBoard,
        colors,
        context,
      );


    const collected =
      collectDropItems(
        firstPass,
      );


    /*
     * If a drop item exited, close the newly empty cell.
     */
    const finalBoard =
      collected.droppedItems >
        0
        ? applyGravityPass(
            collected.board,
            colors,
            context,
          )
        : collected.board;


    return {
      board:
        finalBoard,

      droppedItems:
        collected.droppedItems,
    };
  };


/*
 * ============================================================
 * OBJECTIVE UPDATES
 * ============================================================
 */

const updateObjectiveProgress =
  (
    previous:
      CandyCascadeObjectiveProgress[],

    score:
      number,

    collectedColors:
      Partial<
        Record<
          CandyCascadeColor,
          number
        >
      >,

    destroyedJellyLayers:
      number,

    destroyedBlockerLayers:
      number,

    droppedItems:
      number,
  ): CandyCascadeObjectiveProgress[] =>
    previous.map(
      objective => {

        let current =
          objective.current;


        if (
          objective.type ===
          "SCORE"
        ) {

          current =
            score;

        } else if (
          objective.type ===
            "COLLECT_COLOR" &&
          objective.color
        ) {

          current +=
            collectedColors[
              objective.color
            ] ??
            0;

        } else if (
          objective.type ===
          "CLEAR_JELLY"
        ) {

          current +=
            destroyedJellyLayers;

        } else if (
          objective.type ===
          "BREAK_BLOCKERS"
        ) {

          current +=
            destroyedBlockerLayers;

        } else if (
          objective.type ===
          "DROP_ITEMS"
        ) {

          current +=
            droppedItems;
        }


        current =
          Math.min(
            objective.target,
            current,
          );


        return {
          ...objective,

          current,

          completed:
            current >=
            objective.target,
        };
      },
    );


export const areCandyCascadeObjectivesComplete =
  (
    progress:
      CandyCascadeObjectiveProgress[],
  ) =>
    progress.length >
      0 &&
    progress.every(
      objective =>
        objective.completed,
    );


export const getCandyCascadeProgressPercent =
  (
    state:
      CandyCascadeGameState,
  ) => {

    if (
      state.isLevelCleared
    ) {
      return 100;
    }


    if (
      state.objectiveProgress.length ===
      0
    ) {
      return 0;
    }


    const total =
      state.objectiveProgress.reduce(
        (
          sum,
          objective,
        ) => {

          if (
            objective.target <=
            0
          ) {
            return sum +
              1;
          }


          return sum +
            clamp(
              objective.current /
                objective.target,
              0,
              1,
            );
        },
        0,
      );


    return Math.floor(
      (
        total /
        state.objectiveProgress.length
      ) *
        100,
    );
  };


/*
 * ============================================================
 * STABLE INITIAL BOARD
 * ============================================================
 */

const wouldCreateInitialMatch =
  (
    board:
      CandyCascadeBoard,

    row:
      number,

    col:
      number,

    color:
      CandyCascadeColor,
  ) => {

    const left1 =
      col >=
        1
        ? getMatchPiece(
            board,
            row,
            col -
              1,
          )
        : null;


    const left2 =
      col >=
        2
        ? getMatchPiece(
            board,
            row,
            col -
              2,
          )
        : null;


    if (
      left1?.color ===
        color &&
      left2?.color ===
        color
    ) {
      return true;
    }


    const up1 =
      row >=
        1
        ? getMatchPiece(
            board,
            row -
              1,
            col,
          )
        : null;


    const up2 =
      row >=
        2
        ? getMatchPiece(
            board,
            row -
              2,
            col,
          )
        : null;


    return (
      up1?.color ===
        color &&
      up2?.color ===
        color
    );
  };


const fillStableInitialPieces =
  (
    template:
      CandyCascadeBoard,

    colors:
      CandyCascadeColor[],

    context:
      RandomContext,
  ) => {

    const board =
      cloneCandyCascadeBoard(
        template,
      );


    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        CANDY_CASCADE_COLUMNS;

        col +=
          1
      ) {

        const cell =
          board[
            row
          ][
            col
          ];


        if (
          !canHoldOccupant(
            cell,
          ) ||
          cell.dropItem
        ) {
          continue;
        }


        const allowed =
          colors.filter(
            color =>
              !wouldCreateInitialMatch(
                board,
                row,
                col,
                color,
              ),
          );


        const choices =
          allowed.length >
            0
            ? allowed
            : colors;


        cell.piece =
          createPiece(
            chooseRandom(
              choices,
              context,
            ),
            "NONE",
            context,
          );
      }
    }


    return board;
  };


/*
 * ============================================================
 * OCCUPANT SWAP
 * ============================================================
 */

const swapBoardOccupants =
  (
    input:
      CandyCascadeBoard,

    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,
  ) => {

    const board =
      cloneCandyCascadeBoard(
        input,
      );


    const firstCell =
      board[
        first.row
      ][
        first.col
      ];


    const secondCell =
      board[
        second.row
      ][
        second.col
      ];


    const firstPiece =
      firstCell.piece;


    const firstDrop =
      firstCell.dropItem;


    firstCell.piece =
      secondCell.piece;


    firstCell.dropItem =
      secondCell.dropItem;


    secondCell.piece =
      firstPiece;


    secondCell.dropItem =
      firstDrop;


    return board;
  };


/*
 * ============================================================
 * POSSIBLE MOVE CHECK
 * ============================================================
 */

const swapWouldBeValid =
  (
    board:
      CandyCascadeBoard,

    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,
  ) => {

    const firstCell =
      board[
        first.row
      ]?.[
        first.col
      ];


    const secondCell =
      board[
        second.row
      ]?.[
        second.col
      ];


    if (
      !firstCell ||
      !secondCell ||
      !canPlayerSwapCell(
        firstCell,
      ) ||
      !canPlayerSwapCell(
        secondCell,
      )
    ) {
      return false;
    }


    const combination =
      getSpecialCombination(
        firstCell.piece,
        secondCell.piece,
      );


    if (
      combination !==
      "NONE"
    ) {
      return true;
    }


    const swapped =
      swapBoardOccupants(
        board,
        first,
        second,
      );


    return findCandyCascadeMatchGroups(
      swapped,
    ).length >
      0;
  };


export const getCandyCascadeHint =
  (
    board:
      CandyCascadeBoard,
  ): {
    from:
      CandyCascadePoint;

    to:
      CandyCascadePoint;
  } |
    null => {

    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        CANDY_CASCADE_COLUMNS;

        col +=
          1
      ) {

        const from = {
          row,
          col,
        };


        const right = {
          row,
          col:
            col +
            1,
        };


        if (
          insideBoard(
            right.row,
            right.col,
          ) &&
          swapWouldBeValid(
            board,
            from,
            right,
          )
        ) {

          return {
            from,

            to:
              right,
          };
        }


        const down = {
          row:
            row +
            1,

          col,
        };


        if (
          insideBoard(
            down.row,
            down.col,
          ) &&
          swapWouldBeValid(
            board,
            from,
            down,
          )
        ) {

          return {
            from,

            to:
              down,
          };
        }
      }
    }


    return null;
  };


export const boardHasCandyCascadePossibleMove =
  (
    board:
      CandyCascadeBoard,
  ) =>
    getCandyCascadeHint(
      board,
    ) !==
    null;


/*
 * ============================================================
 * FALLBACK FORCE-PLAYABLE PATTERN
 * ============================================================
 *
 * Normally the deterministic random board succeeds quickly.
 *
 * This guarantees that an extreme seed cannot create a
 * permanently dead initial board.
 */

const forcePlayableBoard =
  (
    inputBoard:
      CandyCascadeBoard,

    colors:
      CandyCascadeColor[],
  ) => {

    const original =
      cloneCandyCascadeBoard(
        inputBoard,
      );


    for (
      let row =
        0;

      row <
        CANDY_CASCADE_ROWS -
          1;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
          CANDY_CASCADE_COLUMNS -
            2;

        col +=
          1
      ) {

        const points = [
          {
            row,

            col,
          },

          {
            row,

            col:
              col +
              1,
          },

          {
            row,

            col:
              col +
              2,
          },

          {
            row:
              row +
              1,

            col:
              col +
              2,
          },
        ];


        if (
          points.some(
            point => {

              const cell =
                original[
                  point.row
                ]?.[
                  point.col
                ];


              return (
                !cell ||
                !canHoldOccupant(
                  cell,
                ) ||
                cell.dropItem ||
                !cell.piece
              );
            },
          )
        ) {
          continue;
        }


        for (
          const targetColor of
          colors
        ) {

          for (
            const otherColor of
            colors
        ) {

          if (
            targetColor ===
            otherColor
          ) {
            continue;
          }


          const board =
            cloneCandyCascadeBoard(
              original,
            );


          board[
            row
          ][
            col
          ].piece!.color =
            targetColor;


          board[
            row
          ][
            col +
              1
          ].piece!.color =
            targetColor;


          board[
            row
          ][
            col +
              2
          ].piece!.color =
            otherColor;


          board[
            row +
              1
          ][
            col +
              2
          ].piece!.color =
            targetColor;


          if (
            findCandyCascadeMatchGroups(
              board,
            ).length ===
              0 &&
            boardHasCandyCascadePossibleMove(
              board,
            )
          ) {

            return board;
          }
        }
      }
    }
  }


    return original;
  };


/*
 * ============================================================
 * INITIAL GAME STATE
 * ============================================================
 */

export const createInitialCandyCascadeState =
  (
    level:
      number,

    seed:
      number,
  ): CandyCascadeGameState => {

    const config =
      generateCandyCascadeLevel(
        level,
      );


    const context:
      RandomContext = {
      seed:
        seed >>>
        0,

      randomStep:
        0,

      nextPieceId:
        1,

      nextDropItemId:
        1,
    };


    /*
     * Drop IDs are generated once.
     */
    const template =
      createBoardTemplate(
        config,
        context,
      );


    let board =
      cloneCandyCascadeBoard(
        template,
      );


    let playable =
      false;


    for (
      let attempt =
        0;

      attempt <
      CANDY_CASCADE_MAX_BOARD_BUILD_ATTEMPTS;

      attempt +=
        1
    ) {

      const candidate =
        fillStableInitialPieces(
          template,
          config.colors,
          context,
        );


      if (
        findCandyCascadeMatchGroups(
          candidate,
        ).length ===
          0 &&
        boardHasCandyCascadePossibleMove(
          candidate,
        )
      ) {

        board =
          candidate;


        playable =
          true;


        break;
      }


      board =
        candidate;
    }


    if (
      !playable
    ) {

      board =
        forcePlayableBoard(
          board,
          config.colors,
        );
    }


    return {
      levelId:
        config.id,

      seed:
        context.seed,

      randomStep:
        context.randomStep,

      nextPieceId:
        context.nextPieceId,

      nextDropItemId:
        context.nextDropItemId,

      board,

      movesRemaining:
        config.moves,

      movesUsed:
        0,

      score:
        0,

      combo:
        0,

      bestCascade:
        0,

      objectiveProgress:
        createObjectiveProgress(
          config,
        ),

      shuffleCount:
        0,

      extraMovesUsed:
        false,

      extraMovesGranted:
        0,

      isGameOver:
        false,

      isLevelCleared:
        false,
    };
  };


/*
 * ============================================================
 * SPECIAL CREATION PLACEMENT
 * ============================================================
 */

const placeCreatedSpecials =
  (
    board:
      CandyCascadeBoard,

    creations:
      CandyCascadeSpecialCreation[],
  ) => {

    const next =
      cloneCandyCascadeBoard(
        board,
      );


    creations.forEach(
      creation => {

        const cell =
          next[
            creation
              .position
              .row
          ]?.[
            creation
              .position
              .col
          ];


        if (
          !cell ||
          !cell.piece
        ) {
          return;
        }


        cell.piece = {
          ...cell.piece,

          color:
            creation.color,

          special:
            creation.special,
        };
      },
    );


    return next;
  };


/*
 * ============================================================
 * SCORE A REMOVAL STEP
 * ============================================================
 */

const calculateRemovalScore =
  (
    outcome:
      RemovalOutcome,

    droppedItems:
      number,

    cascadeIndex:
      number,
  ) => {

    const normalPieces =
      Math.max(
        0,

        outcome.removedPieces -
          outcome.removedSpecialPieces,
      );


    const raw =
      normalPieces *
        CANDY_CASCADE_SCORE_PER_NORMAL_PIECE +
      outcome.removedSpecialPieces *
        CANDY_CASCADE_SCORE_PER_SPECIAL_PIECE +
      outcome.destroyedJellyLayers *
        CANDY_CASCADE_SCORE_PER_JELLY_LAYER +
      outcome.destroyedBlockerLayers *
        CANDY_CASCADE_SCORE_PER_BLOCKER_LAYER +
      droppedItems *
        CANDY_CASCADE_SCORE_PER_DROP_ITEM;


    return raw *
      Math.min(
        CANDY_CASCADE_MAX_COMBO_MULTIPLIER,

        Math.max(
          1,
          cascadeIndex,
        ),
      );
  };


/*
 * ============================================================
 * RESOLVE NORMAL CASCADES
 * ============================================================
 */

const resolveCascades =
  (
    inputState:
      CandyCascadeGameState,

    context:
      RandomContext,

    preferredPoints:
      CandyCascadePoint[],

    startingCascadeIndex =
      1,
  ): CascadeResolution => {

    const config =
      generateCandyCascadeLevel(
        inputState.levelId,
      );


    let state = {
      ...inputState,

      board:
        cloneCandyCascadeBoard(
          inputState.board,
        ),

      objectiveProgress:
        inputState.objectiveProgress.map(
          objective => ({
            ...objective,
          }),
        ),
    };


    const totals:
      ResolutionTotals = {
      removedPieces:
        0,

      destroyedJellyLayers:
        0,

      destroyedBlockerLayers:
        0,

      droppedItems:
        0,

      gainedScore:
        0,

      cascadeCount:
        0,

      createdSpecials:
        [],
    };


    const steps:
      CandyCascadeCascadeStep[] =
      [];


    let cascadeIndex =
      startingCascadeIndex;


    let firstCycle =
      true;


    for (
      let guard =
        0;

      guard <
      CANDY_CASCADE_MAX_CASCADE_STEPS_PER_MOVE;

      guard +=
        1
    ) {

      const groups =
        findCandyCascadeMatchGroups(
          state.board,
        );


      if (
        groups.length ===
        0
      ) {
        break;
      }


      const creations =
        createSpecialsForGroups(
          state.board,
          groups,
          firstCycle
            ? preferredPoints
            : [],
        );


      const protectedKeys =
        new Set(
          creations.map(
            creation =>
              pointKey(
                creation.position,
              ),
          ),
        );


      const baseAffected =
        new Set<string>();


      groups.forEach(
        group => {

          group.cells.forEach(
            point => {

              const key =
                pointKey(
                  point,
                );


              if (
                !protectedKeys.has(
                  key,
                )
              ) {

                baseAffected.add(
                  key,
                );
              }
            },
          );
        },
      );


      const affected =
        expandSpecialEffects(
          state.board,
          baseAffected,
          protectedKeys,
        );


      const removed =
        applyRemoval(
          state.board,
          affected,
        );


      const withSpecials =
        placeCreatedSpecials(
          removed.board,
          creations,
        );


      const boardAfterRemoval =
        cloneCandyCascadeBoard(
          withSpecials,
        );


      const gravity =
        applyGravityAndRefill(
          withSpecials,
          config.colors,
          context,
        );


      const stepScore =
        calculateRemovalScore(
          removed,
          gravity.droppedItems,
          cascadeIndex,
        );


      const nextScore =
        state.score +
        stepScore;


      const nextObjectives =
        updateObjectiveProgress(
          state.objectiveProgress,
          nextScore,
          removed.collectedColors,
          removed.destroyedJellyLayers,
          removed.destroyedBlockerLayers,
          gravity.droppedItems,
        );


      state = {
        ...state,

        board:
          gravity.board,

        score:
          nextScore,

        combo:
          cascadeIndex,

        bestCascade:
          Math.max(
            state.bestCascade,
            cascadeIndex,
          ),

        objectiveProgress:
          nextObjectives,

        randomStep:
          context.randomStep,

        nextPieceId:
          context.nextPieceId,

        nextDropItemId:
          context.nextDropItemId,
      };


      totals.removedPieces +=
        removed.removedPieces;


      totals.destroyedJellyLayers +=
        removed.destroyedJellyLayers;


      totals.destroyedBlockerLayers +=
        removed.destroyedBlockerLayers;


      totals.droppedItems +=
        gravity.droppedItems;


      totals.gainedScore +=
        stepScore;


      totals.cascadeCount +=
        1;


      totals.createdSpecials.push(
        ...creations,
      );


      steps.push({
        cascadeIndex,

        matchedCells:
          groups.flatMap(
            group =>
              group.cells,
          ),

        blastCells:
          Array.from(
            affected,
          ).map(
            parsePointKey,
          ),

        createdSpecials:
          creations,

        removedPieces:
          removed.removedPieces,

        gainedScore:
          stepScore,

        boardAfterRemoval,

        boardAfterGravity:
          cloneCandyCascadeBoard(
            gravity.board,
          ),
      });


      cascadeIndex +=
        1;


      firstCycle =
        false;
    }


    return {
      state,

      context,

      totals,

      steps,
    };
  };


/*
 * ============================================================
 * SPECIAL COMBINATION EFFECT
 * ============================================================
 */

const resolveSpecialCombination =
  (
    inputState:
      CandyCascadeGameState,

    context:
      RandomContext,

    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,

    combination:
      CandyCascadeSpecialCombination,
  ): CascadeResolution => {

    const config =
      generateCandyCascadeLevel(
        inputState.levelId,
      );


    let board =
      cloneCandyCascadeBoard(
        inputState.board,
      );


    const firstPiece =
      board[
        first.row
      ][
        first.col
      ].piece;


    const secondPiece =
      board[
        second.row
      ][
        second.col
      ].piece;


    const affected =
      new Set<string>();


    const suppressed =
      new Set<string>();


    const firstKey =
      pointKey(
        first,
      );


    const secondKey =
      pointKey(
        second,
      );


    /*
     * COLOR BOMB + COLOR BOMB
     */
    if (
      combination ===
      "COLOR_BOMB_COLOR_BOMB"
    ) {

      suppressed.add(
        firstKey,
      );


      suppressed.add(
        secondKey,
      );


      for (
        let row =
          0;

        row <
        CANDY_CASCADE_ROWS;

        row +=
          1
      ) {

        for (
          let col =
            0;

          col <
          CANDY_CASCADE_COLUMNS;

          col +=
            1
        ) {

          if (
            board[
              row
            ][
              col
            ].active
          ) {

            affected.add(
              `${row}:${col}`,
            );
          }
        }
      }

    } else if (
      combination ===
      "COLOR_BOMB_NORMAL" ||
      combination ===
      "COLOR_BOMB_STRIPED" ||
      combination ===
      "COLOR_BOMB_WRAPPED"
    ) {

      const bombIsFirst =
        firstPiece
          ?.special ===
        "COLOR_BOMB";


      const bombPoint =
        bombIsFirst
          ? first
          : second;


      const otherPoint =
        bombIsFirst
          ? second
          : first;


      const otherPiece =
        board[
          otherPoint.row
        ][
          otherPoint.col
        ].piece;


      suppressed.add(
        pointKey(
          bombPoint,
        ),
      );


      affected.add(
        pointKey(
          bombPoint,
        ),
      );


      const targetColor =
        otherPiece?.color;


      if (
        targetColor
      ) {

        let conversionIndex =
          0;


        for (
          let row =
            0;

          row <
          CANDY_CASCADE_ROWS;

          row +=
            1
        ) {

          for (
            let col =
              0;

            col <
            CANDY_CASCADE_COLUMNS;

            col +=
              1
          ) {

            const cell =
              board[
                row
              ][
                col
              ];


            if (
              !cell.piece ||
              cell.piece.color !==
                targetColor
            ) {
              continue;
            }


            if (
              combination ===
              "COLOR_BOMB_STRIPED"
            ) {

              cell.piece = {
                ...cell.piece,

                special:
                  conversionIndex %
                      2 ===
                    0
                    ? "STRIPED_ROW"
                    : "STRIPED_COLUMN",
              };


              conversionIndex +=
                1;

            } else if (
              combination ===
              "COLOR_BOMB_WRAPPED"
            ) {

              cell.piece = {
                ...cell.piece,

                special:
                  "WRAPPED",
              };
            }


            affected.add(
              `${row}:${col}`,
            );
          }
        }
      }

    } else if (
      combination ===
      "STRIPED_STRIPED"
    ) {

      suppressed.add(
        firstKey,
      );


      suppressed.add(
        secondKey,
      );


      affected.add(
        firstKey,
      );


      affected.add(
        secondKey,
      );


      addRow(
        board,
        affected,
        second.row,
      );


      addColumn(
        board,
        affected,
        second.col,
      );

    } else if (
      combination ===
      "STRIPED_WRAPPED"
    ) {

      suppressed.add(
        firstKey,
      );


      suppressed.add(
        secondKey,
      );


      affected.add(
        firstKey,
      );


      affected.add(
        secondKey,
      );


      for (
        let offset =
          -1;

        offset <=
          1;

        offset +=
          1
      ) {

        addRow(
          board,
          affected,
          second.row +
            offset,
        );


        addColumn(
          board,
          affected,
          second.col +
            offset,
        );
      }

    } else if (
      combination ===
      "WRAPPED_WRAPPED"
    ) {

      suppressed.add(
        firstKey,
      );


      suppressed.add(
        secondKey,
      );


      addRadius(
        board,
        affected,
        second,
        2,
      );


      affected.add(
        firstKey,
      );


      affected.add(
        secondKey,
      );
    }


    const expanded =
      expandSpecialEffects(
        board,
        affected,
        new Set(),
        suppressed,
      );


    const removed =
      applyRemoval(
        board,
        expanded,
      );


    const boardAfterRemoval =
      cloneCandyCascadeBoard(
        removed.board,
      );


    const gravity =
      applyGravityAndRefill(
        removed.board,
        config.colors,
        context,
      );


    const stepScore =
      calculateRemovalScore(
        removed,
        gravity.droppedItems,
        1,
      );


    const nextScore =
      inputState.score +
      stepScore;


    const nextObjectives =
      updateObjectiveProgress(
        inputState.objectiveProgress,
        nextScore,
        removed.collectedColors,
        removed.destroyedJellyLayers,
        removed.destroyedBlockerLayers,
        gravity.droppedItems,
      );


    const afterCombo:
      CandyCascadeGameState = {
      ...inputState,

      board:
        gravity.board,

      score:
        nextScore,

      combo:
        1,

      bestCascade:
        Math.max(
          inputState.bestCascade,
          1,
        ),

      objectiveProgress:
        nextObjectives,

      randomStep:
        context.randomStep,

      nextPieceId:
        context.nextPieceId,

      nextDropItemId:
        context.nextDropItemId,
    };


    const cascade =
      resolveCascades(
        afterCombo,
        context,
        [],
        2,
      );


    return {
      state:
        cascade.state,

      context:
        cascade.context,

      totals: {
        removedPieces:
          removed.removedPieces +
          cascade.totals.removedPieces,

        destroyedJellyLayers:
          removed.destroyedJellyLayers +
          cascade.totals.destroyedJellyLayers,

        destroyedBlockerLayers:
          removed.destroyedBlockerLayers +
          cascade.totals.destroyedBlockerLayers,

        droppedItems:
          gravity.droppedItems +
          cascade.totals.droppedItems,

        gainedScore:
          stepScore +
          cascade.totals.gainedScore,

        cascadeCount:
          1 +
          cascade.totals.cascadeCount,

        createdSpecials:
          cascade.totals.createdSpecials,
      },

      steps: [
        {
          cascadeIndex:
            1,

          matchedCells:
            [
              first,
              second,
            ],

          blastCells:
            Array.from(
              expanded,
            ).map(
              parsePointKey,
            ),

          createdSpecials:
            [],

          removedPieces:
            removed.removedPieces,

          gainedScore:
            stepScore,

          boardAfterRemoval,

          boardAfterGravity:
            cloneCandyCascadeBoard(
              gravity.board,
            ),
        },

        ...cascade.steps,
      ],
    };
  };


/*
 * ============================================================
 * SHUFFLE
 * ============================================================
 */

const shuffleBoard =
  (
    inputBoard:
      CandyCascadeBoard,

    config:
      CandyCascadeLevelConfig,

    context:
      RandomContext,
  ) => {

    const base =
      cloneCandyCascadeBoard(
        inputBoard,
      );


    const positions:
      CandyCascadePoint[] =
      [];


    const pieces:
      NonNullable<
        CandyCascadeCell[
          "piece"
        ]
      >[] =
      [];


    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        CANDY_CASCADE_COLUMNS;

        col +=
          1
      ) {

        const cell =
          base[
            row
          ][
            col
          ];


        if (
          canHoldOccupant(
            cell,
          ) &&
          !cell.dropItem &&
          cell.piece
        ) {

          positions.push({
            row,
            col,
          });


          pieces.push({
            ...cell.piece,
          });
        }
      }
    }


    let last =
      base;


    for (
      let attempt =
        0;

      attempt <
      CANDY_CASCADE_MAX_SHUFFLES;

      attempt +=
        1
    ) {

      const shuffled =
        pieces.map(
          piece => ({
            ...piece,
          }),
        );


      for (
        let index =
          shuffled.length -
          1;

        index >
          0;

        index -=
          1
      ) {

        const target =
          Math.floor(
            nextRandom(
              context,
            ) *
              (
                index +
                1
              ),
          );


        const temporary =
          shuffled[
            index
          ];


        shuffled[
          index
        ] =
          shuffled[
            target
          ];


        shuffled[
          target
        ] =
          temporary;
      }


      const candidate =
        cloneCandyCascadeBoard(
          base,
        );


      positions.forEach(
        (
          position,
          index,
        ) => {

          candidate[
            position.row
          ][
            position.col
          ].piece =
            shuffled[
              index
            ];
        },
      );


      last =
        candidate;


      if (
        findCandyCascadeMatchGroups(
          candidate,
        ).length ===
          0 &&
        boardHasCandyCascadePossibleMove(
          candidate,
        )
      ) {

        return candidate;
      }
    }


    /*
     * Extremely rare fallback:
     *
     * rebuild the normal piece layer deterministically.
     */
    let rebuilt =
      cloneCandyCascadeBoard(
        base,
      );


    positions.forEach(
      position => {

        rebuilt[
          position.row
        ][
          position.col
        ].piece =
          null;
      },
    );


    rebuilt =
      fillStableInitialPieces(
        rebuilt,
        config.colors,
        context,
      );


    if (
      boardHasCandyCascadePossibleMove(
        rebuilt,
      )
    ) {
      return rebuilt;
    }


    return forcePlayableBoard(
      last,
      config.colors,
    );
  };


/*
 * ============================================================
 * PLAYER SWAP
 * ============================================================
 */

export const applyCandyCascadeSwap =
  (
    inputState:
      CandyCascadeGameState,

    from:
      CandyCascadePoint,

    to:
      CandyCascadePoint,
  ): CandyCascadeMoveResolution => {

    const emptyResult =
      (
        state:
          CandyCascadeGameState,
      ): CandyCascadeMoveResolution => ({
        result: {
          accepted:
            false,

          state,

          moveConsumed:
            false,

          swapped:
            false,

          specialCombination:
            "NONE",

          removedPieces:
            0,

          destroyedJellyLayers:
            0,

          destroyedBlockerLayers:
            0,

          droppedItems:
            0,

          gainedScore:
            0,

          cascadeCount:
            0,

          createdSpecials:
            [],

          shuffled:
            false,

          levelCleared:
            state.isLevelCleared,

          gameOver:
            state.isGameOver,
        },

        cascadeSteps:
          [],
      });


    if (
      inputState.isGameOver ||
      inputState.isLevelCleared ||
      inputState.movesRemaining <=
        0 ||
      !insideBoard(
        from.row,
        from.col,
      ) ||
      !insideBoard(
        to.row,
        to.col,
      ) ||
      !areAdjacent(
        from,
        to,
      )
    ) {

      return emptyResult(
        inputState,
      );
    }


    const firstCell =
      inputState.board[
        from.row
      ]?.[
        from.col
      ];


    const secondCell =
      inputState.board[
        to.row
      ]?.[
        to.col
      ];


    if (
      !firstCell ||
      !secondCell ||
      !canPlayerSwapCell(
        firstCell,
      ) ||
      !canPlayerSwapCell(
        secondCell,
      )
    ) {

      return emptyResult(
        inputState,
      );
    }


    /*
     * Combination is determined BEFORE the pieces move.
     */
    const combination =
      getSpecialCombination(
        firstCell.piece,
        secondCell.piece,
      );


    const swapped =
      swapBoardOccupants(
        inputState.board,
        from,
        to,
      );


    const immediateMatches =
      findCandyCascadeMatchGroups(
        swapped,
      );


    /*
     * Invalid swap.
     *
     * It consumes no move.
     */
    if (
      combination ===
        "NONE" &&
      immediateMatches.length ===
        0
    ) {

      return emptyResult(
        inputState,
      );
    }


    const context:
      RandomContext = {
      seed:
        inputState.seed,

      randomStep:
        inputState.randomStep,

      nextPieceId:
        inputState.nextPieceId,

      nextDropItemId:
        inputState.nextDropItemId,
    };


    const movedState:
      CandyCascadeGameState = {
      ...inputState,

      board:
        swapped,

      movesRemaining:
        Math.max(
          0,
          inputState.movesRemaining -
            1,
        ),

      movesUsed:
        inputState.movesUsed +
        1,

      combo:
        0,

      isGameOver:
        false,

      isLevelCleared:
        false,
    };


    const resolved =
      combination !==
        "NONE"
        ? resolveSpecialCombination(
            movedState,
            context,
            from,
            to,
            combination,
          )
        : resolveCascades(
            movedState,
            context,
            [
              to,
              from,
            ],
          );


    let state =
      resolved.state;


    let shuffled =
      false;


    const completed =
      areCandyCascadeObjectivesComplete(
        state.objectiveProgress,
      );


    if (
      completed
    ) {

      state = {
        ...state,

        isLevelCleared:
          true,

        isGameOver:
          false,
      };

    } else if (
      state.movesRemaining <=
      0
    ) {

      state = {
        ...state,

        isGameOver:
          true,

        isLevelCleared:
          false,
      };

    } else if (
      !boardHasCandyCascadePossibleMove(
        state.board,
      )
    ) {

      const config =
        generateCandyCascadeLevel(
          state.levelId,
        );


      const shuffledBoard =
        shuffleBoard(
          state.board,
          config,
          context,
        );


      state = {
        ...state,

        board:
          shuffledBoard,

        randomStep:
          context.randomStep,

        nextPieceId:
          context.nextPieceId,

        nextDropItemId:
          context.nextDropItemId,

        shuffleCount:
          state.shuffleCount +
          1,
      };


      shuffled =
        true;
    }


    return {
      result: {
        accepted:
          true,

        state,

        moveConsumed:
          true,

        swapped:
          true,

        specialCombination:
          combination,

        removedPieces:
          resolved
            .totals
            .removedPieces,

        destroyedJellyLayers:
          resolved
            .totals
            .destroyedJellyLayers,

        destroyedBlockerLayers:
          resolved
            .totals
            .destroyedBlockerLayers,

        droppedItems:
          resolved
            .totals
            .droppedItems,

        gainedScore:
          resolved
            .totals
            .gainedScore,

        cascadeCount:
          resolved
            .totals
            .cascadeCount,

        createdSpecials:
          resolved
            .totals
            .createdSpecials,

        shuffled,

        levelCleared:
          state.isLevelCleared,

        gameOver:
          state.isGameOver,
      },

      cascadeSteps:
        resolved.steps,
    };
  };


/*
 * ============================================================
 * +5 MOVE CONTINUE
 * ============================================================
 */

export const applyCandyCascadeContinue =
  (
    inputState:
      CandyCascadeGameState,

    movesGranted =
      CANDY_CASCADE_EXTRA_MOVES,
  ): CandyCascadeContinueResult => {

    if (
      !inputState.isGameOver ||
      inputState.isLevelCleared ||
      inputState.extraMovesUsed ||
      movesGranted !==
        CANDY_CASCADE_EXTRA_MOVES ||
      CANDY_CASCADE_MAX_CONTINUES <=
        0
    ) {

      return {
        state:
          inputState,

        accepted:
          false,
      };
    }


    return {
      accepted:
        true,

      state: {
        ...inputState,

        movesRemaining:
          inputState.movesRemaining +
          CANDY_CASCADE_EXTRA_MOVES,

        extraMovesUsed:
          true,

        extraMovesGranted:
          inputState.extraMovesGranted +
          CANDY_CASCADE_EXTRA_MOVES,

        isGameOver:
          false,
      },
    };
  };


/*
 * ============================================================
 * EVENT VALIDATION
 * ============================================================
 */

const isPoint =
  (
    value:
      unknown,
  ): value is CandyCascadePoint => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const point =
      value as
        CandyCascadePoint;


    return (
      Number.isInteger(
        point.row,
      ) &&
      Number.isInteger(
        point.col,
      ) &&
      insideBoard(
        point.row,
        point.col,
      )
    );
  };


export const isCandyCascadeSwapEvent =
  (
    value:
      unknown,
  ): value is CandyCascadeSwapEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as
        CandyCascadeSwapEvent;


    return (
      event.type ===
        "SWAP" &&
      Number.isInteger(
        event.moveIndex,
      ) &&
      event.moveIndex >=
        0 &&
      isPoint(
        event.from,
      ) &&
      isPoint(
        event.to,
      ) &&
      areAdjacent(
        event.from,
        event.to,
      )
    );
  };


export const isCandyCascadeContinueEvent =
  (
    value:
      unknown,
  ): value is CandyCascadeContinueEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as
        CandyCascadeContinueEvent;


    return (
      event.type ===
        "CONTINUE" &&
      Number.isInteger(
        event.afterMoveIndex,
      ) &&
      event.afterMoveIndex >=
        0 &&
      event.movesGranted ===
        CANDY_CASCADE_EXTRA_MOVES
    );
  };


export const isCandyCascadeRunEvent =
  (
    value:
      unknown,
  ): value is CandyCascadeRunEvent =>
    isCandyCascadeSwapEvent(
      value,
    ) ||
    isCandyCascadeContinueEvent(
      value,
    );


/*
 * ============================================================
 * DETERMINISTIC RUN REPLAY
 * ============================================================
 */

export const replayCandyCascadeRun =
  (
    level:
      number,

    seed:
      number,

    events:
      CandyCascadeRunEvent[],
  ): CandyCascadeReplayResult => {

    let state =
      createInitialCandyCascadeState(
        level,
        seed,
      );


    if (
      events.length >
      CANDY_CASCADE_MAX_RUN_EVENTS
    ) {

      return {
        valid:
          false,

        state,

        invalidEventIndex:
          null,

        reason:
          "Too many run events.",
      };
    }


    for (
      let index =
        0;

      index <
      events.length;

      index +=
        1
    ) {

      const event =
        events[
          index
        ];


      if (
        event.type ===
        "SWAP"
      ) {

        if (
          event.moveIndex !==
          state.movesUsed
        ) {

          return {
            valid:
              false,

            state,

            invalidEventIndex:
              index,

            reason:
              "Swap move index mismatch.",
          };
        }


        const resolution =
          applyCandyCascadeSwap(
            state,
            event.from,
            event.to,
          );


        if (
          !resolution
            .result
            .accepted
        ) {

          return {
            valid:
              false,

            state,

            invalidEventIndex:
              index,

            reason:
              "Invalid Candy Cascade swap.",
          };
        }


        state =
          resolution
            .result
            .state;


        continue;
      }


      if (
        event.type ===
        "CONTINUE"
      ) {

        if (
          event.afterMoveIndex !==
          state.movesUsed
        ) {

          return {
            valid:
              false,

            state,

            invalidEventIndex:
              index,

            reason:
              "Continue move index mismatch.",
          };
        }


        const continued =
          applyCandyCascadeContinue(
            state,
            event.movesGranted,
          );


        if (
          !continued.accepted
        ) {

          return {
            valid:
              false,

            state,

            invalidEventIndex:
              index,

            reason:
              "Invalid Candy Cascade continue event.",
          };
        }


        state =
          continued.state;
      }
    }


    return {
      valid:
        true,

      state,

      invalidEventIndex:
        null,

      reason:
        null,
    };
  };


/*
 * ============================================================
 * GENERAL GAME HELPERS
 * ============================================================
 */

export const getCandyCascadeRemainingObjectives =
  (
    state:
      CandyCascadeGameState,
  ) =>
    state.objectiveProgress.filter(
      objective =>
        !objective.completed,
    );


export const canCandyCascadeContinue =
  (
    state:
      CandyCascadeGameState,
  ) =>
    state.isGameOver &&
    !state.isLevelCleared &&
    !state.extraMovesUsed;


export const canCandyCascadePlay =
  (
    state:
      CandyCascadeGameState,
  ) =>
    !state.isGameOver &&
    !state.isLevelCleared &&
    state.movesRemaining >
      0;


/*
 * ============================================================
 * DEBUG / ENGINE SAFETY HELPER
 * ============================================================
 *
 * Useful when we later compare frontend and backend replay.
 */

export const getCandyCascadeStateFingerprint =
  (
    state:
      CandyCascadeGameState,
  ) => {

    const board =
      state.board
        .map(
          row =>
            row
              .map(
                cell => {

                  if (
                    !cell.active
                  ) {
                    return "X";
                  }


                  const piece =
                    cell.piece
                      ? `${cell.piece.color[0]}${cell.piece.special[0]}`
                      : "-";


                  const blocker =
                    cell.blocker.layers >
                      0
                      ? `${cell.blocker.type[0]}${cell.blocker.layers}`
                      : "-";


                  const drop =
                    cell.dropItem
                      ? `D${cell.dropItem.type[0]}`
                      : "-";


                  return [
                    piece,
                    blocker,
                    cell.jellyLayers,
                    drop,
                  ].join(
                    ".",
                  );
                },
              )
              .join(
                ",",
              ),
        )
        .join(
          "/",
        );


    return [
      state.levelId,
      state.randomStep,
      state.nextPieceId,
      state.movesRemaining,
      state.movesUsed,
      state.score,
      state.shuffleCount,
      state.extraMovesUsed
        ? 1
        : 0,
      state.isLevelCleared
        ? 1
        : 0,
      state.isGameOver
        ? 1
        : 0,
      board,
    ].join(
      "|",
    );
  };


/*
 * ============================================================
 * EXPORTED COLOR LIST
 * ============================================================
 *
 * Helpful later for rendering / backend tests.
 */

export const CANDY_CASCADE_ENGINE_COLORS =
  CANDY_CASCADE_ALL_COLORS;
