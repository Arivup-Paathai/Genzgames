import {
  FLAPPY_DIAMOND_REWARD,
  FLAPPY_FLAP_FORCE,
  FLAPPY_GAME_HEIGHT,
  FLAPPY_GRAVITY,
  FLAPPY_MAX_GAP_CENTER,
  FLAPPY_MAX_VELOCITY,
  FLAPPY_MIN_GAP_CENTER,
  FLAPPY_MIN_VELOCITY,
  FLAPPY_PLAYER_SIZE,
  FLAPPY_PLAYER_X,
  FLAPPY_REWARD_PAISE,
  FLAPPY_REWARD_SCORE,
  FLAPPY_REVIVE_OBSTACLE_SHIFT,
  FLAPPY_REVIVE_VELOCITY,
  getFlappyDifficultyConfig,
} from "./flappyRocketConstants";

import type {
  FlappyRocketGameState,
  FlappyRocketObstacle,
  FlappyRocketTickResult,
} from "./flappyRocketTypes";


/*
 * =====================================================
 * PUBLIC REWARD VALUES
 * =====================================================
 *
 * Re-exported so the Flappy Rocket UI can use
 * the same values shown by the deterministic
 * engine.
 *
 * Backend remains authoritative.
 */
export {
  FLAPPY_REWARD_PAISE,
  FLAPPY_DIAMOND_REWARD,
  FLAPPY_REWARD_SCORE,
};


/*
 * =====================================================
 * DETERMINISTIC RANDOM
 * =====================================================
 *
 * NEVER use Math.random() for anything that
 * changes verified Flappy Rocket gameplay.
 *
 * Frontend and backend must produce exactly
 * the same value from:
 *
 * seed + randomStep
 */
export const flappyRandomAtStep =
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


/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

const clamp =
  (
    value:
      number,

    min:
      number,

    max:
      number,
  ) =>
    Math.max(
      min,

      Math.min(
        max,
        value,
      ),
    );


const randomBetween =
  (
    seed:
      number,

    randomStep:
      number,

    min:
      number,

    max:
      number,
  ) => {

    const random =
      flappyRandomAtStep(
        seed,
        randomStep,
      );


    return {
      value:
        min +
        random *
          (
            max -
            min
          ),

      randomStep:
        randomStep +
        1,
    };
  };


/*
 * =====================================================
 * CREATE OBSTACLE
 * =====================================================
 */

const createObstacle =
  (
    seed:
      number,

    randomStep:
      number,

    score:
      number,

    obstacleId:
      number,
  ): {
    obstacle:
      FlappyRocketObstacle;

    randomStep:
      number;
  } => {

    const difficulty =
      getFlappyDifficultyConfig(
        score,
      );


    const gap =
      randomBetween(
        seed,

        randomStep,

        FLAPPY_MIN_GAP_CENTER,

        FLAPPY_MAX_GAP_CENTER,
      );


    return {
      obstacle: {
        id:
          obstacleId,

        /*
         * Same starting position used by
         * the original Flappy Rocket.
         */
        x:
          440,

        gapY:
          gap.value,

        gapHeight:
          difficulty.gapHeight,

        width:
          difficulty.obstacleWidth,

        passed:
          false,
      },

      randomStep:
        gap.randomStep,
    };
  };


/*
 * =====================================================
 * INITIAL STATE
 * =====================================================
 */

export const createInitialFlappyRocketState =
  (): {
    state:
      FlappyRocketGameState;

    randomStep:
      number;
  } => {

    return {
      state: {
        rocketY:
          FLAPPY_GAME_HEIGHT /
          2,

        rocketVelocity:
          0,

        obstacles:
          [],

        score:
          0,

        distance:
          0,

        tick:
          0,

        nextObstacleId:
          1,

        lastSpawnTick:
          0,

        reviveUsed:
          false,

        isGameOver:
          false,
      },

      randomStep:
        0,
    };
  };


/*
 * =====================================================
 * FLAP
 * =====================================================
 *
 * This is the only normal gameplay input.
 *
 * The caller records the current deterministic
 * tick in flapEvents.
 */
export const applyFlappyRocketFlap =
  (
    state:
      FlappyRocketGameState,
  ): FlappyRocketGameState => {

    if (
      state.isGameOver
    ) {
      return state;
    }


    return {
      ...state,

      rocketVelocity:
        FLAPPY_FLAP_FORCE,
    };
  };


/*
 * =====================================================
 * COLLISION
 * =====================================================
 */

const hasCollision =
  (
    rocketY:
      number,

    obstacles:
      FlappyRocketObstacle[],
  ) => {

    const topHit =
      rocketY -
        FLAPPY_PLAYER_SIZE /
          2 <=
      0;


    const bottomHit =
      rocketY +
        FLAPPY_PLAYER_SIZE /
          2 >=
      FLAPPY_GAME_HEIGHT;


    if (
      topHit ||
      bottomHit
    ) {
      return true;
    }


    /*
     * Keep the same reduced collision box
     * that the original Flappy Rocket used.
     */
    const rocketLeft =
      FLAPPY_PLAYER_X -
      FLAPPY_PLAYER_SIZE /
        2 +
      10;


    const rocketRight =
      FLAPPY_PLAYER_X +
      FLAPPY_PLAYER_SIZE /
        2 -
      10;


    const rocketTop =
      rocketY -
      FLAPPY_PLAYER_SIZE /
        2 +
      12;


    const rocketBottom =
      rocketY +
      FLAPPY_PLAYER_SIZE /
        2 -
      12;


    for (
      const obstacle of
      obstacles
    ) {

      const obstacleLeft =
        obstacle.x;


      const obstacleRight =
        obstacle.x +
        obstacle.width;


      const horizontalCollision =
        rocketRight >
          obstacleLeft &&
        rocketLeft <
          obstacleRight;


      if (
        !horizontalCollision
      ) {
        continue;
      }


      const gapTop =
        obstacle.gapY -
        obstacle.gapHeight /
          2;


      const gapBottom =
        obstacle.gapY +
        obstacle.gapHeight /
          2;


      const hitsTop =
        rocketTop <
        gapTop;


      const hitsBottom =
        rocketBottom >
        gapBottom;


      if (
        hitsTop ||
        hitsBottom
      ) {
        return true;
      }
    }


    return false;
  };


/*
 * =====================================================
 * ADVANCE ONE DETERMINISTIC TICK
 * =====================================================
 */

export const advanceFlappyRocketTick =
  (
    state:
      FlappyRocketGameState,

    seed:
      number,

    randomStep:
      number,
  ): FlappyRocketTickResult => {

    if (
      state.isGameOver
    ) {

      return {
        state,

        randomStep,

        scored:
          false,

        rewardMilestoneReached:
          false,

        gameOver:
          true,
      };
    }


    const nextTick =
      state.tick +
      1;


    /*
     * -------------------------------------------------
     * PLAYER PHYSICS
     * -------------------------------------------------
     */

    const nextVelocity =
      clamp(
        state.rocketVelocity +
          FLAPPY_GRAVITY,

        FLAPPY_MIN_VELOCITY,

        FLAPPY_MAX_VELOCITY,
      );


    const nextRocketY =
      state.rocketY +
      nextVelocity;


    const nextDistance =
      state.distance +
      1;


    /*
     * -------------------------------------------------
     * OBSTACLE MOVEMENT
     * -------------------------------------------------
     */

    const difficulty =
      getFlappyDifficultyConfig(
        state.score,
      );


    let nextObstacles =
      state.obstacles.map(
        (
          obstacle,
        ) => ({
          ...obstacle,

          x:
            obstacle.x -
            difficulty.obstacleSpeed,
        }),
      );


    let nextRandomStep =
      randomStep;


    let nextObstacleId =
      state.nextObstacleId;


    let nextLastSpawnTick =
      state.lastSpawnTick;


    /*
     * Spawn first obstacle after the normal
     * spawn interval.
     *
     * No Date.now().
     * No requestAnimationFrame timing.
     */
    if (
      nextTick -
        state.lastSpawnTick >=
      difficulty.spawnTicks
    ) {

      const created =
        createObstacle(
          seed,

          nextRandomStep,

          state.score,

          nextObstacleId,
        );


      nextRandomStep =
        created.randomStep;


      nextObstacles = [
        ...nextObstacles,

        created.obstacle,
      ];


      nextObstacleId +=
        1;


      nextLastSpawnTick =
        nextTick;
    }


    /*
     * -------------------------------------------------
     * SCORE
     * -------------------------------------------------
     */

    let nextScore =
      state.score;


    let scored =
      false;


    nextObstacles =
      nextObstacles.map(
        (
          obstacle,
        ) => {

          const justPassed =
            !obstacle.passed &&
            obstacle.x +
              obstacle.width <
              FLAPPY_PLAYER_X -
                FLAPPY_PLAYER_SIZE /
                  2;


          if (
            !justPassed
          ) {
            return obstacle;
          }


          nextScore +=
            1;


          scored =
            true;


          return {
            ...obstacle,

            passed:
              true,
          };
        },
      );


    /*
     * Remove obstacles that are completely
     * outside the left side of the game.
     */
    nextObstacles =
      nextObstacles.filter(
        (
          obstacle,
        ) =>
          obstacle.x +
            obstacle.width >
          -50,
      );


    /*
     * -------------------------------------------------
     * REWARD MILESTONE
     * -------------------------------------------------
     *
     * True only when score crosses:
     *
     * 49 -> 50
     *
     * Never again at 51, 52, ...
     */
    const rewardMilestoneReached =
      state.score <
        FLAPPY_REWARD_SCORE &&
      nextScore >=
        FLAPPY_REWARD_SCORE;


    /*
     * -------------------------------------------------
     * COLLISION
     * -------------------------------------------------
     */

    const gameOver =
      hasCollision(
        nextRocketY,

        nextObstacles,
      );


    return {
      state: {
        ...state,

        rocketY:
          nextRocketY,

        rocketVelocity:
          nextVelocity,

        obstacles:
          nextObstacles,

        score:
          nextScore,

        distance:
          nextDistance,

        tick:
          nextTick,

        nextObstacleId,

        lastSpawnTick:
          nextLastSpawnTick,

        isGameOver:
          gameOver,
      },

      randomStep:
        nextRandomStep,

      scored,

      rewardMilestoneReached,

      gameOver,
    };
  };


/*
 * =====================================================
 * DETERMINISTIC REVIVE
 * =====================================================
 *
 * One revive only.
 *
 * This function changes gameplay state,
 * so the backend version must use the
 * exact same logic.
 */
export const reviveFlappyRocketState =
  (
    state:
      FlappyRocketGameState,
  ): FlappyRocketGameState => {

    if (
  !state.isGameOver ||
  state.reviveUsed ||
  state.score >=
    FLAPPY_REWARD_SCORE
) {
  return state;
}


    /*
     * Clamp the player's position away
     * from the top/bottom boundary.
     */
    const safeRocketY =
      clamp(
        state.rocketY,

        FLAPPY_PLAYER_SIZE *
          2,

        FLAPPY_GAME_HEIGHT -
          FLAPPY_PLAYER_SIZE *
            2,
      );


    /*
     * Shift nearby obstacles slightly forward
     * to provide recovery room.
     */
    const shiftedObstacles =
      state.obstacles.map(
        (
          obstacle,
        ) => ({
          ...obstacle,

          x:
            obstacle.x +
            FLAPPY_REVIVE_OBSTACLE_SHIFT,
        }),
      );


    return {
      ...state,

      rocketY:
        safeRocketY,

      rocketVelocity:
        FLAPPY_REVIVE_VELOCITY,

      obstacles:
        shiftedObstacles,

      reviveUsed:
        true,

      isGameOver:
        false,
    };
  };