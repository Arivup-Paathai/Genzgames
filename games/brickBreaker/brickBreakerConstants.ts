import type {
  BrickBreakerBrick,
  BrickBreakerLevelConfig,
} from "./brickBreakerTypes";


/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER CONSTANTS
 * =========================================================
 *
 * Core reward loop:
 *
 * Rewarded Ad
 *      ↓
 * Start / Replay Level
 *      ↓
 * Destroy 50% of total brick HP
 *      ↓
 * ₹0.05 + 10 Diamonds
 *      ↓
 * Continue Playing
 *      ↓
 * Destroy 100%
 *      ↓
 * Clear Level / Unlock Next Level
 *
 * Any unlocked level can be replayed.
 *
 * Every new earning run requires another rewarded ad.
 */


/*
 * =========================================================
 * LEVEL / REWARD CONFIGURATION
 * =========================================================
 */

export const BRICK_BREAKER_MAX_LEVEL =
  200;


export const BRICK_BREAKER_REWARD_PERCENT =
  50;


export const BRICK_BREAKER_REWARD_PAISE =
  5;


export const BRICK_BREAKER_DIAMOND_REWARD =
  10;


export const BRICK_BREAKER_STARTING_LIVES =
  3;


/*
 * One optional rewarded-ad revive for the
 * SAME run.
 *
 * Revive never creates another reward.
 */
export const BRICK_BREAKER_MAX_REVIVES =
  1;


/*
 * =========================================================
 * FIXED TICK
 * =========================================================
 *
 * All reward-relevant physics use this fixed
 * deterministic simulation interval.
 *
 * requestAnimationFrame is only responsible for
 * driving the fixed tick loop.
 */

export const BRICK_BREAKER_TICK_MS =
  16;


/*
 * Hard safety ceiling for one active run.
 *
 * 45,000 × 16ms ≈ 12 minutes.
 *
 * This prevents a corrupted/tampered run from
 * growing forever.
 */
export const BRICK_BREAKER_MAX_RUN_TICKS =
  45000;


/*
 * =========================================================
 * FIXED-POINT SCALE
 * =========================================================
 *
 * Old Brick Breaker used a logical:
 *
 * 400 × 700
 *
 * game board.
 *
 * We keep those dimensions but multiply gameplay
 * coordinates by 100.
 *
 * This greatly reduces floating-point differences
 * between frontend and backend verification.
 */

export const BRICK_BREAKER_FIXED_SCALE =
  100;


export const BRICK_BREAKER_GAME_WIDTH =
  400 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_GAME_HEIGHT =
  700 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * =========================================================
 * BALL
 * =========================================================
 */

export const BRICK_BREAKER_BALL_RADIUS =
  8 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * The ball rests this far above the paddle
 * while waiting to launch.
 */
export const BRICK_BREAKER_BALL_PADDLE_GAP =
  4 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * =========================================================
 * PADDLE
 * =========================================================
 */

export const BRICK_BREAKER_PADDLE_HEIGHT =
  14 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_PADDLE_Y =
  636 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_START_PADDLE_WIDTH =
  88 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_MIN_PADDLE_WIDTH =
  60 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * Prevent the paddle from touching the absolute
 * game-board edge.
 */
export const BRICK_BREAKER_PADDLE_EDGE_PADDING =
  8 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * Quantize recorded paddle input.
 *
 * 200 fixed units = 2 visual game units.
 *
 * This prevents tiny finger jitter from producing
 * unnecessarily large verification payloads.
 */
export const BRICK_BREAKER_PADDLE_INPUT_QUANTUM =
  2 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * =========================================================
 * BRICK GRID
 * =========================================================
 */

export const BRICK_BREAKER_COLUMNS =
  7;


export const BRICK_BREAKER_BRICK_WIDTH =
  48 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_BRICK_HEIGHT =
  22 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_BRICK_GAP =
  6 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_BRICK_TOP =
  110 *
  BRICK_BREAKER_FIXED_SCALE;


export const BRICK_BREAKER_BRICK_LEFT =
  Math.floor(
    (
      BRICK_BREAKER_GAME_WIDTH -
      (
        BRICK_BREAKER_COLUMNS *
          BRICK_BREAKER_BRICK_WIDTH +
        (
          BRICK_BREAKER_COLUMNS -
          1
        ) *
          BRICK_BREAKER_BRICK_GAP
      )
    ) /
      2,
  );


/*
 * =========================================================
 * HELPERS
 * =========================================================
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


export const normalizeBrickBreakerLevel =
  (
    level:
      number,
  ) =>
    clamp(
      Math.floor(
        Number.isFinite(
          level,
        )
          ? level
          : 1,
      ),
      1,
      BRICK_BREAKER_MAX_LEVEL,
    );


/*
 * =========================================================
 * LEVEL ROW PROGRESSION
 * =========================================================
 *
 * Level   1 -  40 -> 4 rows
 * Level  41 -  80 -> 5 rows
 * Level  81 - 120 -> 6 rows
 * Level 121 - 160 -> 7 rows
 * Level 161 - 200 -> 8 rows
 */

export const getBrickBreakerRows =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeBrickBreakerLevel(
        level,
      );


    return clamp(
      4 +
        Math.floor(
          (
            safeLevel -
            1
          ) /
            40,
        ),
      4,
      8,
    );
  };


/*
 * =========================================================
 * PADDLE DIFFICULTY
 * =========================================================
 *
 * Paddle gradually shrinks as level rises.
 *
 * It never becomes smaller than 60 visual units.
 */

export const getBrickBreakerPaddleWidth =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeBrickBreakerLevel(
        level,
      );


    const reductionSteps =
      Math.floor(
        (
          safeLevel -
          1
        ) /
          5,
      );


    const reduction =
      reductionSteps *
      (
        0.8 *
        BRICK_BREAKER_FIXED_SCALE
      );


    return Math.round(
      clamp(
        BRICK_BREAKER_START_PADDLE_WIDTH -
          reduction,
        BRICK_BREAKER_MIN_PADDLE_WIDTH,
        BRICK_BREAKER_START_PADDLE_WIDTH,
      ),
    );
  };


/*
 * =========================================================
 * BALL SPEED
 * =========================================================
 *
 * These are FIXED ENGINE UNITS PER TICK.
 *
 * At the beginning:
 *
 * approximately 325 visual units / second.
 *
 * By later levels:
 *
 * approximately 520 visual units / second.
 *
 * This stays close to the feel of the old game
 * while remaining deterministic.
 */

export const getBrickBreakerBallSpeed =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeBrickBreakerLevel(
        level,
      );


    const minimumSpeed =
      520;


    const maximumSpeed =
      840;


    const progression =
      Math.floor(
        (
          (
            safeLevel -
            1
          ) *
          (
            maximumSpeed -
            minimumSpeed
          )
        ) /
          (
            BRICK_BREAKER_MAX_LEVEL -
            1
          ),
      );


    return clamp(
      minimumSpeed +
        progression,
      minimumSpeed,
      maximumSpeed,
    );
  };


/*
 * =========================================================
 * DETERMINISTIC BRICK PATTERNS
 * =========================================================
 *
 * No Math.random().
 *
 * Level determines:
 *
 * - active brick cells
 * - HP
 * - visual hue
 *
 * Frontend and backend therefore generate exactly
 * the same level.
 */

const shouldCreateBrick =
  (
    level:
      number,

    row:
      number,

    column:
      number,

    totalRows:
      number,
  ) => {

    const pattern =
      (
        level -
        1
      ) %
      8;


    /*
     * Pattern 0:
     *
     * Full wall.
     */
    if (
      pattern ===
      0
    ) {
      return true;
    }


    /*
     * Pattern 1:
     *
     * Small alternating gaps.
     */
    if (
      pattern ===
      1
    ) {
      return (
        (
          row +
          column
        ) %
          4 !==
        0
      );
    }


    /*
     * Pattern 2:
     *
     * Center channel.
     */
    if (
      pattern ===
      2
    ) {

      if (
        column ===
          3 &&
        row %
          2 ===
          1
      ) {
        return false;
      }


      return true;
    }


    /*
     * Pattern 3:
     *
     * Double side channels.
     */
    if (
      pattern ===
      3
    ) {

      if (
        row >
          0 &&
        row <
          totalRows -
            1 &&
        (
          column ===
            1 ||
          column ===
            5
        ) &&
        row %
          2 ===
          0
      ) {
        return false;
      }


      return true;
    }


    /*
     * Pattern 4:
     *
     * Cross lattice.
     */
    if (
      pattern ===
      4
    ) {

      return (
        row %
          2 ===
          0 ||
        column %
          2 ===
          0
      );
    }


    /*
     * Pattern 5:
     *
     * Stepped opening.
     */
    if (
      pattern ===
      5
    ) {

      const gapColumn =
        row %
          BRICK_BREAKER_COLUMNS;


      return (
        column !==
        gapColumn
      );
    }


    /*
     * Pattern 6:
     *
     * Inner stagger.
     */
    if (
      pattern ===
      6
    ) {

      if (
        row %
          2 ===
          1 &&
        (
          column ===
            0 ||
          column ===
            BRICK_BREAKER_COLUMNS -
              1
        )
      ) {
        return false;
      }


      return true;
    }


    /*
     * Pattern 7:
     *
     * Crown.
     */
    if (
      row ===
        totalRows -
          1 &&
      (
        column ===
          0 ||
        column ===
          BRICK_BREAKER_COLUMNS -
            1
      )
    ) {
      return false;
    }


    return true;
  };


/*
 * =========================================================
 * BRICK HP
 * =========================================================
 *
 * HP progression is deterministic.
 *
 * Early:
 * mostly 1 HP.
 *
 * Mid game:
 * 1-3 HP.
 *
 * Late game:
 * 3-5 HP.
 */

const getBrickHp =
  (
    level:
      number,

    row:
      number,

    column:
      number,
  ) => {

    const safeLevel =
      normalizeBrickBreakerLevel(
        level,
      );


    /*
     * Base HP tiers.
     */
    let hp =
      1;


    if (
      safeLevel >=
      61
    ) {
      hp +=
        1;
    }


    if (
      safeLevel >=
      121
    ) {
      hp +=
        1;
    }


    if (
      safeLevel >=
      181
    ) {
      hp +=
        1;
    }


    /*
     * Deterministic tougher-brick distribution.
     *
     * This replaces the Math.random() tougher
     * brick logic from the old game.
     */
    const strengthValue =
      (
        safeLevel *
          13 +
        row *
          17 +
        column *
          19
      ) %
      12;


    const bonusThreshold =
      clamp(
        1 +
          Math.floor(
            safeLevel /
              40,
          ),
        1,
        5,
      );


    if (
      safeLevel >=
        15 &&
      strengthValue <
        bonusThreshold
    ) {
      hp +=
        1;
    }


    /*
     * Additional rare late-game reinforcement.
     */
    if (
      safeLevel >=
        120 &&
      (
        safeLevel +
        row *
          3 +
        column *
          5
      ) %
        9 ===
        0
    ) {
      hp +=
        1;
    }


    return clamp(
      hp,
      1,
      5,
    );
  };


/*
 * =========================================================
 * VISUAL HUE
 * =========================================================
 *
 * Purely cosmetic.
 *
 * Reward/backend verification must never depend
 * on hue.
 */

const getBrickHue =
  (
    level:
      number,

    row:
      number,

    column:
      number,
  ) =>
    (
      18 +
      row *
        19 +
      column *
        7 +
      (
        level %
        12
      ) *
        5
    ) %
    360;


/*
 * =========================================================
 * LEVEL GENERATION
 * =========================================================
 */

export interface GeneratedBrickBreakerLevel {
  config:
    BrickBreakerLevelConfig;

  bricks:
    BrickBreakerBrick[];
}


export const generateBrickBreakerLevel =
  (
    level:
      number,
  ): GeneratedBrickBreakerLevel => {

    const safeLevel =
      normalizeBrickBreakerLevel(
        level,
      );


    const rows =
      getBrickBreakerRows(
        safeLevel,
      );


    const bricks:
      BrickBreakerBrick[] =
      [];


    let brickId =
      1;


    let totalBrickHp =
      0;


    for (
      let row =
        0;

      row <
      rows;

      row +=
        1
    ) {

      for (
        let column =
          0;

        column <
        BRICK_BREAKER_COLUMNS;

        column +=
          1
      ) {

        if (
          !shouldCreateBrick(
            safeLevel,
            row,
            column,
            rows,
          )
        ) {
          continue;
        }


        const hp =
          getBrickHp(
            safeLevel,
            row,
            column,
          );


        totalBrickHp +=
          hp;


        bricks.push({
          id:
            brickId,

          row,

          column,

          x:
            BRICK_BREAKER_BRICK_LEFT +
            column *
              (
                BRICK_BREAKER_BRICK_WIDTH +
                BRICK_BREAKER_BRICK_GAP
              ),

          y:
            BRICK_BREAKER_BRICK_TOP +
            row *
              (
                BRICK_BREAKER_BRICK_HEIGHT +
                BRICK_BREAKER_BRICK_GAP
              ),

          width:
            BRICK_BREAKER_BRICK_WIDTH,

          height:
            BRICK_BREAKER_BRICK_HEIGHT,

          hp,

          maxHp:
            hp,

          hue:
            getBrickHue(
              safeLevel,
              row,
              column,
            ),
        });


        brickId +=
          1;
      }
    }


    const rewardBrickHp =
      Math.max(
        1,
        Math.ceil(
          (
            totalBrickHp *
            BRICK_BREAKER_REWARD_PERCENT
          ) /
            100,
        ),
      );


    return {
      config: {
        id:
          safeLevel,

        rows,

        columns:
          BRICK_BREAKER_COLUMNS,

        paddleWidth:
          getBrickBreakerPaddleWidth(
            safeLevel,
          ),

        ballSpeed:
          getBrickBreakerBallSpeed(
            safeLevel,
          ),

        totalBrickHp,

        rewardBrickHp,
      },

      bricks,
    };
  };


/*
 * =========================================================
 * PROGRESS HELPERS
 * =========================================================
 */

export const getBrickBreakerRewardTargetHp =
  (
    level:
      number,
  ) =>
    generateBrickBreakerLevel(
      level,
    )
      .config
      .rewardBrickHp;


export const getBrickBreakerTotalHp =
  (
    level:
      number,
  ) =>
    generateBrickBreakerLevel(
      level,
    )
      .config
      .totalBrickHp;


/*
 * =========================================================
 * LEVEL UNLOCK
 * =========================================================
 */

export const getNextBrickBreakerLevel =
  (
    currentLevel:
      number,
  ) =>
    Math.min(
      BRICK_BREAKER_MAX_LEVEL,
      normalizeBrickBreakerLevel(
        currentLevel,
      ) +
        1,
    );


export const isFinalBrickBreakerLevel =
  (
    level:
      number,
  ) =>
    normalizeBrickBreakerLevel(
      level,
    ) ===
    BRICK_BREAKER_MAX_LEVEL;