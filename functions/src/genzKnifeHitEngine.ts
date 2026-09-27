/*
 * ============================================================
 * GenZGames - Knife Hit backend deterministic replay engine
 * ============================================================
 *
 * IMPORTANT:
 * - Keep gameplay constants/physics in sync with:
 *   src/games/knifeHit/knifeHitConstants.ts
 *   src/games/knifeHit/knifeHitEngine.ts
 *
 * - Never use Math.random() for verified gameplay.
 * - The client sends gameplay evidence only.
 * - Reward amounts are calculated here from verified clears.
 */


/*
 * ============================================================
 * SHARED GAME / REWARD CONSTANTS
 * ============================================================
 */

export const KNIFE_HIT_LEVELS_PER_BATCH =
  5;


export const KNIFE_HIT_REWARD_PAISE_PER_LEVEL =
  1;


export const KNIFE_HIT_DIAMONDS_PER_LEVEL =
  2;


export const KNIFE_HIT_FULL_BATCH_REWARD_PAISE =
  KNIFE_HIT_LEVELS_PER_BATCH *
  KNIFE_HIT_REWARD_PAISE_PER_LEVEL;


export const KNIFE_HIT_FULL_BATCH_DIAMONDS =
  KNIFE_HIT_LEVELS_PER_BATCH *
  KNIFE_HIT_DIAMONDS_PER_LEVEL;


export const KNIFE_HIT_MAX_REVIVES =
  2;


const KNIFE_HIT_COLLISION_MILLI_DEG =
  14_000;


const KNIFE_HIT_THROW_TRAVEL_TICKS =
  9;


const KNIFE_HIT_MAX_KNIVES_PER_LEVEL =
  15;


const KNIFE_HIT_MAX_EXISTING_KNIVES =
  7;


const KNIFE_HIT_MAX_APPLES =
  4;


const KNIFE_HIT_MAX_TICKS_PER_LEVEL =
  60 *
  180;


const KNIFE_HIT_BATCH_KNIFE_PATTERN =
  [
    3,
    4,
    4,
    5,
    5,
  ] as const;


const KNIFE_HIT_EXISTING_KNIFE_PATTERN =
  [
    0,
    1,
    1,
    2,
    2,
  ] as const;


const KNIFE_HIT_APPLE_PATTERN =
  [
    1,
    1,
    2,
    2,
    2,
  ] as const;


const KNIFE_HIT_BASE_SPEED_MILLI_DEG_PER_TICK =
  1_200;


const KNIFE_HIT_SPEED_GAIN_PER_BATCH =
  90;


const KNIFE_HIT_SPEED_GAIN_PER_LEVEL =
  35;


const KNIFE_HIT_SPEED_CHANGE_MIN_TICKS =
  84;


const KNIFE_HIT_SPEED_CHANGE_MAX_TICKS =
  162;


const KNIFE_HIT_MAX_SPEED_MILLI_DEG_PER_TICK =
  3_167;


const KNIFE_HIT_START_KNIFE_SPACING_MILLI_DEG =
  28_000;


const KNIFE_HIT_APPLE_KNIFE_SPACING_MILLI_DEG =
  24_000;


const KNIFE_HIT_APPLE_APPLE_SPACING_MILLI_DEG =
  26_000;


const FULL_CIRCLE_MILLI_DEG =
  360_000;


const HALF_CIRCLE_MILLI_DEG =
  180_000;


const APPLE_HIT_MILLI_DEG =
  12_000;


const MIN_SPEED_MILLI_DEG_PER_TICK =
  850;


const MAX_REPLAY_ATTEMPTS =
  16;


const MAX_THROW_EVENTS_PER_ATTEMPT =
  64;


/*
 * ============================================================
 * BACKEND TYPES
 * ============================================================
 */

export interface KnifeHitReplayThrowEvent {
  tick:
    number;
}


export interface KnifeHitReplayAttemptInput {
  level:
    number;

  attemptNumber:
    number;

  throwEvents:
    KnifeHitReplayThrowEvent[];
}


export type KnifeHitReplayEndReason =
  | "BATCH_COMPLETE"
  | "OUT_OF_REVIVES"
  | "USER_END";


export interface KnifeHitReplayRunInput {
  seed:
    number;

  batchStartLevel:
    number;

  attempts:
    KnifeHitReplayAttemptInput[];

  endReason:
    KnifeHitReplayEndReason;
}


interface BackendAttachedKnife {
  relAngleMilliDeg:
    number;
}


interface BackendApple {
  relAngleMilliDeg:
    number;

  collected:
    boolean;
}


interface BackendPendingThrow {
  launchedAtTick:
    number;

  impactTick:
    number;
}


interface BackendKnifeHitLevelState {
  level:
    number;

  tick:
    number;

  wheelAngleMilliDeg:
    number;

  wheelSpeedMilliDegPerTick:
    number;

  knivesLeft:
    number;

  attachedKnives:
    BackendAttachedKnife[];

  apples:
    BackendApple[];

  pendingThrow:
    BackendPendingThrow |
    null;

  levelScore:
    number;

  isLevelComplete:
    boolean;

  isGameOver:
    boolean;
}


interface BackendKnifeHitTickResult {
  state:
    BackendKnifeHitLevelState;

  knifeStuck:
    boolean;

  appleCollected:
    boolean;

  collision:
    boolean;

  levelCleared:
    boolean;
}


export interface KnifeHitReplayAttemptResult {
  level:
    number;

  attemptNumber:
    number;

  outcome:
    "CLEARED" |
    "FAILED";

  endTick:
    number;

  levelScore:
    number;

  applesCollected:
    number;
}


export interface KnifeHitReplayRunResult {
  valid:
    true;

  batchStartLevel:
    number;

  batchEndLevel:
    number;

  completedLevels:
    number[];

  completedLevelCount:
    number;

  revivesUsed:
    number;

  verifiedScore:
    number;

  rewardPaise:
    number;

  diamondsGranted:
    number;

  attempts:
    KnifeHitReplayAttemptResult[];

  endReason:
    KnifeHitReplayEndReason;

  nextBatchStartLevel:
    number |
    null;
}


/*
 * ============================================================
 * VALIDATION HELPERS
 * ============================================================
 */

const assertReplay:
  (
    condition:
      boolean,

    message:
      string,
  ) => asserts condition =
  (
    condition:
      boolean,

    message:
      string,
  ) => {

    if (
      !condition
    ) {
      throw new Error(
        `Invalid Knife Hit replay: ${message}`,
      );
    }
  };


const isInteger =
  (
    value:
      unknown,
  ): value is number =>
    typeof value ===
      "number" &&
    Number.isInteger(
      value,
    );


const assertUInt32 =
  (
    value:
      unknown,

    field:
      string,
  ) => {

    assertReplay(
      isInteger(
        value,
      ) &&
        value >=
          0 &&
        value <=
          0xffff_ffff,

      `${field} must be uint32`,
    );
  };


const getBatchStartLevel =
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


const getBatchEndLevel =
  (
    batchStartLevel:
      number,
  ) =>
    getBatchStartLevel(
      batchStartLevel,
    ) +
    KNIFE_HIT_LEVELS_PER_BATCH -
    1;


/*
 * ============================================================
 * LEVEL DIFFICULTY HELPERS
 * ============================================================
 */

const getKnivesForLevel =
  (
    level:
      number,
  ) => {

    const zeroBased =
      Math.max(
        0,
        Math.floor(
          level,
        ) -
          1,
      );


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


const getExistingKnivesForLevel =
  (
    level:
      number,
  ) => {

    const zeroBased =
      Math.max(
        0,
        Math.floor(
          level,
        ) -
          1,
      );


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


const getApplesForLevel =
  (
    level:
      number,
  ) => {

    const zeroBased =
      Math.max(
        0,
        Math.floor(
          level,
        ) -
          1,
      );


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


const getBaseSpeedForLevel =
  (
    level:
      number,
  ) => {

    const zeroBased =
      Math.max(
        0,
        Math.floor(
          level,
        ) -
          1,
      );


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


/*
 * ============================================================
 * ANGLE HELPERS
 * ============================================================
 */

const normalizeAngle =
  (
    angleMilliDeg:
      number,
  ) => {

    const normalized =
      Math.trunc(
        angleMilliDeg,
      ) %
      FULL_CIRCLE_MILLI_DEG;


    return normalized <
      0
      ? normalized +
          FULL_CIRCLE_MILLI_DEG
      : normalized;
  };


const angleDifference =
  (
    firstMilliDeg:
      number,

    secondMilliDeg:
      number,
  ) => {

    const direct =
      Math.abs(
        normalizeAngle(
          firstMilliDeg,
        ) -
          normalizeAngle(
            secondMilliDeg,
          ),
      );


    return direct >
      HALF_CIRCLE_MILLI_DEG
      ? FULL_CIRCLE_MILLI_DEG -
          direct
      : direct;
  };


/*
 * ============================================================
 * SEEDED RANDOM HELPERS
 * ============================================================
 */

const mixSeed =
  (
    seed:
      number,

    level:
      number,

    salt:
      number,
  ) => {

    let value =
      (
        Math.trunc(
          seed,
        ) ^
        Math.imul(
          Math.trunc(
            level,
          ),
          0x45d9f3b,
        ) ^
        Math.imul(
          Math.trunc(
            salt,
          ),
          0x27d4eb2d,
        )
      ) >>>
      0;


    value =
      Math.imul(
        value ^
          (
            value >>>
            16
          ),
        0x7feb352d,
      ) >>>
      0;


    value =
      Math.imul(
        value ^
          (
            value >>>
            15
          ),
        0x846ca68b,
      ) >>>
      0;


    return (
      value ^
      (
        value >>>
        16
      )
    ) >>>
      0;
  };


const createSeededRandom =
  (
    seed:
      number,

    level:
      number,

    salt:
      number,
  ) => {

    let state =
      mixSeed(
        seed,
        level,
        salt,
      );


    return () => {

      state =
        (
          state +
          0x6d2b79f5
        ) >>>
        0;


      let value =
        state;


      value =
        Math.imul(
          value ^
            (
              value >>>
              15
            ),
          value |
            1,
        );


      value ^=
        value +
        Math.imul(
          value ^
            (
              value >>>
              7
            ),
          value |
            61,
        );


      return (
        (
          value ^
          (
            value >>>
            14
          )
        ) >>>
        0
      ) /
        4_294_967_296;
    };
  };


const randomInt =
  (
    random:
      () => number,

    min:
      number,

    max:
      number,
  ) => {

    const safeMin =
      Math.ceil(
        min,
      );

    const safeMax =
      Math.floor(
        max,
      );


    if (
      safeMax <=
      safeMin
    ) {
      return safeMin;
    }


    return safeMin +
      Math.floor(
        random() *
          (
            safeMax -
            safeMin +
            1
          ),
      );
  };


/*
 * ============================================================
 * SEEDED STARTING LAYOUT
 * ============================================================
 */

const isFarEnoughFromKnives =
  (
    angle:
      number,

    knives:
      BackendAttachedKnife[],

    spacing:
      number,
  ) =>
    knives.every(
      knife =>
        angleDifference(
          knife.relAngleMilliDeg,
          angle,
        ) >=
        spacing,
    );


const isFarEnoughFromApples =
  (
    angle:
      number,

    apples:
      BackendApple[],

    spacing:
      number,
  ) =>
    apples.every(
      apple =>
        angleDifference(
          apple.relAngleMilliDeg,
          angle,
        ) >=
        spacing,
    );


const findKnifePlacement =
  (
    random:
      () => number,

    existing:
      BackendAttachedKnife[],
  ) => {

    for (
      let attempt =
        0;
      attempt <
        360;
      attempt +=
        1
    ) {

      const angle =
        randomInt(
          random,
          0,
          FULL_CIRCLE_MILLI_DEG -
            1,
        );


      if (
        isFarEnoughFromKnives(
          angle,
          existing,
          KNIFE_HIT_START_KNIFE_SPACING_MILLI_DEG,
        )
      ) {
        return angle;
      }
    }


    const offset =
      randomInt(
        random,
        0,
        359,
      ) *
      1_000;


    for (
      let step =
        0;
      step <
        360;
      step +=
        1
    ) {

      const angle =
        normalizeAngle(
          offset +
            step *
              1_000,
        );


      if (
        isFarEnoughFromKnives(
          angle,
          existing,
          KNIFE_HIT_START_KNIFE_SPACING_MILLI_DEG,
        )
      ) {
        return angle;
      }
    }


    return normalizeAngle(
      offset,
    );
  };


const findApplePlacement =
  (
    random:
      () => number,

    knives:
      BackendAttachedKnife[],

    apples:
      BackendApple[],
  ) => {

    for (
      let attempt =
        0;
      attempt <
        360;
      attempt +=
        1
    ) {

      const angle =
        randomInt(
          random,
          0,
          FULL_CIRCLE_MILLI_DEG -
            1,
        );


      if (
        isFarEnoughFromKnives(
          angle,
          knives,
          KNIFE_HIT_APPLE_KNIFE_SPACING_MILLI_DEG,
        ) &&
        isFarEnoughFromApples(
          angle,
          apples,
          KNIFE_HIT_APPLE_APPLE_SPACING_MILLI_DEG,
        )
      ) {
        return angle;
      }
    }


    const offset =
      randomInt(
        random,
        0,
        359,
      ) *
      1_000;


    for (
      let step =
        0;
      step <
        360;
      step +=
        1
    ) {

      const angle =
        normalizeAngle(
          offset +
            step *
              1_000,
        );


      if (
        isFarEnoughFromKnives(
          angle,
          knives,
          KNIFE_HIT_APPLE_KNIFE_SPACING_MILLI_DEG,
        ) &&
        isFarEnoughFromApples(
          angle,
          apples,
          KNIFE_HIT_APPLE_APPLE_SPACING_MILLI_DEG,
        )
      ) {
        return angle;
      }
    }


    return normalizeAngle(
      offset,
    );
  };


/*
 * ============================================================
 * SEEDED WHEEL SPEED
 * ============================================================
 */

const getSpeedForTick =
  (
    seed:
      number,

    level:
      number,

    tick:
      number,
  ) => {

    const baseMagnitude =
      getBaseSpeedForLevel(
        level,
      );


    const initialRandom =
      createSeededRandom(
        seed,
        level,
        20_001,
      );


    let sign =
      initialRandom() <
        0.5
        ? -1
        : 1;


    let magnitude =
      baseMagnitude;


    let segmentStartTick =
      0;


    let segmentIndex =
      0;


    while (
      segmentIndex <
        512
    ) {

      const segmentRandom =
        createSeededRandom(
          seed,
          level,
          30_000 +
            segmentIndex,
        );


      const segmentLength =
        randomInt(
          segmentRandom,
          KNIFE_HIT_SPEED_CHANGE_MIN_TICKS,
          KNIFE_HIT_SPEED_CHANGE_MAX_TICKS,
        );


      const segmentEndTick =
        segmentStartTick +
        segmentLength;


      if (
        tick <
        segmentEndTick
      ) {
        break;
      }


      segmentStartTick =
        segmentEndTick;


      const magnitudeOffset =
        randomInt(
          segmentRandom,
          -260,
          360,
        );


      magnitude =
        Math.max(
          MIN_SPEED_MILLI_DEG_PER_TICK,

          Math.min(
            KNIFE_HIT_MAX_SPEED_MILLI_DEG_PER_TICK,

            baseMagnitude +
              magnitudeOffset,
          ),
        );


      const flipChancePerThousand =
        Math.min(
          520,

          170 +
            Math.floor(
              level /
                5,
            ) *
              25,
        );


      if (
        randomInt(
          segmentRandom,
          0,
          999,
        ) <
        flipChancePerThousand
      ) {
        sign *=
          -1;
      }


      segmentIndex +=
        1;
    }


    return magnitude *
      sign;
  };


/*
 * ============================================================
 * LEVEL ENGINE
 * ============================================================
 */

const createInitialLevelState =
  (
    seed:
      number,

    level:
      number,
  ): BackendKnifeHitLevelState => {

    const layoutRandom =
      createSeededRandom(
        seed,
        level,
        10_001,
      );


    const existingKnives:
      BackendAttachedKnife[] =
      [];


    const existingKnifeCount =
      getExistingKnivesForLevel(
        level,
      );


    for (
      let index =
        0;
      index <
        existingKnifeCount;
      index +=
        1
    ) {

      existingKnives.push({
        relAngleMilliDeg:
          findKnifePlacement(
            layoutRandom,
            existingKnives,
          ),
      });
    }


    const apples:
      BackendApple[] =
      [];


    const appleCount =
      getApplesForLevel(
        level,
      );


    for (
      let index =
        0;
      index <
        appleCount;
      index +=
        1
    ) {

      apples.push({
        relAngleMilliDeg:
          findApplePlacement(
            layoutRandom,
            existingKnives,
            apples,
          ),

        collected:
          false,
      });
    }


    return {
      level,

      tick:
        0,

      wheelAngleMilliDeg:
        0,

      wheelSpeedMilliDegPerTick:
        getSpeedForTick(
          seed,
          level,
          0,
        ),

      knivesLeft:
        getKnivesForLevel(
          level,
        ),

      attachedKnives:
        existingKnives,

      apples,

      pendingThrow:
        null,

      levelScore:
        0,

      isLevelComplete:
        false,

      isGameOver:
        false,
    };
  };


const applyThrow =
  (
    state:
      BackendKnifeHitLevelState,
  ): BackendKnifeHitLevelState => {

    assertReplay(
      !state.isGameOver,
      "throw after game over",
    );

    assertReplay(
      !state.isLevelComplete,
      "throw after level clear",
    );

    assertReplay(
      state.pendingThrow ===
        null,
      "throw while another knife is travelling",
    );

    assertReplay(
      state.knivesLeft >
        0,
      "throw with no knives remaining",
    );


    return {
      ...state,

      pendingThrow: {
        launchedAtTick:
          state.tick,

        impactTick:
          state.tick +
          KNIFE_HIT_THROW_TRAVEL_TICKS,
      },
    };
  };


const advanceTick =
  (
    state:
      BackendKnifeHitLevelState,

    seed:
      number,
  ): BackendKnifeHitTickResult => {

    if (
      state.isGameOver ||
      state.isLevelComplete
    ) {
      return {
        state,

        knifeStuck:
          false,

        appleCollected:
          false,

        collision:
          false,

        levelCleared:
          state.isLevelComplete,
      };
    }


    assertReplay(
      state.tick <
        KNIFE_HIT_MAX_TICKS_PER_LEVEL,
      "level exceeded maximum tick count",
    );


    const nextTick =
      state.tick +
      1;


    const speed =
      getSpeedForTick(
        seed,
        state.level,
        nextTick,
      );


    const nextAngle =
      normalizeAngle(
        state.wheelAngleMilliDeg +
          speed,
      );


    let nextState:
      BackendKnifeHitLevelState = {
        ...state,

        tick:
          nextTick,

        wheelAngleMilliDeg:
          nextAngle,

        wheelSpeedMilliDegPerTick:
          speed,
      };


    const pendingThrow =
      nextState.pendingThrow;


    if (
      !pendingThrow ||
      nextTick <
        pendingThrow.impactTick
    ) {

      return {
        state:
          nextState,

        knifeStuck:
          false,

        appleCollected:
          false,

        collision:
          false,

        levelCleared:
          false,
      };
    }


    const impactRelAngle =
      normalizeAngle(
        HALF_CIRCLE_MILLI_DEG -
          nextAngle,
      );


    const collision =
      nextState
        .attachedKnives
        .some(
          knife =>
            angleDifference(
              knife.relAngleMilliDeg,
              impactRelAngle,
            ) <
            KNIFE_HIT_COLLISION_MILLI_DEG,
        );


    if (
      collision
    ) {

      nextState = {
        ...nextState,

        pendingThrow:
          null,

        isGameOver:
          true,
      };


      return {
        state:
          nextState,

        knifeStuck:
          false,

        appleCollected:
          false,

        collision:
          true,

        levelCleared:
          false,
      };
    }


    let appleCollected =
      false;


    const nextApples =
      nextState.apples.map(
        apple => {

          if (
            apple.collected
          ) {
            return apple;
          }


          if (
            angleDifference(
              apple.relAngleMilliDeg,
              impactRelAngle,
            ) <
            APPLE_HIT_MILLI_DEG
          ) {

            appleCollected =
              true;


            return {
              ...apple,

              collected:
                true,
            };
          }


          return apple;
        },
      );


    const nextKnivesLeft =
      Math.max(
        0,
        nextState.knivesLeft -
          1,
      );


    const levelCleared =
      nextKnivesLeft ===
      0;


    nextState = {
      ...nextState,

      knivesLeft:
        nextKnivesLeft,

      attachedKnives: [
        ...nextState.attachedKnives,

        {
          relAngleMilliDeg:
            impactRelAngle,
        },
      ],

      apples:
        nextApples,

      pendingThrow:
        null,

      levelScore:
        nextState.levelScore +
        10 +
        (
          appleCollected
            ? 20
            : 0
        ),

      isLevelComplete:
        levelCleared,
    };


    return {
      state:
        nextState,

      knifeStuck:
        true,

      appleCollected,

      collision:
        false,

      levelCleared,
    };
  };


/*
 * ============================================================
 * ATTEMPT REPLAY
 * ============================================================
 */

const replayAttempt =
  (
    seed:
      number,

    attempt:
      KnifeHitReplayAttemptInput,
  ): KnifeHitReplayAttemptResult => {

    assertReplay(
      isInteger(
        attempt.level,
      ) &&
        attempt.level >
          0,
      "attempt level must be positive integer",
    );

    assertReplay(
      isInteger(
        attempt.attemptNumber,
      ) &&
        attempt.attemptNumber >
          0,
      "attemptNumber must be positive integer",
    );

    assertReplay(
      Array.isArray(
        attempt.throwEvents,
      ) &&
        attempt.throwEvents.length >
          0 &&
        attempt.throwEvents.length <=
          MAX_THROW_EVENTS_PER_ATTEMPT,
      "invalid throw event count",
    );


    let state =
      createInitialLevelState(
        seed,
        attempt.level,
      );


    let previousEventTick =
      -1;


    for (
      const event of
        attempt.throwEvents
    ) {

      assertReplay(
        isInteger(
          event.tick,
        ) &&
          event.tick >=
            0,
        "throw tick must be non-negative integer",
      );

      assertReplay(
        event.tick >
          previousEventTick,
        "throw ticks must be strictly increasing",
      );

      assertReplay(
        event.tick <=
          KNIFE_HIT_MAX_TICKS_PER_LEVEL,
        "throw tick exceeds level limit",
      );


      /*
       * Advance the deterministic wheel until the exact tick
       * at which the client says the player tapped.
       */
      while (
        state.tick <
          event.tick
      ) {

        state =
          advanceTick(
            state,
            seed,
          ).state;


        assertReplay(
          !state.isGameOver &&
            !state.isLevelComplete,
          "attempt already ended before a supplied throw",
        );
      }


      assertReplay(
        state.tick ===
          event.tick,
        "unable to reach supplied throw tick",
      );


      state =
        applyThrow(
          state,
        );


      previousEventTick =
        event.tick;
    }


    /*
     * The last supplied throw still needs to travel to the wheel.
     * Advance until that knife resolves.
     */
    while (
      state.pendingThrow !==
        null &&
      !state.isGameOver &&
      !state.isLevelComplete
    ) {

      state =
        advanceTick(
          state,
          seed,
        ).state;
    }


    assertReplay(
      state.isGameOver ||
        state.isLevelComplete,
      "attempt does not end in clear or collision",
    );


    const applesCollected =
      state.apples.filter(
        apple =>
          apple.collected,
      ).length;


    return {
      level:
        attempt.level,

      attemptNumber:
        attempt.attemptNumber,

      outcome:
        state.isLevelComplete
          ? "CLEARED"
          : "FAILED",

      endTick:
        state.tick,

      levelScore:
        state.levelScore,

      applesCollected,
    };
  };


/*
 * ============================================================
 * FULL FIVE-LEVEL RUN REPLAY
 * ============================================================
 */

export const replayKnifeHitRun =
  (
    input:
      KnifeHitReplayRunInput,
  ): KnifeHitReplayRunResult => {

    assertUInt32(
      input.seed,
      "seed",
    );


    assertReplay(
      isInteger(
        input.batchStartLevel,
      ) &&
        input.batchStartLevel >
          0,
      "batchStartLevel must be positive integer",
    );


    assertReplay(
      getBatchStartLevel(
        input.batchStartLevel,
      ) ===
        input.batchStartLevel,
      "batchStartLevel must begin a five-level batch",
    );


    assertReplay(
      Array.isArray(
        input.attempts,
      ) &&
        input.attempts.length >
          0 &&
        input.attempts.length <=
          MAX_REPLAY_ATTEMPTS,
      "invalid attempt count",
    );


    assertReplay(
      input.endReason ===
        "BATCH_COMPLETE" ||
        input.endReason ===
          "OUT_OF_REVIVES" ||
        input.endReason ===
          "USER_END",
      "invalid endReason",
    );


    const batchEndLevel =
      getBatchEndLevel(
        input.batchStartLevel,
      );


    const completedLevels:
      number[] =
      [];


    const attemptResults:
      KnifeHitReplayAttemptResult[] =
      [];


    let expectedLevel =
      input.batchStartLevel;


    let expectedAttemptNumber =
      1;


    let revivesUsed =
      0;


    let verifiedScore =
      0;


    for (
      let index =
        0;
      index <
        input.attempts.length;
      index +=
        1
    ) {

      const attempt =
        input.attempts[
          index
        ];


      assertReplay(
        attempt.level ===
          expectedLevel,
        "attempt level does not match progression",
      );


      assertReplay(
        attempt.level >=
          input.batchStartLevel &&
          attempt.level <=
            batchEndLevel,
        "attempt level outside selected batch",
      );


      assertReplay(
        attempt.attemptNumber ===
          expectedAttemptNumber,
        "attemptNumber does not match retry progression",
      );


      const result =
        replayAttempt(
          input.seed,
          attempt,
        );


      attemptResults.push(
        result,
      );


      const isLastAttempt =
        index ===
        input.attempts.length -
          1;


      if (
        result.outcome ===
        "CLEARED"
      ) {

        assertReplay(
          !completedLevels.includes(
            result.level,
          ),
          "same level cleared more than once in one run",
        );


        completedLevels.push(
          result.level,
        );


        /*
         * Only completed-level gameplay contributes to the
         * backend-verified score. Failed/revived attempts cannot
         * be farmed for score.
         */
        verifiedScore +=
          result.levelScore;


        if (
          result.level ===
          batchEndLevel
        ) {

          assertReplay(
            isLastAttempt,
            "attempts supplied after batch completion",
          );


          expectedLevel =
            result.level;

          expectedAttemptNumber =
            attempt.attemptNumber;


          continue;
        }


        expectedLevel =
          result.level +
          1;

        expectedAttemptNumber =
          1;


        continue;
      }


      /*
       * FAILED
       */

      if (
        isLastAttempt
      ) {

        /*
         * A final failed attempt consumes no NEW revive because
         * the player did not resume after it.
         */
        continue;
      }


      const nextAttempt =
        input.attempts[
          index +
            1
        ];


      assertReplay(
        revivesUsed <
          KNIFE_HIT_MAX_REVIVES,
        "more than two revives used",
      );


      assertReplay(
        nextAttempt.level ===
          result.level,
        "revive must restart the same failed level",
      );


      assertReplay(
        nextAttempt.attemptNumber ===
          attempt.attemptNumber +
            1,
        "revive attemptNumber must increment by one",
      );


      revivesUsed +=
        1;


      expectedLevel =
        result.level;

      expectedAttemptNumber =
        attempt.attemptNumber +
        1;
    }


    const finalResult =
      attemptResults[
        attemptResults.length -
          1
      ];


    assertReplay(
      Boolean(
        finalResult,
      ),
      "missing final attempt",
    );


    if (
      input.endReason ===
      "BATCH_COMPLETE"
    ) {

      assertReplay(
        completedLevels.length ===
          KNIFE_HIT_LEVELS_PER_BATCH,
        "batch complete requires five cleared levels",
      );

      assertReplay(
        completedLevels[0] ===
          input.batchStartLevel &&
          completedLevels[
            completedLevels.length -
              1
          ] ===
            batchEndLevel,
        "completed levels do not cover the selected batch",
      );

      assertReplay(
        finalResult.outcome ===
          "CLEARED" &&
          finalResult.level ===
            batchEndLevel,
        "batch complete must end by clearing the fifth level",
      );
    }


    if (
      input.endReason ===
      "OUT_OF_REVIVES"
    ) {

      assertReplay(
        finalResult.outcome ===
          "FAILED",
        "out-of-revives run must end on a failed attempt",
      );

      assertReplay(
        revivesUsed ===
          KNIFE_HIT_MAX_REVIVES,
        "out-of-revives requires both revives to have been used",
      );

      assertReplay(
        completedLevels.length <
          KNIFE_HIT_LEVELS_PER_BATCH,
        "out-of-revives cannot occur after full batch completion",
      );
    }


    if (
      input.endReason ===
      "USER_END"
    ) {

      assertReplay(
        finalResult.outcome ===
          "FAILED",
        "user-ended run must end after a failed attempt",
      );

      assertReplay(
        completedLevels.length <
          KNIFE_HIT_LEVELS_PER_BATCH,
        "user-ended run cannot already be batch complete",
      );
    }


    const completedLevelCount =
      completedLevels.length;


    const rewardPaise =
      completedLevelCount *
      KNIFE_HIT_REWARD_PAISE_PER_LEVEL;


    const diamondsGranted =
      completedLevelCount *
      KNIFE_HIT_DIAMONDS_PER_LEVEL;


    return {
      valid:
        true,

      batchStartLevel:
        input.batchStartLevel,

      batchEndLevel,

      completedLevels,

      completedLevelCount,

      revivesUsed,

      verifiedScore,

      rewardPaise,

      diamondsGranted,

      attempts:
        attemptResults,

      endReason:
        input.endReason,

      nextBatchStartLevel:
        input.endReason ===
          "BATCH_COMPLETE"
          ? batchEndLevel +
              1
          : null,
    };
  };
