/*
 * ============================================================
 * GenZGames - Knife Hit constants
 * ============================================================
 *
 * Reward model:
 * - One rewarded-ad run = 5 levels.
 * - Each verified cleared level = ₹0.01 + 2 diamonds.
 * - Full 5-level run = ₹0.05 + 10 diamonds.
 * - Maximum 2 rewarded revives per run.
 *
 * Gameplay is deterministic. Visual-only effects may still use
 * random values later, but verified gameplay must use the seeded
 * engine.
 */


export const KNIFE_HIT_TICK_RATE =
  60;


export const KNIFE_HIT_TICK_MS =
  1000 /
  KNIFE_HIT_TICK_RATE;


/*
 * One rewarded-ad run always covers five consecutive levels.
 *
 * Examples:
 * 1-5
 * 6-10
 * 11-15
 */
export const KNIFE_HIT_LEVELS_PER_BATCH =
  5;


/*
 * Reward earned per VERIFIED completed level.
 *
 * 1 paise = ₹0.01
 */
export const KNIFE_HIT_REWARD_PAISE_PER_LEVEL =
  1;


export const KNIFE_HIT_DIAMONDS_PER_LEVEL =
  2;


export const KNIFE_HIT_FULL_BATCH_REWARD_PAISE =
  KNIFE_HIT_REWARD_PAISE_PER_LEVEL *
  KNIFE_HIT_LEVELS_PER_BATCH;


export const KNIFE_HIT_FULL_BATCH_DIAMONDS =
  KNIFE_HIT_DIAMONDS_PER_LEVEL *
  KNIFE_HIT_LEVELS_PER_BATCH;


/*
 * Two revive ads maximum for one five-level reward run.
 */
export const KNIFE_HIT_MAX_REVIVES =
  2;


/*
 * Collision tolerance around an already-attached knife.
 *
 * Milli-degrees are used by the deterministic engine.
 *
 * 14 degrees = 14,000 milli-degrees.
 */
export const KNIFE_HIT_COLLISION_MILLI_DEG =
  14_000;


/*
 * The flying knife does not hit the target immediately.
 *
 * 9 ticks at 60 Hz is about 150 ms, close to the old game's
 * 145 ms throw animation.
 */
export const KNIFE_HIT_THROW_TRAVEL_TICKS =
  9;


/*
 * Absolute safety limits used by the frontend/backend engines.
 */
export const KNIFE_HIT_MAX_KNIVES_PER_LEVEL =
  15;


export const KNIFE_HIT_MAX_EXISTING_KNIVES =
  7;


export const KNIFE_HIT_MAX_APPLES =
  4;


export const KNIFE_HIT_MAX_TICKS_PER_LEVEL =
  60 * 180;


/*
 * Knife progression inside each five-level batch.
 *
 * Batch 1:
 * Levels 1-5 -> 3, 4, 4, 5, 5
 *
 * Batch 2:
 * Levels 6-10 -> 4, 5, 5, 6, 6
 *
 * Batch 3:
 * Levels 11-15 -> 5, 6, 6, 7, 7
 *
 * ...continues slowly until capped at 15.
 */
export const KNIFE_HIT_BATCH_KNIFE_PATTERN =
  [
    3,
    4,
    4,
    5,
    5,
  ] as const;


/*
 * Pre-attached knives increase more slowly than throw count.
 *
 * This lets early levels feel easy while higher batches still
 * become meaningfully harder without reaching 15 throws too fast.
 */
export const KNIFE_HIT_EXISTING_KNIFE_PATTERN =
  [
    0,
    1,
    1,
    2,
    2,
  ] as const;


/*
 * Apple progression within a batch.
 *
 * Apples are optional score targets and do not change the cash
 * or diamond reward amount.
 */
export const KNIFE_HIT_APPLE_PATTERN =
  [
    1,
    1,
    2,
    2,
    2,
  ] as const;


/*
 * Base rotation speed in milli-degrees per deterministic tick.
 *
 * 1200 milli-degrees/tick at 60 Hz ~= 72 degrees/second,
 * matching the feel of the old game.
 */
export const KNIFE_HIT_BASE_SPEED_MILLI_DEG_PER_TICK =
  1_200;


/*
 * Each five-level batch becomes slightly faster.
 */
export const KNIFE_HIT_SPEED_GAIN_PER_BATCH =
  90;


/*
 * Small within-batch speed progression.
 */
export const KNIFE_HIT_SPEED_GAIN_PER_LEVEL =
  35;


/*
 * Deterministic speed/direction changes.
 *
 * The seeded engine will choose an interval inside this range.
 */
export const KNIFE_HIT_SPEED_CHANGE_MIN_TICKS =
  84;


export const KNIFE_HIT_SPEED_CHANGE_MAX_TICKS =
  162;


/*
 * Limit wheel speed so very high levels remain playable.
 *
 * ~190 degrees/second at 60 Hz.
 */
export const KNIFE_HIT_MAX_SPEED_MILLI_DEG_PER_TICK =
  3_167;


/*
 * Spacing used when deterministically placing starting knives
 * and apples around the wheel.
 */
export const KNIFE_HIT_START_KNIFE_SPACING_MILLI_DEG =
  28_000;


export const KNIFE_HIT_APPLE_KNIFE_SPACING_MILLI_DEG =
  24_000;


export const KNIFE_HIT_APPLE_APPLE_SPACING_MILLI_DEG =
  26_000;


/*
 * UI / local progress helpers.
 */
export const KNIFE_HIT_FIRST_BATCH_START_LEVEL =
  1;


export const getKnifeHitBatchStartLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    return (
      Math.floor(
        (
          safeLevel -
          1
        ) /
          KNIFE_HIT_LEVELS_PER_BATCH,
      ) *
        KNIFE_HIT_LEVELS_PER_BATCH
    ) +
      1;
  };


export const getKnifeHitBatchEndLevel =
  (
    batchStartLevel:
      number,
  ) =>
    getKnifeHitBatchStartLevel(
      batchStartLevel,
    ) +
    KNIFE_HIT_LEVELS_PER_BATCH -
    1;


/*
 * Number of knives the player must throw for a given level.
 *
 * Examples:
 * 1 -> 3
 * 2 -> 4
 * 3 -> 4
 * 4 -> 5
 * 5 -> 5
 * 6 -> 4
 * 10 -> 6
 */
export const getKnifeHitKnivesForLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    const zeroBased =
      safeLevel -
      1;


    const batchIndex =
      Math.floor(
        zeroBased /
          KNIFE_HIT_LEVELS_PER_BATCH,
      );


    const levelIndex =
      zeroBased %
      KNIFE_HIT_LEVELS_PER_BATCH;


    return Math.min(
      KNIFE_HIT_MAX_KNIVES_PER_LEVEL,

      KNIFE_HIT_BATCH_KNIFE_PATTERN[
        levelIndex
      ] +
        batchIndex,
    );
  };


export const getKnifeHitExistingKnivesForLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    const zeroBased =
      safeLevel -
      1;


    const batchIndex =
      Math.floor(
        zeroBased /
          KNIFE_HIT_LEVELS_PER_BATCH,
      );


    const levelIndex =
      zeroBased %
      KNIFE_HIT_LEVELS_PER_BATCH;


    return Math.min(
      KNIFE_HIT_MAX_EXISTING_KNIVES,

      KNIFE_HIT_EXISTING_KNIFE_PATTERN[
        levelIndex
      ] +
        Math.floor(
          batchIndex /
            2,
        ),
    );
  };


export const getKnifeHitApplesForLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    const zeroBased =
      safeLevel -
      1;


    const batchIndex =
      Math.floor(
        zeroBased /
          KNIFE_HIT_LEVELS_PER_BATCH,
      );


    const levelIndex =
      zeroBased %
      KNIFE_HIT_LEVELS_PER_BATCH;


    return Math.min(
      KNIFE_HIT_MAX_APPLES,

      KNIFE_HIT_APPLE_PATTERN[
        levelIndex
      ] +
        Math.floor(
          batchIndex /
            3,
        ),
    );
  };


export const getKnifeHitBaseSpeedForLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    const zeroBased =
      safeLevel -
      1;


    const batchIndex =
      Math.floor(
        zeroBased /
          KNIFE_HIT_LEVELS_PER_BATCH,
      );


    const levelIndex =
      zeroBased %
      KNIFE_HIT_LEVELS_PER_BATCH;


    return Math.min(
      KNIFE_HIT_MAX_SPEED_MILLI_DEG_PER_TICK,

      KNIFE_HIT_BASE_SPEED_MILLI_DEG_PER_TICK +
        batchIndex *
          KNIFE_HIT_SPEED_GAIN_PER_BATCH +
        levelIndex *
          KNIFE_HIT_SPEED_GAIN_PER_LEVEL,
    );
  };
