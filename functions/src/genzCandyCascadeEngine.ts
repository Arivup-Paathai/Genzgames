/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE BACKEND ENGINE
 * ============================================================
 *
 * IMPORTANT:
 *
 * This is the server-side deterministic mirror of:
 *
 * src/games/candyCascade/
 *
 * The server NEVER trusts client-reported:
 *
 * - score
 * - objective completion
 * - remaining moves
 * - board state
 * - stars
 * - cascade results
 *
 * It rebuilds the game using:
 *
 * level + seed + ordered run events
 *
 * Never use Math.random(), Date.now(), or current time
 * inside deterministic gameplay.
 */


/*
 * ============================================================
 * CORE TYPES
 * ============================================================
 */

export interface GenZCandyCascadePoint {
  row: number;
  col: number;
}


export type GenZCandyCascadeDirection =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT";


export type GenZCandyCascadeColor =
  | "RED"
  | "BLUE"
  | "GREEN"
  | "YELLOW"
  | "PURPLE"
  | "ORANGE";


export type GenZCandyCascadeSpecialType =
  | "NONE"
  | "STRIPED_ROW"
  | "STRIPED_COLUMN"
  | "WRAPPED"
  | "COLOR_BOMB";


export interface GenZCandyCascadePiece {
  id: number;

  color:
    GenZCandyCascadeColor;

  special:
    GenZCandyCascadeSpecialType;
}


export type GenZCandyCascadeBlockerType =
  | "NONE"
  | "FROSTING"
  | "LICORICE"
  | "CRATE";


export interface GenZCandyCascadeBlocker {
  type:
    GenZCandyCascadeBlockerType;

  layers:
    number;
}


export type GenZCandyCascadeDropItemType =
  | "STAR"
  | "GEM"
  | "FRUIT";


export interface GenZCandyCascadeDropItem {
  id: number;

  type:
    GenZCandyCascadeDropItemType;
}


export interface GenZCandyCascadeCell {
  row: number;

  col: number;

  active: boolean;

  piece:
    GenZCandyCascadePiece |
    null;

  blocker:
    GenZCandyCascadeBlocker;

  jellyLayers:
    number;

  dropItem:
    GenZCandyCascadeDropItem |
    null;

  isDropExit:
    boolean;

  portalId:
    string |
    null;

  portalTarget:
    GenZCandyCascadePoint |
    null;

  conveyor:
    GenZCandyCascadeDirection |
    "NONE";
}


export type GenZCandyCascadeBoard =
  GenZCandyCascadeCell[][];


/*
 * ============================================================
 * OBJECTIVES
 * ============================================================
 */

export type GenZCandyCascadeObjectiveType =
  | "SCORE"
  | "COLLECT_COLOR"
  | "CLEAR_JELLY"
  | "BREAK_BLOCKERS"
  | "DROP_ITEMS";


export interface GenZCandyCascadeScoreObjective {
  type:
    "SCORE";

  targetScore:
    number;
}


export interface GenZCandyCascadeCollectColorObjective {
  type:
    "COLLECT_COLOR";

  color:
    GenZCandyCascadeColor;

  targetCount:
    number;
}


export interface GenZCandyCascadeClearJellyObjective {
  type:
    "CLEAR_JELLY";

  targetLayers:
    number;
}


export interface GenZCandyCascadeBreakBlockersObjective {
  type:
    "BREAK_BLOCKERS";

  targetLayers:
    number;
}


export interface GenZCandyCascadeDropItemsObjective {
  type:
    "DROP_ITEMS";

  targetCount:
    number;
}


export type GenZCandyCascadeObjective =
  | GenZCandyCascadeScoreObjective
  | GenZCandyCascadeCollectColorObjective
  | GenZCandyCascadeClearJellyObjective
  | GenZCandyCascadeBreakBlockersObjective
  | GenZCandyCascadeDropItemsObjective;


export interface GenZCandyCascadeObjectiveProgress {
  type:
    GenZCandyCascadeObjectiveType;

  color:
    GenZCandyCascadeColor |
    null;

  current:
    number;

  target:
    number;

  completed:
    boolean;
}


/*
 * ============================================================
 * LEVEL CONFIG
 * ============================================================
 */

export interface GenZCandyCascadeInitialBlocker {
  row: number;

  col: number;

  type:
    Exclude<
      GenZCandyCascadeBlockerType,
      "NONE"
    >;

  layers:
    number;
}


export interface GenZCandyCascadeInitialDropItem {
  row: number;

  col: number;

  type:
    GenZCandyCascadeDropItemType;
}


export interface GenZCandyCascadePortalConfig {
  id: string;

  from:
    GenZCandyCascadePoint;

  to:
    GenZCandyCascadePoint;
}


export interface GenZCandyCascadeConveyorConfig {
  row: number;

  col: number;

  direction:
    GenZCandyCascadeDirection;
}


export interface GenZCandyCascadeLevelConfig {
  id: number;

  rows: number;

  columns: number;

  colors:
    GenZCandyCascadeColor[];

  moves: number;

  objectives:
    GenZCandyCascadeObjective[];

  activeMask:
    boolean[][];

  jellyMask:
    number[][];

  blockers:
    GenZCandyCascadeInitialBlocker[];

  dropItems:
    GenZCandyCascadeInitialDropItem[];

  dropExits:
    GenZCandyCascadePoint[];

  portals:
    GenZCandyCascadePortalConfig[];

  conveyors:
    GenZCandyCascadeConveyorConfig[];
}


/*
 * ============================================================
 * MATCH TYPES
 * ============================================================
 */

export type GenZCandyCascadeMatchShape =
  | "LINE"
  | "T_SHAPE"
  | "L_SHAPE"
  | "CROSS";


export interface GenZCandyCascadeMatchGroup {
  color:
    GenZCandyCascadeColor;

  cells:
    GenZCandyCascadePoint[];

  shape:
    GenZCandyCascadeMatchShape;

  orientation:
    "ROW" |
    "COLUMN" |
    null;
}


interface MatchRun {
  color:
    GenZCandyCascadeColor;

  cells:
    GenZCandyCascadePoint[];

  orientation:
    "ROW" |
    "COLUMN";
}


/*
 * ============================================================
 * GAME STATE
 * ============================================================
 */

export interface GenZCandyCascadeGameState {
  levelId: number;

  seed: number;

  randomStep: number;

  nextPieceId: number;

  nextDropItemId: number;

  board:
    GenZCandyCascadeBoard;

  movesRemaining: number;

  movesUsed: number;

  score: number;

  combo: number;

  bestCascade: number;

  objectiveProgress:
    GenZCandyCascadeObjectiveProgress[];

  shuffleCount: number;

  extraMovesUsed: boolean;

  extraMovesGranted: number;

  isGameOver: boolean;

  isLevelCleared: boolean;
}


/*
 * ============================================================
 * RUN EVENTS
 * ============================================================
 */

export interface GenZCandyCascadeSwapEvent {
  type:
    "SWAP";

  moveIndex:
    number;

  from:
    GenZCandyCascadePoint;

  to:
    GenZCandyCascadePoint;
}


export interface GenZCandyCascadeContinueEvent {
  type:
    "CONTINUE";

  afterMoveIndex:
    number;

  movesGranted:
    number;
}


export type GenZCandyCascadeRunEvent =
  | GenZCandyCascadeSwapEvent
  | GenZCandyCascadeContinueEvent;


/*
 * ============================================================
 * REPLAY RESULT
 * ============================================================
 */

export interface GenZCandyCascadeReplayResult {
  valid: boolean;

  state:
    GenZCandyCascadeGameState;

  invalidEventIndex:
    number |
    null;

  reason:
    string |
    null;
}


/*
 * ============================================================
 * RANDOM CONTEXT
 * ============================================================
 */

interface RandomContext {
  seed: number;

  randomStep: number;

  nextPieceId: number;

  nextDropItemId: number;
}


/*
 * ============================================================
 * ENGINE INTERNAL RESULTS
 * ============================================================
 */

interface RemovalOutcome {
  board:
    GenZCandyCascadeBoard;

  removedPieces: number;

  removedSpecialPieces: number;

  destroyedJellyLayers: number;

  destroyedBlockerLayers: number;

  collectedColors:
    Partial<
      Record<
        GenZCandyCascadeColor,
        number
      >
    >;
}


interface GravityOutcome {
  board:
    GenZCandyCascadeBoard;

  droppedItems: number;
}


interface ResolutionTotals {
  removedPieces: number;

  destroyedJellyLayers: number;

  destroyedBlockerLayers: number;

  droppedItems: number;

  gainedScore: number;

  cascadeCount: number;
}


interface CascadeResolution {
  state:
    GenZCandyCascadeGameState;

  context:
    RandomContext;

  totals:
    ResolutionTotals;
}


/*
 * ============================================================
 * PUBLIC CONSTANTS
 * ============================================================
 */

export const GENZ_CANDY_CASCADE_MAX_LEVEL =
  1000;


export const GENZ_CANDY_CASCADE_REWARD_PAISE =
  5;


export const GENZ_CANDY_CASCADE_DIAMOND_REWARD =
  10;


export const GENZ_CANDY_CASCADE_EXTRA_MOVES =
  5;


export const GENZ_CANDY_CASCADE_MAX_CONTINUES =
  1;


/*
 * ============================================================
 * BOARD CONSTANTS
 * ============================================================
 */

const ROWS =
  9;


const COLUMNS =
  9;


const MAX_BOARD_BUILD_ATTEMPTS =
  120;


const MAX_CASCADE_STEPS_PER_MOVE =
  80;


export const GENZ_CANDY_CASCADE_MAX_RUN_EVENTS =
  600;


const MAX_SHUFFLES =
  100;


export const GENZ_CANDY_CASCADE_MAX_MOVES_PER_RUN =
  250;


export const GENZ_CANDY_CASCADE_MAX_ELAPSED_SECONDS =
  86400;


/*
 * ============================================================
 * SCORE CONSTANTS
 * ============================================================
 */

const SCORE_PER_NORMAL_PIECE =
  5;


const SCORE_PER_SPECIAL_PIECE =
  10;


const SCORE_PER_JELLY_LAYER =
  8;


const SCORE_PER_BLOCKER_LAYER =
  10;


const SCORE_PER_DROP_ITEM =
  80;


const MAX_COMBO_MULTIPLIER =
  4;


/*
 * ============================================================
 * COLORS
 * ============================================================
 */

const ALL_COLORS:
GenZCandyCascadeColor[] = [
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "PURPLE",
  "ORANGE",
];


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


const normalizeLevel =
  (
    level:
      number,
  ) =>
    clamp(
      Math.floor(
        level,
      ),
      1,
      GENZ_CANDY_CASCADE_MAX_LEVEL,
    );


const getDifficultyLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
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


const pointKey =
  (
    point:
      GenZCandyCascadePoint,
  ) =>
    `${point.row}:${point.col}`;


const parsePointKey =
  (
    key:
      string,
  ): GenZCandyCascadePoint => {

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
      ROWS &&
    col >=
      0 &&
    col <
      COLUMNS;


const areAdjacent =
  (
    first:
      GenZCandyCascadePoint,

    second:
      GenZCandyCascadePoint,
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
      GenZCandyCascadePoint,
  ): GenZCandyCascadePoint[] => {

    const candidates:
      GenZCandyCascadePoint[] = [
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

const cloneBoard =
  (
    board:
      GenZCandyCascadeBoard,
  ): GenZCandyCascadeBoard =>
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
 * DETERMINISTIC PRNG
 * ============================================================
 */

export const genZCandyCascadeRandomAtStep =
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
      genZCandyCascadeRandomAtStep(
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
 * DETERMINISTIC LEVEL HASH
 * ============================================================
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


    return value >>>
      0;
  };


/*
 * ============================================================
 * WORLD
 * ============================================================
 */

const LEVELS_PER_WORLD =
  20;


const getWorld =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
        level,
      );


    return Math.min(
      Math.ceil(
        GENZ_CANDY_CASCADE_MAX_LEVEL /
          LEVELS_PER_WORLD,
      ),
      Math.floor(
        (
          safeLevel -
          1
        ) /
          LEVELS_PER_WORLD,
      ) +
        1,
    );
  };


/*
 * ============================================================
 * COLORS PER LEVEL
 * ============================================================
 */

const getColorCount =
  (
    level:
      number,
  ) => {

    const safeLevel =
      getDifficultyLevel(
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


const getColors =
  (
    level:
      number,
  ):
    GenZCandyCascadeColor[] => {

    const count =
      getColorCount(
        level,
      );


    const rotation =
      (
        getWorld(
          level,
        ) -
        1
      ) %
      ALL_COLORS.length;


    const rotated = [
      ...ALL_COLORS.slice(
        rotation,
      ),

      ...ALL_COLORS.slice(
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

const getMoves =
  (
    level:
      number,
  ) => {

    const safeLevel =
      getDifficultyLevel(
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
 * BOARD MASKS
 * ============================================================
 */

type MaskPattern =
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
  ): MaskPattern => {

    const safeLevel =
      getDifficultyLevel(
        level,
      );


    if (
      safeLevel <=
      10
    ) {
      return "FULL";
    }


    const patterns:
      MaskPattern[] = [
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
      MaskPattern,

    row:
      number,

    col:
      number,
  ) => {

    const lastRow =
      ROWS -
      1;


    const lastCol =
      COLUMNS -
      1;


    const centerRow =
      Math.floor(
        ROWS /
          2,
      );


    const centerCol =
      Math.floor(
        COLUMNS /
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


const createActiveMask =
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
          ROWS,
      },
      (
        _,
        row,
      ) =>
        Array.from(
          {
            length:
              COLUMNS,
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
 * ACTIVE-CELL HELPERS
 * ============================================================
 */

const getActiveCells =
  (
    mask:
      boolean[][],
  ): GenZCandyCascadePoint[] => {

    const cells:
      GenZCandyCascadePoint[] =
      [];


    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        COLUMNS;

        col +=
          1
      ) {

        if (
          mask[
            row
          ]?.[
            col
          ]
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

interface FeaturePlan {
  score: boolean;

  collect: boolean;

  jelly: boolean;

  blockers: boolean;

  drops: boolean;
}


const getFeaturePlan =
  (
    level:
      number,
  ): FeaturePlan => {

    const safeLevel =
      getDifficultyLevel(
        level,
      );


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
 * JELLY GENERATION
 * ============================================================
 */

const createEmptyNumberMask =
  () =>
    Array.from(
      {
        length:
          ROWS,
      },
      () =>
        Array<number>(
          COLUMNS,
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
      normalizeLevel(
        level,
      );


    const difficultyLevel =
      getDifficultyLevel(
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
 * DROP ITEM CONFIGURATION
 * ============================================================
 */

const getBottomActiveCell =
  (
    mask:
      boolean[][],

    col:
      number,
  ):
    GenZCandyCascadePoint |
    null => {

    for (
      let row =
        ROWS -
        1;

      row >=
      0;

      row -=
        1
    ) {

      if (
        mask[
          row
        ]?.[
          col
        ]
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
  ):
    GenZCandyCascadePoint |
    null => {

    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      if (
        mask[
          row
        ]?.[
          col
        ]
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
            GenZCandyCascadeInitialDropItem[],

        dropExits:
          [] as
            GenZCandyCascadePoint[],
      };
    }


    const safeLevel =
      normalizeLevel(
        level,
      );


    const difficultyLevel =
      getDifficultyLevel(
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
            COLUMNS,
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
      GenZCandyCascadeInitialDropItem[] =
      [];


    const dropExits:
      GenZCandyCascadePoint[] =
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
 * BLOCKER GENERATION
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
  ):
    GenZCandyCascadeInitialBlocker[] => {

    if (
      !enabled
    ) {
      return [];
    }


    const safeLevel =
      normalizeLevel(
        level,
      );


    const difficultyLevel =
      getDifficultyLevel(
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
            difficultyLevel >=
              121 &&
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
                difficultyLevel >=
                  181
                  ? 3
                  : 2,
            };
          }


          if (
            difficultyLevel >=
              71 &&
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
              difficultyLevel >=
                  100 &&
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
      GenZCandyCascadeInitialBlocker[],
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
 * COLOR COLLECTION
 * ============================================================
 */

const getCollectColor =
  (
    level:
      number,

    colors:
      GenZCandyCascadeColor[],
  ) => {

    const index =
      (
        normalizeLevel(
          level,
        ) *
          3 +
        getWorld(
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
      normalizeLevel(
        level,
      );


    const difficultyLevel =
      getDifficultyLevel(
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
 * STAR THRESHOLDS
 * ============================================================
 */

export interface GenZCandyCascadeStarThresholds {
  oneStar: number;

  twoStars: number;

  threeStars: number;
}


export const getGenZCandyCascadeStarThresholds =
  (
    level:
      number,
  ):
    GenZCandyCascadeStarThresholds => {

    const difficultyLevel =
      getDifficultyLevel(
        level,
      );


    const oneStar =
      normalizeLevel(
        level,
      ) <=
        5
        ? 320 +
          normalizeLevel(
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


export const getGenZCandyCascadeStarCount =
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
      getGenZCandyCascadeStarThresholds(
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
 * OBJECTIVE GENERATION
 * ============================================================
 */

const createObjectives =
  (
    level:
      number,

    colors:
      GenZCandyCascadeColor[],

    featurePlan:
      FeaturePlan,

    jellyMask:
      number[][],

    blockers:
      GenZCandyCascadeInitialBlocker[],

    dropItems:
      GenZCandyCascadeInitialDropItem[],
  ):
    GenZCandyCascadeObjective[] => {

    const objectives:
      GenZCandyCascadeObjective[] =
      [];


    if (
      featurePlan.score
    ) {

      objectives.push({
        type:
          "SCORE",

        targetScore:
          getGenZCandyCascadeStarThresholds(
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
 * GENERATE LEVEL CONFIG
 * ============================================================
 *
 * This MUST remain behaviorally identical to:
 *
 * generateCandyCascadeLevel()
 *
 * in the frontend constants file.
 */

export const generateGenZCandyCascadeLevel =
  (
    level:
      number,
  ):
    GenZCandyCascadeLevelConfig => {

    const safeLevel =
      normalizeLevel(
        level,
      );


    const colors =
      getColors(
        safeLevel,
      );


    const activeMask =
      createActiveMask(
        safeLevel,
      );


    const featurePlan =
      getFeaturePlan(
        safeLevel,
      );


    /*
     * Drop items and exits are selected before blockers.
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


    /*
     * Starting drop cells and exits are reserved.
     */
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
        ROWS,

      columns:
        COLUMNS,

      colors,

      moves:
        getMoves(
          safeLevel,
        ),

      objectives,

      activeMask,

      jellyMask,

      blockers,

      dropItems,

      dropExits,

      /*
       * Reserved in the architecture but disabled in
       * the first 200-level release.
       */
      portals:
        [],

      conveyors:
        [],
    };
  };


/*
 * ============================================================
 * OBJECTIVE PROGRESS
 * ============================================================
 */

const createObjectiveProgress =
  (
    config:
      GenZCandyCascadeLevelConfig,
  ):
    GenZCandyCascadeObjectiveProgress[] =>
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
 * CELL RULES
 * ============================================================
 */

const isHardBlocked =
  (
    cell:
      GenZCandyCascadeCell,
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
      GenZCandyCascadeCell,
  ) =>
    cell.active &&
    !isHardBlocked(
      cell,
    );


const hasOccupant =
  (
    cell:
      GenZCandyCascadeCell,
  ) =>
    Boolean(
      cell.piece ||
      cell.dropItem,
    );


const canPlayerSwapCell =
  (
    cell:
      GenZCandyCascadeCell,
  ) =>
    canHoldOccupant(
      cell,
    ) &&
    hasOccupant(
      cell,
    );


/*
 * ============================================================
 * PIECE CREATION
 * ============================================================
 */

const createPiece =
  (
    color:
      GenZCandyCascadeColor,

    special:
      GenZCandyCascadeSpecialType,

    context:
      RandomContext,
  ):
    GenZCandyCascadePiece => {

    const piece:
      GenZCandyCascadePiece = {
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
      GenZCandyCascadeColor[],

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
 * BOARD TEMPLATE
 * ============================================================
 */

const createBoardTemplate =
  (
    config:
      GenZCandyCascadeLevelConfig,

    context:
      RandomContext,
  ):
    GenZCandyCascadeBoard => {

    const blockerMap =
      new Map<
        string,
        {
          type:
            GenZCandyCascadeBlockerType;

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
        GenZCandyCascadeDropItem
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
 * MATCHABLE PIECE
 * ============================================================
 */

const getMatchPiece =
  (
    board:
      GenZCandyCascadeBoard,

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
      GenZCandyCascadeBoard,
  ):
    MatchRun[] => {

    const runs:
      MatchRun[] =
      [];


    /*
     * Horizontal matches.
     */
    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      let col =
        0;


      while (
        col <
        COLUMNS
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
            COLUMNS &&
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
            GenZCandyCascadePoint[] =
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
     * Vertical matches.
     */
    for (
      let col =
        0;

      col <
      COLUMNS;

      col +=
        1
    ) {

      let row =
        0;


      while (
        row <
        ROWS
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
            ROWS &&
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
            GenZCandyCascadePoint[] =
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
 * MERGE OVERLAPPING RUNS
 * ============================================================
 *
 * Example:
 *
 *     X
 *   X X X
 *     X
 *
 * Horizontal + vertical runs of the same color must become
 * one T / L / CROSS group rather than two independent groups.
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
      GenZCandyCascadePoint[],

    orientations:
      Set<
        "ROW" |
        "COLUMN"
      >,
  ):
    GenZCandyCascadeMatchGroup[
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


        const neighbors:
          GenZCandyCascadePoint[] = [
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


const findMatchGroups =
  (
    board:
      GenZCandyCascadeBoard,
  ):
    GenZCandyCascadeMatchGroup[] => {

    const runs =
      findMatchRuns(
        board,
      );


    const visited =
      new Set<number>();


    const groups:
      GenZCandyCascadeMatchGroup[] =
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
          GenZCandyCascadePoint
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
          componentRuns[
            0
          ].color,

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

interface SpecialCreation {
  position:
    GenZCandyCascadePoint;

  special:
    GenZCandyCascadeSpecialType;

  color:
    GenZCandyCascadeColor;
}


const getSpecialTypeForMatch =
  (
    group:
      GenZCandyCascadeMatchGroup,
  ):
    GenZCandyCascadeSpecialType => {

    /*
     * T / L / cross match.
     */
    if (
      group.shape !==
      "LINE"
    ) {
      return "WRAPPED";
    }


    /*
     * Straight five or greater.
     */
    if (
      group.cells.length >=
      5
    ) {
      return "COLOR_BOMB";
    }


    /*
     * Straight four.
     */
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
      GenZCandyCascadeBoard,

    group:
      GenZCandyCascadeMatchGroup,

    preferredPoints:
      GenZCandyCascadePoint[],
  ):
    GenZCandyCascadePoint |
    null => {

    const groupKeys =
      new Set(
        group.cells.map(
          pointKey,
        ),
      );


    /*
     * First preference:
     *
     * one of the pieces that the player actually moved.
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
     * Otherwise prefer a normal piece inside the group.
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


    /*
     * Choose the point closest to the center.
     *
     * Deterministic tie break:
     *
     * row → column
     */
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
      GenZCandyCascadeBoard,

    groups:
      GenZCandyCascadeMatchGroup[],

    preferredPoints:
      GenZCandyCascadePoint[],
  ):
    SpecialCreation[] => {

    const creations:
      SpecialCreation[] =
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


        /*
         * Only one special may be created at a coordinate
         * during the same cascade step.
         */
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
 * SPECIAL COMBINATIONS
 * ============================================================
 */

type SpecialCombination =
  | "NONE"
  | "STRIPED_STRIPED"
  | "STRIPED_WRAPPED"
  | "WRAPPED_WRAPPED"
  | "COLOR_BOMB_NORMAL"
  | "COLOR_BOMB_STRIPED"
  | "COLOR_BOMB_WRAPPED"
  | "COLOR_BOMB_COLOR_BOMB";


const isStriped =
  (
    special:
      GenZCandyCascadeSpecialType,
  ) =>
    special ===
      "STRIPED_ROW" ||
    special ===
      "STRIPED_COLUMN";


const getSpecialCombination =
  (
    first:
      GenZCandyCascadePiece |
      null,

    second:
      GenZCandyCascadePiece |
      null,
  ):
    SpecialCombination => {

    if (
      !first ||
      !second
    ) {
      return "NONE";
    }


    const firstSpecial =
      first.special;


    const secondSpecial =
      second.special;


    if (
      firstSpecial ===
        "COLOR_BOMB" &&
      secondSpecial ===
        "COLOR_BOMB"
    ) {

      return "COLOR_BOMB_COLOR_BOMB";
    }


    if (
      firstSpecial ===
        "COLOR_BOMB" ||
      secondSpecial ===
        "COLOR_BOMB"
    ) {

      const other =
        firstSpecial ===
          "COLOR_BOMB"
          ? secondSpecial
          : firstSpecial;


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
        firstSpecial,
      ) &&
      isStriped(
        secondSpecial,
      )
    ) {

      return "STRIPED_STRIPED";
    }


    if (
      (
        isStriped(
          firstSpecial,
        ) &&
        secondSpecial ===
          "WRAPPED"
      ) ||
      (
        isStriped(
          secondSpecial,
        ) &&
        firstSpecial ===
          "WRAPPED"
      )
    ) {

      return "STRIPED_WRAPPED";
    }


    if (
      firstSpecial ===
        "WRAPPED" &&
      secondSpecial ===
        "WRAPPED"
    ) {

      return "WRAPPED_WRAPPED";
    }


    return "NONE";
  };


/*
 * ============================================================
 * EFFECT TARGET HELPERS
 * ============================================================
 */

const addRow =
  (
    board:
      GenZCandyCascadeBoard,

    affected:
      Set<string>,

    row:
      number,
  ) => {

    if (
      row <
        0 ||
      row >=
        ROWS
    ) {
      return;
    }


    for (
      let col =
        0;

      col <
      COLUMNS;

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
      GenZCandyCascadeBoard,

    affected:
      Set<string>,

    col:
      number,
  ) => {

    if (
      col <
        0 ||
      col >=
        COLUMNS
    ) {
      return;
    }


    for (
      let row =
        0;

      row <
      ROWS;

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
      GenZCandyCascadeBoard,

    affected:
      Set<string>,

    center:
      GenZCandyCascadePoint,

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
 *
 * If a removed special hits another special:
 *
 * striped → row/column
 * wrapped → radius
 * color bomb → matching color
 *
 * Effects chain deterministically.
 */

const expandSpecialEffects =
  (
    board:
      GenZCandyCascadeBoard,

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


      const previousAffected =
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

        /*
         * A naturally triggered color bomb clears pieces
         * matching its stored color.
         */
        for (
          let row =
            0;

          row <
          ROWS;

          row +=
            1
        ) {

          for (
            let col =
              0;

            col <
            COLUMNS;

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


      /*
       * Any newly affected special piece may trigger too.
       */
      Array.from(
        affected,
      ).forEach(
        candidateKey => {

          if (
            !previousAffected.has(
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


    /*
     * Special pieces being created by this same match are
     * protected from removal.
     */
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
 * APPLY REMOVAL
 * ============================================================
 */

const applyRemoval =
  (
    inputBoard:
      GenZCandyCascadeBoard,

    affected:
      Set<string>,
  ):
    RemovalOutcome => {

    const board =
      cloneBoard(
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
          GenZCandyCascadeColor,
          number
        >
      > = {};


    const removedPiecePoints:
      GenZCandyCascadePoint[] =
      [];


    /*
     * ========================================================
     * REMOVE PIECES
     * ========================================================
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
           * Jelly belongs underneath the piece.
           *
           * Removing the piece damages exactly one
           * jelly layer.
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
     * ========================================================
     * BLOCKER DAMAGE
     * ========================================================
     *
     * A blocker loses at most one layer per cascade step.
     *
     * It receives damage when:
     *
     * - directly affected by a special blast
     * - OR adjacent to a removed piece
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
 * PLACE CREATED SPECIALS
 * ============================================================
 */

const placeCreatedSpecials =
  (
    board:
      GenZCandyCascadeBoard,

    creations:
      SpecialCreation[],
  ) => {

    const next =
      cloneBoard(
        board,
      );


    creations.forEach(
      creation => {

        const cell =
          next[
            creation.position.row
          ]?.[
            creation.position.col
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
 * SCORE ONE REMOVAL STEP
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
        SCORE_PER_NORMAL_PIECE +
      outcome.removedSpecialPieces *
        SCORE_PER_SPECIAL_PIECE +
      outcome.destroyedJellyLayers *
        SCORE_PER_JELLY_LAYER +
      outcome.destroyedBlockerLayers *
        SCORE_PER_BLOCKER_LAYER +
      droppedItems *
        SCORE_PER_DROP_ITEM;


    const multiplier =
      Math.min(
        MAX_COMBO_MULTIPLIER,

        Math.max(
          1,
          cascadeIndex,
        ),
      );


    return raw *
      multiplier;
  };

  /*
 * ============================================================
 * GRAVITY
 * ============================================================
 */

type Occupant = {
  piece:
    GenZCandyCascadeCell[
      "piece"
    ];

  dropItem:
    GenZCandyCascadeCell[
      "dropItem"
    ];
};


const applyGravityPass =
  (
    inputBoard:
      GenZCandyCascadeBoard,

    colors:
      GenZCandyCascadeColor[],

    context:
      RandomContext,
  ):
    GenZCandyCascadeBoard => {

    const board =
      cloneBoard(
        inputBoard,
      );


    for (
      let col =
        0;

      col <
      COLUMNS;

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
           * Existing occupants fall downward first.
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

              /*
               * Empty spaces at the top refill with
               * deterministic normal pieces.
               */
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
        ROWS;

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
         * Inactive cells and hard blockers split gravity
         * into independent vertical segments.
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


/*
 * ============================================================
 * DROP-ITEM EXIT
 * ============================================================
 */

const collectDropItems =
  (
    inputBoard:
      GenZCandyCascadeBoard,
  ) => {

    const board =
      cloneBoard(
        inputBoard,
      );


    let droppedItems =
      0;


    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        COLUMNS;

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
      GenZCandyCascadeBoard,

    colors:
      GenZCandyCascadeColor[],

    context:
      RandomContext,
  ):
    GravityOutcome => {

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
     * If an objective item fell through its exit,
     * run gravity once more to fill the new gap.
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
      GenZCandyCascadeObjectiveProgress[],

    score:
      number,

    collectedColors:
      Partial<
        Record<
          GenZCandyCascadeColor,
          number
        >
      >,

    destroyedJellyLayers:
      number,

    destroyedBlockerLayers:
      number,

    droppedItems:
      number,
  ):
    GenZCandyCascadeObjectiveProgress[] =>
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


export const areGenZCandyCascadeObjectivesComplete =
  (
    progress:
      GenZCandyCascadeObjectiveProgress[],
  ) =>
    progress.length >
      0 &&
    progress.every(
      objective =>
        objective.completed,
    );


/*
 * ============================================================
 * INITIAL BOARD MATCH PREVENTION
 * ============================================================
 */

const wouldCreateInitialMatch =
  (
    board:
      GenZCandyCascadeBoard,

    row:
      number,

    col:
      number,

    color:
      GenZCandyCascadeColor,
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


/*
 * ============================================================
 * FILL STABLE INITIAL BOARD
 * ============================================================
 */

const fillStableInitialPieces =
  (
    template:
      GenZCandyCascadeBoard,

    colors:
      GenZCandyCascadeColor[],

    context:
      RandomContext,
  ) => {

    const board =
      cloneBoard(
        template,
      );


    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        COLUMNS;

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
 * SWAP BOARD OCCUPANTS
 * ============================================================
 */

const swapBoardOccupants =
  (
    inputBoard:
      GenZCandyCascadeBoard,

    first:
      GenZCandyCascadePoint,

    second:
      GenZCandyCascadePoint,
  ) => {

    const board =
      cloneBoard(
        inputBoard,
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
 * CHECK WHETHER A SWAP WOULD BE VALID
 * ============================================================
 */

const swapWouldBeValid =
  (
    board:
      GenZCandyCascadeBoard,

    first:
      GenZCandyCascadePoint,

    second:
      GenZCandyCascadePoint,
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


    /*
     * Special + special is always a valid move.
     */
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


    return findMatchGroups(
      swapped,
    ).length >
      0;
  };


/*
 * ============================================================
 * FIND ONE POSSIBLE MOVE
 * ============================================================
 */

const getPossibleMove =
  (
    board:
      GenZCandyCascadeBoard,
  ):
    {
      from:
        GenZCandyCascadePoint;

      to:
        GenZCandyCascadePoint;
    } |
    null => {

    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        COLUMNS;

        col +=
          1
      ) {

        const from = {
          row,
          col,
        };


        /*
         * Check right.
         */
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


        /*
         * Check down.
         */
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


const boardHasPossibleMove =
  (
    board:
      GenZCandyCascadeBoard,
  ) =>
    getPossibleMove(
      board,
    ) !==
    null;


/*
 * ============================================================
 * FORCE-PLAYABLE FALLBACK
 * ============================================================
 *
 * Normally deterministic board generation finds a playable
 * configuration quickly.
 *
 * This fallback guarantees an extreme seed cannot leave the
 * player with an unusable starting board.
 */

const forcePlayableBoard =
  (
    inputBoard:
      GenZCandyCascadeBoard,

    colors:
      GenZCandyCascadeColor[],
  ):
    GenZCandyCascadeBoard => {

    const original =
      cloneBoard(
        inputBoard,
      );


    for (
      let row =
        0;

      row <
        ROWS -
          1;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
          COLUMNS -
            2;

        col +=
          1
      ) {

        const points:
          GenZCandyCascadePoint[] = [
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
                Boolean(
                  cell.dropItem,
                ) ||
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
              cloneBoard(
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


            /*
             * Pattern:
             *
             * A A B
             *     A
             *
             * Swapping B downward creates A A A.
             */
            if (
              findMatchGroups(
                board,
              ).length ===
                0 &&
              boardHasPossibleMove(
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
 * CREATE INITIAL GAME STATE
 * ============================================================
 */

export const createInitialGenZCandyCascadeState =
  (
    level:
      number,

    seed:
      number,
  ):
    GenZCandyCascadeGameState => {

    const config =
      generateGenZCandyCascadeLevel(
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
     * Drop-item IDs are generated once here.
     */
    const template =
      createBoardTemplate(
        config,
        context,
      );


    let board =
      cloneBoard(
        template,
      );


    let playable =
      false;


    for (
      let attempt =
        0;

      attempt <
      MAX_BOARD_BUILD_ATTEMPTS;

      attempt +=
        1
    ) {

      const candidate =
        fillStableInitialPieces(
          template,
          config.colors,
          context,
        );


      /*
       * Initial board must:
       *
       * - contain no automatic matches
       * - contain at least one legal move
       */
      if (
        findMatchGroups(
          candidate,
        ).length ===
          0 &&
        boardHasPossibleMove(
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
 * DETERMINISTIC BOARD SHUFFLE
 * ============================================================
 */

const shuffleBoard =
  (
    inputBoard:
      GenZCandyCascadeBoard,

    config:
      GenZCandyCascadeLevelConfig,

    context:
      RandomContext,
  ):
    GenZCandyCascadeBoard => {

    const base =
      cloneBoard(
        inputBoard,
      );


    const positions:
      GenZCandyCascadePoint[] =
      [];


    const pieces:
      GenZCandyCascadePiece[] =
      [];


    /*
     * Only normal movable piece locations participate.
     *
     * Drop items stay in their own cells.
     */
    for (
      let row =
        0;

      row <
      ROWS;

      row +=
        1
    ) {

      for (
        let col =
          0;

        col <
        COLUMNS;

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
      MAX_SHUFFLES;

      attempt +=
        1
    ) {

      const shuffled =
        pieces.map(
          piece => ({
            ...piece,
          }),
        );


      /*
       * Deterministic Fisher-Yates.
       */
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
        cloneBoard(
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
        findMatchGroups(
          candidate,
        ).length ===
          0 &&
        boardHasPossibleMove(
          candidate,
        )
      ) {

        return candidate;
      }
    }


    /*
     * Rare fallback:
     *
     * Rebuild the movable normal-piece layer from the
     * deterministic PRNG.
     */
    let rebuilt =
      cloneBoard(
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
      boardHasPossibleMove(
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
 * RESOLVE NORMAL CASCADES
 * ============================================================
 */

const resolveCascades =
  (
    inputState:
      GenZCandyCascadeGameState,

    context:
      RandomContext,

    preferredPoints:
      GenZCandyCascadePoint[],

    startingCascadeIndex =
      1,
  ):
    CascadeResolution => {

    const config =
      generateGenZCandyCascadeLevel(
        inputState.levelId,
      );


    let state:
      GenZCandyCascadeGameState = {
      ...inputState,

      board:
        cloneBoard(
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
    };


    let cascadeIndex =
      startingCascadeIndex;


    let firstCycle =
      true;


    for (
      let guard =
        0;

      guard <
      MAX_CASCADE_STEPS_PER_MOVE;

      guard +=
        1
    ) {

      const groups =
        findMatchGroups(
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


      cascadeIndex +=
        1;


      firstCycle =
        false;
    }


    return {
      state,

      context,

      totals,
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
      GenZCandyCascadeGameState,

    context:
      RandomContext,

    first:
      GenZCandyCascadePoint,

    second:
      GenZCandyCascadePoint,

    combination:
      SpecialCombination,
  ):
    CascadeResolution => {

    const config =
      generateGenZCandyCascadeLevel(
        inputState.levelId,
      );


    const board =
      cloneBoard(
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
     * ========================================================
     * COLOR BOMB + COLOR BOMB
     * ========================================================
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
        ROWS;

        row +=
          1
      ) {

        for (
          let col =
            0;

          col <
          COLUMNS;

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


    /*
     * ========================================================
     * COLOR BOMB + OTHER
     * ========================================================
     */

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


      /*
       * Prevent the color bomb itself from running its
       * ordinary stored-color behavior.
       */
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
          ROWS;

          row +=
            1
        ) {

          for (
            let col =
              0;

            col <
            COLUMNS;

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


    /*
     * ========================================================
     * STRIPED + STRIPED
     * ========================================================
     */

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


    /*
     * ========================================================
     * STRIPED + WRAPPED
     * ========================================================
     */

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


    /*
     * ========================================================
     * WRAPPED + WRAPPED
     * ========================================================
     */

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


    /*
     * Trigger specials touched by the combination.
     */
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


    const afterCombination:
      GenZCandyCascadeGameState = {
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


    /*
     * Any matches produced after the combination continue
     * as cascade #2, #3, #4...
     */
    const cascade =
      resolveCascades(
        afterCombination,
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
          cascade
            .totals
            .removedPieces,

        destroyedJellyLayers:
          removed.destroyedJellyLayers +
          cascade
            .totals
            .destroyedJellyLayers,

        destroyedBlockerLayers:
          removed.destroyedBlockerLayers +
          cascade
            .totals
            .destroyedBlockerLayers,

        droppedItems:
          gravity.droppedItems +
          cascade
            .totals
            .droppedItems,

        gainedScore:
          stepScore +
          cascade
            .totals
            .gainedScore,

        cascadeCount:
          1 +
          cascade
            .totals
            .cascadeCount,
      },
    };
  };


/*
 * ============================================================
 * SERVER SWAP RESULT
 * ============================================================
 */

export interface GenZCandyCascadeSwapResult {
  accepted:
    boolean;

  state:
    GenZCandyCascadeGameState;

  moveConsumed:
    boolean;

  specialCombination:
    SpecialCombination;

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

  shuffled:
    boolean;
}


/*
 * ============================================================
 * PLAYER SWAP
 * ============================================================
 */

export const applyGenZCandyCascadeSwap =
  (
    inputState:
      GenZCandyCascadeGameState,

    from:
      GenZCandyCascadePoint,

    to:
      GenZCandyCascadePoint,
  ):
    GenZCandyCascadeSwapResult => {

    const rejected =
      (
        state:
          GenZCandyCascadeGameState,
      ):
        GenZCandyCascadeSwapResult => ({
        accepted:
          false,

        state,

        moveConsumed:
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

        shuffled:
          false,
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

      return rejected(
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

      return rejected(
        inputState,
      );
    }


    /*
     * Important:
     *
     * Detect the combination BEFORE moving the pieces.
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
      findMatchGroups(
        swapped,
      );


    /*
     * Ordinary swap that forms no match:
     *
     * reject it and consume no move.
     */
    if (
      combination ===
        "NONE" &&
      immediateMatches.length ===
        0
    ) {

      return rejected(
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
      GenZCandyCascadeGameState = {
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
      areGenZCandyCascadeObjectivesComplete(
        state.objectiveProgress,
      );


    /*
     * Win takes priority over zero moves.
     */
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
      !boardHasPossibleMove(
        state.board,
      )
    ) {

      const config =
        generateGenZCandyCascadeLevel(
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
      accepted:
        true,

      state,

      moveConsumed:
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

      shuffled,
    };
  };


/*
 * ============================================================
 * +5 MOVE CONTINUE
 * ============================================================
 */

export interface GenZCandyCascadeContinueResult {
  accepted:
    boolean;

  state:
    GenZCandyCascadeGameState;
}


export const applyGenZCandyCascadeContinue =
  (
    inputState:
      GenZCandyCascadeGameState,

    movesGranted =
      GENZ_CANDY_CASCADE_EXTRA_MOVES,
  ):
    GenZCandyCascadeContinueResult => {

    if (
      !inputState.isGameOver ||
      inputState.isLevelCleared ||
      inputState.extraMovesUsed ||
      movesGranted !==
        GENZ_CANDY_CASCADE_EXTRA_MOVES ||
      GENZ_CANDY_CASCADE_MAX_CONTINUES <=
        0
    ) {

      return {
        accepted:
          false,

        state:
          inputState,
      };
    }


    return {
      accepted:
        true,

      state: {
        ...inputState,

        movesRemaining:
          inputState.movesRemaining +
          GENZ_CANDY_CASCADE_EXTRA_MOVES,

        extraMovesUsed:
          true,

        extraMovesGranted:
          inputState.extraMovesGranted +
          GENZ_CANDY_CASCADE_EXTRA_MOVES,

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
  ):
    value is
      GenZCandyCascadePoint => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const point =
      value as
        GenZCandyCascadePoint;


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


export const isGenZCandyCascadeSwapEvent =
  (
    value:
      unknown,
  ):
    value is
      GenZCandyCascadeSwapEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as
        GenZCandyCascadeSwapEvent;


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


export const isGenZCandyCascadeContinueEvent =
  (
    value:
      unknown,
  ):
    value is
      GenZCandyCascadeContinueEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as
        GenZCandyCascadeContinueEvent;


    return (
      event.type ===
        "CONTINUE" &&
      Number.isInteger(
        event.afterMoveIndex,
      ) &&
      event.afterMoveIndex >=
        0 &&
      event.movesGranted ===
        GENZ_CANDY_CASCADE_EXTRA_MOVES
    );
  };


export const isGenZCandyCascadeRunEvent =
  (
    value:
      unknown,
  ):
    value is
      GenZCandyCascadeRunEvent =>
    isGenZCandyCascadeSwapEvent(
      value,
    ) ||
    isGenZCandyCascadeContinueEvent(
      value,
    );


/*
 * ============================================================
 * DETERMINISTIC RUN REPLAY
 * ============================================================
 *
 * This is the core server verification path.
 *
 * The client sends:
 *
 * level
 * seed
 * ordered SWAP / CONTINUE events
 *
 * The backend reconstructs everything else itself.
 */

export const replayGenZCandyCascadeRun =
  (
    level:
      number,

    seed:
      number,

    events:
      GenZCandyCascadeRunEvent[],
  ):
    GenZCandyCascadeReplayResult => {

    let state =
      createInitialGenZCandyCascadeState(
        level,
        seed,
      );


    if (
      events.length >
      GENZ_CANDY_CASCADE_MAX_RUN_EVENTS
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


      /*
       * ======================================================
       * SWAP EVENT
       * ======================================================
       */

      if (
        event.type ===
        "SWAP"
      ) {

        /*
         * Client cannot skip, repeat, or reorder successful
         * move numbers.
         */
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
          applyGenZCandyCascadeSwap(
            state,
            event.from,
            event.to,
          );


        /*
         * Invalid swaps are never valid recorded events.
         *
         * Frontend only records accepted swaps.
         */
        if (
          !resolution.accepted
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
          resolution.state;


        continue;
      }


      /*
       * ======================================================
       * CONTINUE EVENT
       * ======================================================
       */

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
          applyGenZCandyCascadeContinue(
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

export const getGenZCandyCascadeRemainingObjectives =
  (
    state:
      GenZCandyCascadeGameState,
  ) =>
    state.objectiveProgress.filter(
      objective =>
        !objective.completed,
    );


export const canGenZCandyCascadeContinue =
  (
    state:
      GenZCandyCascadeGameState,
  ) =>
    state.isGameOver &&
    !state.isLevelCleared &&
    !state.extraMovesUsed;


export const canGenZCandyCascadePlay =
  (
    state:
      GenZCandyCascadeGameState,
  ) =>
    !state.isGameOver &&
    !state.isLevelCleared &&
    state.movesRemaining >
      0;


/*
 * ============================================================
 * FINAL REPLAY VALIDATION
 * ============================================================
 *
 * Convenience helper for the settlement Cloud Function.
 *
 * A reward-eligible completed run must:
 *
 * - replay successfully
 * - actually complete every objective
 * - finish in level-cleared state
 * - stay within run safety limits
 */

export const isGenZCandyCascadeCompletedReplay =
  (
    replay:
      GenZCandyCascadeReplayResult,
  ) => {

    if (
      !replay.valid
    ) {
      return false;
    }


    const state =
      replay.state;


    return (
      state.isLevelCleared &&
      !state.isGameOver &&
      areGenZCandyCascadeObjectivesComplete(
        state.objectiveProgress,
      ) &&
      state.movesUsed >=
        0 &&
      state.movesUsed <=
        GENZ_CANDY_CASCADE_MAX_MOVES_PER_RUN &&
      (
        !state.extraMovesUsed ||
        state.extraMovesGranted ===
          GENZ_CANDY_CASCADE_EXTRA_MOVES
      )
    );
  };


/*
 * ============================================================
 * DEBUG / FRONTEND-BACKEND SAFETY FINGERPRINT
 * ============================================================
 *
 * We can compare this string with the frontend fingerprint
 * during development.
 *
 * Same level + seed + events must produce the same string.
 */

export const getGenZCandyCascadeStateFingerprint =
  (
    state:
      GenZCandyCascadeGameState,
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
 * PUBLIC ENGINE COLOR LIST
 * ============================================================
 */

export const GENZ_CANDY_CASCADE_ENGINE_COLORS:
  GenZCandyCascadeColor[] = [
  ...ALL_COLORS,
];