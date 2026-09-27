import type {
  CandyCascadeColor,
  CandyCascadeInitialBlocker,
  CandyCascadeInitialDropItem,
  CandyCascadeLevelConfig,
  CandyCascadeObjective,
  CandyCascadePoint,
} from "./candyCascadeTypes";


/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE CONSTANTS
 * ============================================================
 *
 * Design goals:
 *
 * - 200 deterministic levels
 * - Maximum 9 × 9 board
 * - Different board shapes
 * - 4 / 5 / 6 piece colors depending on difficulty
 * - Score objectives
 * - Color collection
 * - Jelly clearing
 * - Layered blockers
 * - Drop-item objectives
 * - Mixed-objective late levels
 * - No Math.random()
 *
 * Reward model:
 *
 * Rewarded ad
 *      ↓
 * Start / replay level
 *      ↓
 * Complete all objectives
 *      ↓
 * ₹0.05 + 10 diamonds
 *      ↓
 * Unlock next level
 *
 * Failed run:
 *
 * One rewarded-ad continue
 *      ↓
 * +5 moves
 *
 * No additional cash/diamond reward for continue.
 */


/*
 * ============================================================
 * GAME / REWARD CONSTANTS
 * ============================================================
 */

export const CANDY_CASCADE_MAX_LEVEL =
  1000;


export const CANDY_CASCADE_REWARD_PAISE =
  5;


export const CANDY_CASCADE_DIAMOND_REWARD =
  10;


export const CANDY_CASCADE_EXTRA_MOVES =
  5;


export const CANDY_CASCADE_MAX_CONTINUES =
  1;


/*
 * ============================================================
 * BOARD
 * ============================================================
 */

export const CANDY_CASCADE_ROWS =
  9;


export const CANDY_CASCADE_COLUMNS =
  9;


export const CANDY_CASCADE_MAX_BOARD_CELLS =
  CANDY_CASCADE_ROWS *
  CANDY_CASCADE_COLUMNS;


/*
 * ============================================================
 * DETERMINISTIC ENGINE SAFETY LIMITS
 * ============================================================
 */

export const CANDY_CASCADE_MAX_BOARD_BUILD_ATTEMPTS =
  120;


export const CANDY_CASCADE_MAX_CASCADE_STEPS_PER_MOVE =
  80;


export const CANDY_CASCADE_MAX_RUN_EVENTS =
  600;


export const CANDY_CASCADE_MAX_MOVES_PER_RUN =
  250;


export const CANDY_CASCADE_MAX_SHUFFLES =
  100;


/*
 * One day maximum reported elapsed time.
 */
export const CANDY_CASCADE_MAX_ELAPSED_SECONDS =
  86400;


/*
 * ============================================================
 * UI / ANIMATION TIMING
 * ============================================================
 *
 * These values affect presentation only.
 *
 * They MUST NOT influence deterministic gameplay results.
 */

export const CANDY_CASCADE_SWAP_ANIMATION_MS =
  130;


export const CANDY_CASCADE_INVALID_SWAP_MS =
  130;


export const CANDY_CASCADE_MATCH_ANIMATION_MS =
  180;


export const CANDY_CASCADE_FALL_ANIMATION_MS =
  180;


export const CANDY_CASCADE_SPECIAL_BLAST_MS =
  220;


export const CANDY_CASCADE_IDLE_HINT_MS =
  5000;


/*
 * ============================================================
 * SCORE VALUES
 * ============================================================
 */

export const CANDY_CASCADE_SCORE_PER_NORMAL_PIECE =

  5;





export const CANDY_CASCADE_SCORE_PER_SPECIAL_PIECE =

  10;





export const CANDY_CASCADE_SCORE_PER_JELLY_LAYER =

  8;





export const CANDY_CASCADE_SCORE_PER_BLOCKER_LAYER =

  10;





export const CANDY_CASCADE_SCORE_PER_DROP_ITEM =

  80;


/*
 * Each automatic cascade increases the score multiplier.
 *
 * Cascade 1 = ×1
 * Cascade 2 = ×2
 * Cascade 3 = ×3
 * ...
 */
export const CANDY_CASCADE_MAX_COMBO_MULTIPLIER =

  4;


/*
 * ============================================================
 * COLORS
 * ============================================================
 */

export const CANDY_CASCADE_ALL_COLORS:
CandyCascadeColor[] = [
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "PURPLE",
  "ORANGE",
];


/*
 * ============================================================
 * WORLD / CHAPTER DISPLAY
 * ============================================================
 *
 * 10 worlds × 20 levels.
 *
 * These are our own GenZGames presentation names.
 */

export const CANDY_CASCADE_LEVELS_PER_WORLD =
  20;


const CANDY_CASCADE_BASE_WORLD_NAMES = [

  "Pop Start",

  "Glow Garden",

  "Jelly Rush",

  "Prism Park",

  "Neon Treats",

  "Frost Beat",

  "Cosmic Pop",

  "Hyper Mix",

  "Nova Burst",

  "Grand Glow",

] as const;





export const CANDY_CASCADE_WORLD_NAMES =

  Array.from(

    {

      length:

        Math.ceil(

          CANDY_CASCADE_MAX_LEVEL /

            CANDY_CASCADE_LEVELS_PER_WORLD,

        ),

    },

    (

      _,

      index,

    ) => {



      const baseName =

        CANDY_CASCADE_BASE_WORLD_NAMES[

          index %

            CANDY_CASCADE_BASE_WORLD_NAMES.length

        ];





      const chapter =

        Math.floor(

          index /

            CANDY_CASCADE_BASE_WORLD_NAMES.length,

        ) +

        1;





      return chapter ===

        1

        ? baseName

        : `${baseName} ${chapter}`;

    },

  );


/*
 * ============================================================
 * BASIC HELPERS
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


export const normalizeCandyCascadeLevel =
  (
    level:
      number,
  ) =>
    clamp(
      Math.floor(
        level,
      ),
      1,
      CANDY_CASCADE_MAX_LEVEL,
    );

/*
 * Candy Cascade has 1000 unique levels,
 * but gameplay difficulty stays inside
 * the proven 1 -> 200 design range.
 *
 * Examples:
 *
 * 1    -> difficulty 1
 * 200  -> difficulty 200
 * 201  -> difficulty 1
 * 400  -> difficulty 200
 * 801  -> difficulty 1
 * 1000 -> difficulty 200
 *
 * The REAL level number is still used
 * for deterministic cell/layout hashing.
 */
export const getCandyCascadeDifficultyLevel =

  (

    level:

      number,

  ) => {



    const safeLevel =

      normalizeCandyCascadeLevel(

        level,

      );





    return (

      (

        safeLevel -

        1

      ) %

      200

    ) +

      1;

  };
export const getCandyCascadeWorld =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeCandyCascadeLevel(
        level,
      );


    return Math.min(
      CANDY_CASCADE_WORLD_NAMES.length,
      Math.floor(
        (
          safeLevel -
          1
        ) /
          CANDY_CASCADE_LEVELS_PER_WORLD,
      ) +
        1,
    );
  };


export const getCandyCascadeWorldName =
  (
    level:
      number,
  ) =>
    CANDY_CASCADE_WORLD_NAMES[
      getCandyCascadeWorld(
        level,
      ) -
        1
    ];


/*
 * ============================================================
 * DETERMINISTIC INTEGER HASH
 * ============================================================
 *
 * This is NOT gameplay random generation.
 *
 * It is only used while building deterministic level
 * configurations such as:
 *
 * - where jelly begins
 * - where blockers begin
 * - which cells hold drop items
 *
 * Same:
 *
 * level + row + column + salt
 *
 * always produces the same result.
 */

const levelCellHash =
  (
    level:
      number,

    row:
      number,

    col:
      number,

    salt:
      number,
  ) => {

    let value =
      (
        Math.imul(
          level +
            salt *
              17,
          0x9e3779b1,
        ) ^
        Math.imul(
          row +
            1,
          0x85ebca6b,
        ) ^
        Math.imul(
          col +
            1,
          0xc2b2ae35,
        )
      ) >>>
      0;


    value ^=
      value >>>
      16;


    value =
      Math.imul(
        value,
        0x7feb352d,
      ) >>>
      0;


    value ^=
      value >>>
      15;


    value =
      Math.imul(
        value,
        0x846ca68b,
      ) >>>
      0;


    value ^=
      value >>>
      16;


    return (
      value >>>
      0
    );
  };


const pointKey =
  (
    point:
      CandyCascadePoint,
  ) =>
    `${point.row}:${point.col}`;


/*
 * ============================================================
 * COLOR DIFFICULTY
 * ============================================================
 *
 * Early levels:
 * 4 colors
 *
 * Middle:
 * 5
 *
 * Later:
 * 6
 */

export const getCandyCascadeColorCount =
  (
    level:
      number,
  ) => {

       const safeLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


    if (
      safeLevel <=
      20
    ) {
      return 4;
    }


    if (
      safeLevel <=
      90
    ) {
      return 5;
    }


    /*
     * Levels 91-120 occasionally remain at five colors
     * while players learn harder objectives.
     */
    if (
      safeLevel <=
      120 &&
      safeLevel %
        4 !==
        0
    ) {
      return 5;
    }


    return 6;
  };


export const getCandyCascadeColors =
  (
    level:
      number,
  ): CandyCascadeColor[] => {

    const count =
      getCandyCascadeColorCount(
        level,
      );


    /*
     * Rotate which colors appear so early worlds
     * don't always use the exact same four pieces.
     */
    const rotation =
      (
        getCandyCascadeWorld(
          level,
        ) -
        1
      ) %
      CANDY_CASCADE_ALL_COLORS.length;


    const rotated = [
      ...CANDY_CASCADE_ALL_COLORS.slice(
        rotation,
      ),

      ...CANDY_CASCADE_ALL_COLORS.slice(
        0,
        rotation,
      ),
    ];


    return rotated.slice(
      0,
      count,
    );
  };


/*
 * ============================================================
 * MOVES
 * ============================================================
 */

export const getCandyCascadeMoves =
  (
    level:
      number,
  ) => {

       const safeLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


    let moves =
      24;


    if (
      safeLevel >=
      11
    ) {
      moves =
        26;
    }


    if (
      safeLevel >=
      31
    ) {
      moves =
        27;
    }


    if (
      safeLevel >=
      61
    ) {
      moves =
        28;
    }


    if (
      safeLevel >=
      111
    ) {
      moves =
        27;
    }


    if (
      safeLevel >=
      151
    ) {
      moves =
        28;
    }


    if (
      safeLevel >=
      191
    ) {
      moves =
        30;
    }


    /*
     * Small deterministic variation prevents every
     * level in one chapter feeling identical.
     */
    const variation =
      safeLevel %
        5 ===
      0
        ? 2
        : safeLevel %
              4 ===
            0
          ? 1
          : 0;


    return moves +
      variation;
  };


/*
 * ============================================================
 * BOARD SHAPES
 * ============================================================
 */

type CandyCascadeMaskPattern =
  | "FULL"
  | "SOFT_CORNERS"
  | "DIAMOND"
  | "NARROW_TOP"
  | "NARROW_BOTTOM"
  | "SIDE_CUTS"
  | "TWIN_COLUMNS"
  | "WIDE_CENTER";


const getMaskPattern =
  (
    level:
      number,
  ): CandyCascadeMaskPattern => {

       const safeLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


    /*
     * First 10 levels stay simple while the player
     * learns basic swapping and specials.
     */
    if (
      safeLevel <=
      10
    ) {
      return "FULL";
    }


    const patterns:
      CandyCascadeMaskPattern[] = [
      "FULL",
      "SOFT_CORNERS",
      "DIAMOND",
      "NARROW_TOP",
      "NARROW_BOTTOM",
      "SIDE_CUTS",
      "TWIN_COLUMNS",
      "WIDE_CENTER",
    ];


    return patterns[
      Math.floor(
        (
          safeLevel -
          11
        ) /
          3,
      ) %
        patterns.length
    ];
  };


const isActiveForPattern =
  (
    pattern:
      CandyCascadeMaskPattern,

    row:
      number,

    col:
      number,
  ) => {

    const lastRow =
      CANDY_CASCADE_ROWS -
      1;


    const lastCol =
      CANDY_CASCADE_COLUMNS -
      1;


    const centerRow =
      Math.floor(
        CANDY_CASCADE_ROWS /
          2,
      );


    const centerCol =
      Math.floor(
        CANDY_CASCADE_COLUMNS /
          2,
      );


    if (
      pattern ===
      "FULL"
    ) {
      return true;
    }


    if (
      pattern ===
      "SOFT_CORNERS"
    ) {

      const corner =
        (
          row ===
            0 ||
          row ===
            lastRow
        ) &&
        (
          col ===
            0 ||
          col ===
            lastCol
        );


      return !corner;
    }


    if (
      pattern ===
      "DIAMOND"
    ) {

      const distance =
        Math.abs(
          row -
            centerRow,
        ) +
        Math.abs(
          col -
            centerCol,
        );


      return distance <=
        6;
    }


    if (
      pattern ===
      "NARROW_TOP"
    ) {

      if (
        row ===
        0
      ) {
        return col >=
          2 &&
          col <=
            lastCol -
              2;
      }


      if (
        row ===
        1
      ) {
        return col >=
          1 &&
          col <=
            lastCol -
              1;
      }


      return true;
    }


    if (
      pattern ===
      "NARROW_BOTTOM"
    ) {

      if (
        row ===
        lastRow
      ) {
        return col >=
          2 &&
          col <=
            lastCol -
              2;
      }


      if (
        row ===
        lastRow -
          1
      ) {
        return col >=
          1 &&
          col <=
            lastCol -
              1;
      }


      return true;
    }


    if (
      pattern ===
      "SIDE_CUTS"
    ) {

      if (
        row >=
          2 &&
        row <=
          6 &&
        (
          col ===
            0 ||
          col ===
            lastCol
        )
      ) {
        return false;
      }


      return true;
    }


    if (
      pattern ===
      "TWIN_COLUMNS"
    ) {

      /*
       * Two large playable sides divided by a narrow
       * center channel.
       *
       * Keep center entry/exit cells so the board still
       * feels connected visually.
       */
      if (
        col ===
          centerCol &&
        row >=
          2 &&
        row <=
          6
      ) {
        return false;
      }


      return true;
    }


    /*
     * WIDE_CENTER
     */
    if (
      (
        row ===
          0 ||
        row ===
          lastRow
      ) &&
      (
        col <
          2 ||
        col >
          lastCol -
            2
      )
    ) {
      return false;
    }


    return true;
  };


export const createCandyCascadeActiveMask =
  (
    level:
      number,
  ): boolean[][] => {

    const pattern =
      getMaskPattern(
        level,
      );


    return Array.from(
      {
        length:
          CANDY_CASCADE_ROWS,
      },
      (
        _,
        row,
      ) =>
        Array.from(
          {
            length:
              CANDY_CASCADE_COLUMNS,
          },
          (
            __,
            col,
          ) =>
            isActiveForPattern(
              pattern,
              row,
              col,
            ),
        ),
    );
  };


/*
 * ============================================================
 * ACTIVE CELL HELPERS
 * ============================================================
 */

const getActiveCells =
  (
    mask:
      boolean[][],
  ): CandyCascadePoint[] => {

    const cells:
      CandyCascadePoint[] =
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

        if (
          mask[row]
            ?.[col]
        ) {

          cells.push({
            row,
            col,
          });
        }
      }
    }


    return cells;
  };


const deterministicCells =
  (
    level:
      number,

    mask:
      boolean[][],

    salt:
      number,

    excluded:
      Set<string> =
        new Set(),
  ) =>
    getActiveCells(
      mask,
    )
      .filter(
        point =>
          !excluded.has(
            pointKey(
              point,
            ),
          ),
      )
      .sort(
        (
          first,
          second,
        ) => {

          const firstHash =
            levelCellHash(
              level,
              first.row,
              first.col,
              salt,
            );


          const secondHash =
            levelCellHash(
              level,
              second.row,
              second.col,
              salt,
            );


          if (
            firstHash !==
            secondHash
          ) {
            return firstHash -
              secondHash;
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
      );


/*
 * ============================================================
 * LEVEL FEATURE PLAN
 * ============================================================
 */

interface CandyCascadeFeaturePlan {
  score:
    boolean;

  collect:
    boolean;

  jelly:
    boolean;

  blockers:
    boolean;

  drops:
    boolean;
}


const getFeaturePlan =
  (
    level:
      number,
  ): CandyCascadeFeaturePlan => {

       const safeLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


    /*
     * 1-5
     *
     * Basic matching / score tutorial.
     */
    if (
      safeLevel <=
      5
    ) {
      return {
        score:
          true,

        collect:
          false,

        jelly:
          false,

        blockers:
          false,

        drops:
          false,
      };
    }


    /*
     * 6-10
     *
     * Learn color collection.
     */
    if (
      safeLevel <=
      10
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          false,

        blockers:
          false,

        drops:
          false,
      };
    }


    /*
     * 11-20
     *
     * Jelly introduction.
     */
    if (
      safeLevel <=
      20
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          true,

        blockers:
          false,

        drops:
          false,
      };
    }


    /*
     * 21-30
     *
     * Jelly + collection.
     */
    if (
      safeLevel <=
      30
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          true,

        blockers:
          false,

        drops:
          false,
      };
    }


    /*
     * 31-45
     *
     * Blockers.
     */
    if (
      safeLevel <=
      45
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          false,

        blockers:
          true,

        drops:
          false,
      };
    }


    /*
     * 46-60
     *
     * Jelly + blockers.
     */
    if (
      safeLevel <=
      60
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          true,

        blockers:
          true,

        drops:
          false,
      };
    }


    /*
     * 61-75
     *
     * Drop-item introduction.
     */
    if (
      safeLevel <=
      75
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          false,

        blockers:
          false,

        drops:
          true,
      };
    }


    /*
     * 76-90
     *
     * Drops + color collection.
     */
    if (
      safeLevel <=
      90
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          false,

        blockers:
          false,

        drops:
          true,
      };
    }


    /*
     * 91-110
     *
     * Jelly + blockers.
     */
    if (
      safeLevel <=
      110
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          true,

        blockers:
          true,

        drops:
          false,
      };
    }


    /*
     * 111-130
     *
     * Drops + collection.
     */
    if (
      safeLevel <=
      130
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          false,

        blockers:
          false,

        drops:
          true,
      };
    }


    /*
     * 131-150
     *
     * Drops + blockers.
     */
    if (
      safeLevel <=
      150
    ) {
      return {
        score:
          false,

        collect:
          false,

        jelly:
          false,

        blockers:
          true,

        drops:
          true,
      };
    }


    /*
     * 151-170
     *
     * Triple objective.
     */
    if (
      safeLevel <=
      170
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          true,

        blockers:
          true,

        drops:
          false,
      };
    }


    /*
     * 171-190
     *
     * Collection + jelly + drops.
     */
    if (
      safeLevel <=
      190
    ) {
      return {
        score:
          false,

        collect:
          true,

        jelly:
          true,

        blockers:
          false,

        drops:
          true,
      };
    }


    /*
     * 191-200
     *
     * Final challenge:
     *
     * drops + jelly + blockers.
     */
    return {
      score:
        false,

      collect:
        false,

      jelly:
        true,

      blockers:
        true,

      drops:
        true,
    };
  };


/*
 * ============================================================
 * JELLY
 * ============================================================
 */

const createEmptyNumberMask =
  () =>
    Array.from(
      {
        length:
          CANDY_CASCADE_ROWS,
      },
      () =>
        Array<number>(
          CANDY_CASCADE_COLUMNS,
        ).fill(
          0,
        ),
    );


const createJellyMask =
  (
    level:
      number,

    activeMask:
      boolean[][],

    enabled:
      boolean,

    excluded:
      Set<string>,
  ) => {

    const jelly =
      createEmptyNumberMask();


    if (
      !enabled
    ) {
      return jelly;
    }


       const safeLevel =

      normalizeCandyCascadeLevel(

        level,

      );





    const difficultyLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );





    const candidateCount =
      getActiveCells(
        activeMask,
      ).length;


    const requested =
      safeLevel >=
          11 &&
        safeLevel <=
          20
        ? Math.min(
            candidateCount,
            safeLevel <=
              15
              ? 18 +
                (
                  safeLevel -
                  11
                )
              : 20 +
                (
                  safeLevel -
                  16
                ),
          )
        : clamp(
            10 +
              Math.floor(
                difficultyLevel /
                  12,
              ),

            10,
            Math.min(
              30,
              candidateCount,
            ),
          );


    const candidates =
      deterministicCells(
        safeLevel,
        activeMask,
        101,
        excluded,
      );


    candidates
      .slice(
        0,
        requested,
      )
      .forEach(
        (
          point,
          index,
        ) => {

                                const doubleLayer =

            (
              safeLevel >=
                16 &&
              safeLevel <=
                20 &&
              index %
                4 ===
              0
            ) ||
            (
              difficultyLevel >=
                90 &&
              (
                index +
                safeLevel
              ) %
                3 ===
              0
            );


          jelly[
            point.row
          ][
            point.col
          ] =
            doubleLayer
              ? 2
              : 1;
        },
      );


    return jelly;
  };


const totalNumberMask =
  (
    mask:
      number[][],
  ) =>
    mask.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.reduce(
          (
            rowTotal,
            value,
          ) =>
            rowTotal +
            value,
          0,
        ),
      0,
    );


/*
 * ============================================================
 * DROP EXITS
 * ============================================================
 */

const getBottomActiveCell =
  (
    mask:
      boolean[][],

    col:
      number,
  ): CandyCascadePoint |
    null => {

    for (
      let row =
        CANDY_CASCADE_ROWS -
        1;

      row >=
      0;

      row -=
        1
    ) {

      if (
        mask[row]
          ?.[col]
      ) {

        return {
          row,
          col,
        };
      }
    }


    return null;
  };


const getTopActiveCell =
  (
    mask:
      boolean[][],

    col:
      number,
  ): CandyCascadePoint |
    null => {

    for (
      let row =
        0;

      row <
      CANDY_CASCADE_ROWS;

      row +=
        1
    ) {

      if (
        mask[row]
          ?.[col]
      ) {

        return {
          row,
          col,
        };
      }
    }


    return null;
  };


const createDropConfiguration =
  (
    level:
      number,

    activeMask:
      boolean[][],

    enabled:
      boolean,
  ) => {

    if (
      !enabled
    ) {

      return {
        dropItems:
          [] as
            CandyCascadeInitialDropItem[],

        dropExits:
          [] as
            CandyCascadePoint[],
      };
    }


    const safeLevel =
      normalizeCandyCascadeLevel(
        level,
      );

        const difficultyLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


        const desiredCount =

      difficultyLevel >=

        171

        ? 3

        : difficultyLevel >=

            121

          ? 2

          : 1;


    const columnOrder =
      Array.from(
        {
          length:
            CANDY_CASCADE_COLUMNS,
        },
        (
          _,
          col,
        ) =>
          col,
      )
        .filter(
          col =>
            getTopActiveCell(
              activeMask,
              col,
            ) !==
              null &&
            getBottomActiveCell(
              activeMask,
              col,
            ) !==
              null,
        )
        .sort(
          (
            first,
            second,
          ) => {

            const firstHash =
              levelCellHash(
                safeLevel,
                0,
                first,
                211,
              );


            const secondHash =
              levelCellHash(
                safeLevel,
                0,
                second,
                211,
              );


            return firstHash -
              secondHash;
          },
        );


    const selectedColumns =
      columnOrder.slice(
        0,
        desiredCount,
      );


    const dropItems:
      CandyCascadeInitialDropItem[] =
      [];


    const dropExits:
      CandyCascadePoint[] =
      [];


    selectedColumns.forEach(
      (
        col,
        index,
      ) => {

        const top =
          getTopActiveCell(
            activeMask,
            col,
          );


        const bottom =
          getBottomActiveCell(
            activeMask,
            col,
          );


        if (
          !top ||
          !bottom
        ) {
          return;
        }


        dropItems.push({
          row:
            top.row,

          col:
            top.col,

          type:
            index %
                3 ===
              0
              ? "STAR"
              : index %
                    3 ===
                  1
                ? "GEM"
                : "FRUIT",
        });


        dropExits.push(
          bottom,
        );
      },
    );


    return {
      dropItems,
      dropExits,
    };
  };


/*
 * ============================================================
 * BLOCKERS
 * ============================================================
 */

const createBlockers =
  (
    level:
      number,

    activeMask:
      boolean[][],

    enabled:
      boolean,

    excluded:
      Set<string>,
  ): CandyCascadeInitialBlocker[] => {

    if (
      !enabled
    ) {
      return [];
    }


    const safeLevel =
      normalizeCandyCascadeLevel(
        level,
      );

        const difficultyLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );


    const requested =
      clamp(
              5 +

        Math.floor(

          (

            difficultyLevel -

              30

          ) /

            9,

        ),

        5,
        18,
      );


    const candidates =
      deterministicCells(
        safeLevel,
        activeMask,
        307,
        excluded,
      );


    return candidates
      .slice(
        0,
        requested,
      )
      .map(
        (
          point,
          index,
        ) => {

          if (
            difficultyLevel >= 121 &&
            index %
              5 ===
              0
          ) {

            return {
              row:
                point.row,

              col:
                point.col,

              type:
                "CRATE",

              layers:
                difficultyLevel >= 181
                  ? 3
                  : 2,
            };
          }


          if (
            difficultyLevel >= 71 &&
            index %
              4 ===
              0
          ) {

            return {
              row:
                point.row,

              col:
                point.col,

              type:
                "LICORICE",

              layers:
                1,
            };
          }


          return {
            row:
              point.row,

            col:
              point.col,

            type:
              "FROSTING",

            layers:
              difficultyLevel >= 100 &&
                index %
                  3 ===
                  0
                ? 2
                : 1,
          };
        },
      );
  };


const totalBlockerLayers =
  (
    blockers:
      CandyCascadeInitialBlocker[],
  ) =>
    blockers.reduce(
      (
        total,
        blocker,
      ) =>
        total +
        blocker.layers,
      0,
    );


/*
 * ============================================================
 * COLOR COLLECTION OBJECTIVE
 * ============================================================
 */

const getCollectColor =
  (
    level:
      number,

    colors:
      CandyCascadeColor[],
  ) => {

    const index =
      (
        normalizeCandyCascadeLevel(
          level,
        ) *
          3 +
        getCandyCascadeWorld(
          level,
        )
      ) %
      colors.length;


    return colors[
      index
    ];
  };


const getCollectTarget =

  (

    level:

      number,

  ) => {



    const safeLevel =

      normalizeCandyCascadeLevel(

        level,

      );



    const difficultyLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );



    if (

      safeLevel >=

        6 &&

      safeLevel <=

        10

    ) {

      return (

        28 +

        (

          safeLevel -

          6

        ) *

          2

      );

    }



    return clamp(

      18 +

        Math.floor(

          difficultyLevel /

            8,

        ),



      18,

      36,

    );

  };


/*
 * ============================================================
 * SCORE / STAR TARGETS
 * ============================================================
 */

export interface CandyCascadeStarThresholds {
  oneStar:
    number;

  twoStars:
    number;

  threeStars:
    number;
}


export const getCandyCascadeStarThresholds =
  (
    level:
      number,
  ): CandyCascadeStarThresholds => {

        const difficultyLevel =

      getCandyCascadeDifficultyLevel(

        level,

      );





        const oneStar =

      normalizeCandyCascadeLevel(
        level,
      ) <=
        5
        ? 320 +
          normalizeCandyCascadeLevel(
            level,
          ) *
            20
        : 140 +
          difficultyLevel *
            8;

    return {
      oneStar,

      twoStars:
        Math.round(
          oneStar *
            1.45,
        ),

      threeStars:
        Math.round(
          oneStar *
            1.9,
        ),
    };
  };


export const getCandyCascadeStarCount =
  (
    level:
      number,

    score:
      number,
  ):
    0 |
    1 |
    2 |
    3 => {

    const thresholds =
      getCandyCascadeStarThresholds(
        level,
      );


    if (
      score >=
      thresholds.threeStars
    ) {
      return 3;
    }


    if (
      score >=
      thresholds.twoStars
    ) {
      return 2;
    }


    if (
      score >=
      thresholds.oneStar
    ) {
      return 1;
    }


    return 0;
  };


/*
 * ============================================================
 * OBJECTIVES
 * ============================================================
 */

const createObjectives =
  (
    level:
      number,

    colors:
      CandyCascadeColor[],

    featurePlan:
      CandyCascadeFeaturePlan,

    jellyMask:
      number[][],

    blockers:
      CandyCascadeInitialBlocker[],

    dropItems:
      CandyCascadeInitialDropItem[],
  ): CandyCascadeObjective[] => {

    const objectives:
      CandyCascadeObjective[] =
      [];


    if (
      featurePlan.score
    ) {

      objectives.push({
        type:
          "SCORE",

        targetScore:
          getCandyCascadeStarThresholds(
            level,
          ).oneStar,
      });
    }


    if (
      featurePlan.collect
    ) {

      objectives.push({
        type:
          "COLLECT_COLOR",

        color:
          getCollectColor(
            level,
            colors,
          ),

        targetCount:
          getCollectTarget(
            level,
          ),
      });
    }


    if (
      featurePlan.jelly
    ) {

      objectives.push({
        type:
          "CLEAR_JELLY",

        targetLayers:
          totalNumberMask(
            jellyMask,
          ),
      });
    }


    if (
      featurePlan.blockers
    ) {

      objectives.push({
        type:
          "BREAK_BLOCKERS",

        targetLayers:
          totalBlockerLayers(
            blockers,
          ),
      });
    }


    if (
      featurePlan.drops
    ) {

      objectives.push({
        type:
          "DROP_ITEMS",

        targetCount:
          dropItems.length,
      });
    }


    return objectives;
  };


/*
 * ============================================================
 * GENERATE ONE OF THE 200 LEVELS
 * ============================================================
 */

export const generateCandyCascadeLevel =
  (
    level:
      number,
  ): CandyCascadeLevelConfig => {

    const safeLevel =
      normalizeCandyCascadeLevel(
        level,
      );


    const colors =
      getCandyCascadeColors(
        safeLevel,
      );


    const activeMask =
      createCandyCascadeActiveMask(
        safeLevel,
      );


    const featurePlan =
      getFeaturePlan(
        safeLevel,
      );


    /*
     * Drop items / exits are placed first.
     *
     * Blockers should never begin directly on a drop item
     * or drop exit.
     */
    const {
      dropItems,
      dropExits,
    } =
      createDropConfiguration(
        safeLevel,
        activeMask,
        featurePlan.drops,
      );


    const reservedCells =
      new Set<string>();


    dropItems.forEach(
      item => {

        reservedCells.add(
          pointKey(
            item,
          ),
        );
      },
    );


    dropExits.forEach(
      point => {

        reservedCells.add(
          pointKey(
            point,
          ),
        );
      },
    );


    const blockers =
      createBlockers(
        safeLevel,
        activeMask,
        featurePlan.blockers,
        reservedCells,
      );


    /*
     * Jelly may sit underneath normal pieces and blockers,
     * but not under ingredient start/exit cells in this
     * first GenZGames implementation.
     */
    const jellyMask =
      createJellyMask(
        safeLevel,
        activeMask,
        featurePlan.jelly,
        reservedCells,
      );


    const objectives =
      createObjectives(
        safeLevel,
        colors,
        featurePlan,
        jellyMask,
        blockers,
        dropItems,
      );


    return {
      id:
        safeLevel,

      rows:
        CANDY_CASCADE_ROWS,

      columns:
        CANDY_CASCADE_COLUMNS,

      colors,

      moves:
        getCandyCascadeMoves(
          safeLevel,
        ),

      objectives,

      activeMask,

      jellyMask,

      blockers,

      dropItems,

      dropExits,

      /*
       * Already supported by our type architecture.
       *
       * We intentionally keep these empty for the first
       * engine version.
       *
       * Once the core 200-level engine is stable we can
       * introduce portal/conveyor chapters without changing
       * the save format or board model.
       */
      portals:
        [],

      conveyors:
        [],
    };
  };


/*
 * ============================================================
 * GENERATE ALL 200 LEVELS
 * ============================================================
 */

export const generateAllCandyCascadeLevels =
  () =>
    Array.from(
      {
        length:
          CANDY_CASCADE_MAX_LEVEL,
      },
      (
        _,
        index,
      ) =>
        generateCandyCascadeLevel(
          index +
            1,
        ),
    );


/*
 * ============================================================
 * PROGRESSION HELPERS
 * ============================================================
 */

export const isCandyCascadeFinalLevel =
  (
    level:
      number,
  ) =>
    normalizeCandyCascadeLevel(
      level,
    ) ===
    CANDY_CASCADE_MAX_LEVEL;


export const getNextCandyCascadeLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeCandyCascadeLevel(
        level,
      );


    if (
      safeLevel >=
      CANDY_CASCADE_MAX_LEVEL
    ) {
      return null;
    }


    return safeLevel +
      1;
  };


/*
 * ============================================================
 * LEVEL FEATURE LABELS
 * ============================================================
 *
 * UI helper for level-selection cards / chapter previews.
 */

export const getCandyCascadeLevelFeatures =
  (
    level:
      number,
  ) => {

    const config =
      generateCandyCascadeLevel(
        level,
      );


    return config.objectives.map(
      objective => {

        if (
          objective.type ===
          "SCORE"
        ) {
          return "Score";
        }


        if (
          objective.type ===
          "COLLECT_COLOR"
        ) {
          return "Collect";
        }


        if (
          objective.type ===
          "CLEAR_JELLY"
        ) {
          return "Jelly";
        }


        if (
          objective.type ===
          "BREAK_BLOCKERS"
        ) {
          return "Blockers";
        }


        return "Drop";
      },
    );
  };