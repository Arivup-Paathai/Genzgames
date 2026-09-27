import {
  KNIFE_HIT_APPLE_APPLE_SPACING_MILLI_DEG,
  KNIFE_HIT_APPLE_KNIFE_SPACING_MILLI_DEG,
  KNIFE_HIT_COLLISION_MILLI_DEG,
  KNIFE_HIT_MAX_SPEED_MILLI_DEG_PER_TICK,
  KNIFE_HIT_MAX_TICKS_PER_LEVEL,
  KNIFE_HIT_SPEED_CHANGE_MAX_TICKS,
  KNIFE_HIT_SPEED_CHANGE_MIN_TICKS,
  KNIFE_HIT_START_KNIFE_SPACING_MILLI_DEG,
  KNIFE_HIT_THROW_TRAVEL_TICKS,
  getKnifeHitApplesForLevel,
  getKnifeHitBaseSpeedForLevel,
  getKnifeHitExistingKnivesForLevel,
  getKnifeHitKnivesForLevel,
} from "./knifeHitConstants";

import type {
  KnifeHitApple,
  KnifeHitAttachedKnife,
  KnifeHitLevelState,
  KnifeHitTickResult,
} from "./knifeHitTypes";


const FULL_CIRCLE_MILLI_DEG =
  360_000;


const HALF_CIRCLE_MILLI_DEG =
  180_000;


/*
 * A successful knife can collect an apple when the
 * impact is within 12 degrees of the apple.
 */
const APPLE_HIT_MILLI_DEG =
  12_000;


/*
 * Keep the slowest generated speed comfortably playable.
 */
const MIN_SPEED_MILLI_DEG_PER_TICK =
  850;


/*
 * ============================================================
 * ANGLE HELPERS
 * ============================================================
 */

export const normalizeKnifeHitAngle =
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


export const getKnifeHitAngleDifference =
  (
    firstMilliDeg:
      number,

    secondMilliDeg:
      number,
  ) => {

    const first =
      normalizeKnifeHitAngle(
        firstMilliDeg,
      );

    const second =
      normalizeKnifeHitAngle(
        secondMilliDeg,
      );


    const direct =
      Math.abs(
        first -
          second,
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
 *
 * Gameplay randomness must be reproducible by the backend.
 *
 * Do not replace these functions with Math.random().
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
 * DETERMINISTIC LEVEL LAYOUT
 * ============================================================
 */

const isFarEnoughFromKnives =
  (
    angle:
      number,

    knives:
      KnifeHitAttachedKnife[],

    spacing:
      number,
  ) =>
    knives.every(
      knife =>
        getKnifeHitAngleDifference(
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
      KnifeHitApple[],

    spacing:
      number,
  ) =>
    apples.every(
      apple =>
        getKnifeHitAngleDifference(
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
      KnifeHitAttachedKnife[],
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
        normalizeKnifeHitAngle(
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


    /*
     * Safety fallback. With our configured maximum counts this
     * path should never be required.
     */
    return normalizeKnifeHitAngle(
      offset,
    );
  };


const findApplePlacement =
  (
    random:
      () => number,

    knives:
      KnifeHitAttachedKnife[],

    apples:
      KnifeHitApple[],
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
        normalizeKnifeHitAngle(
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


    return normalizeKnifeHitAngle(
      offset,
    );
  };


/*
 * ============================================================
 * DETERMINISTIC WHEEL SPEED
 * ============================================================
 *
 * Speed is derived only from:
 * - run seed
 * - level
 * - current deterministic tick
 *
 * Therefore pause time, device FPS and animation timing cannot
 * change the verified wheel position.
 */

const getKnifeHitSpeedForTick =
  (
    seed:
      number,

    level:
      number,

    tick:
      number,
  ) => {

    const baseMagnitude =
      getKnifeHitBaseSpeedForLevel(
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


      /*
       * Direction changes become slightly more common on
       * higher levels but remain capped.
       */
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
 * LEVEL CREATION / REVIVE RESET
 * ============================================================
 */

export const createInitialKnifeHitLevelState =
  (
    seed:
      number,

    level:
      number,
  ): KnifeHitLevelState => {

    const safeLevel =
      Math.max(
        1,
        Math.floor(
          level,
        ),
      );


    const layoutRandom =
      createSeededRandom(
        seed,
        safeLevel,
        10_001,
      );


    const existingKnives:
      KnifeHitAttachedKnife[] =
      [];


    const existingKnifeCount =
      getKnifeHitExistingKnivesForLevel(
        safeLevel,
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
      KnifeHitApple[] =
      [];


    const appleCount =
      getKnifeHitApplesForLevel(
        safeLevel,
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
      level:
        safeLevel,

      tick:
        0,

      wheelAngleMilliDeg:
        0,

      wheelSpeedMilliDegPerTick:
        getKnifeHitSpeedForTick(
          seed,
          safeLevel,
          0,
        ),

      knivesLeft:
        getKnifeHitKnivesForLevel(
          safeLevel,
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


export const restartKnifeHitLevel =
  (
    seed:
      number,

    level:
      number,
  ) =>
    createInitialKnifeHitLevelState(
      seed,
      level,
    );


/*
 * ============================================================
 * THROW INPUT
 * ============================================================
 *
 * A throw is accepted only while:
 * - level is active
 * - no knife is already travelling
 * - at least one knife remains
 */

export const applyKnifeHitThrow =
  (
    state:
      KnifeHitLevelState,
  ): KnifeHitLevelState => {

    if (
      state.isGameOver ||
      state.isLevelComplete ||
      state.pendingThrow !==
        null ||
      state.knivesLeft <=
        0
    ) {
      return state;
    }


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


/*
 * ============================================================
 * FIXED-TICK GAMEPLAY
 * ============================================================
 */

export const advanceKnifeHitTick =
  (
    state:
      KnifeHitLevelState,

    seed:
      number,
  ): KnifeHitTickResult => {

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


    if (
      state.tick >=
      KNIFE_HIT_MAX_TICKS_PER_LEVEL
    ) {

      const timedOutState:
        KnifeHitLevelState = {
          ...state,

          isGameOver:
            true,

          pendingThrow:
            null,
        };


      return {
        state:
          timedOutState,

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


    const nextTick =
      state.tick +
      1;


    const speed =
      getKnifeHitSpeedForTick(
        seed,
        state.level,
        nextTick,
      );


    const nextAngle =
      normalizeKnifeHitAngle(
        state.wheelAngleMilliDeg +
          speed,
      );


    let nextState:
      KnifeHitLevelState = {
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


    /*
     * The player's knife always reaches the wheel from the
     * bottom. Convert that fixed world-space impact point into
     * the wheel's rotating local angle.
     */
    const impactRelAngle =
      normalizeKnifeHitAngle(
        HALF_CIRCLE_MILLI_DEG -
          nextAngle,
      );


    const collision =
      nextState
        .attachedKnives
        .some(
          knife =>
            getKnifeHitAngleDifference(
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
            getKnifeHitAngleDifference(
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
