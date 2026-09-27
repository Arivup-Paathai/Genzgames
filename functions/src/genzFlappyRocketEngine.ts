/*
 * =====================================================
 * GENZ FLAPPY ROCKET
 * BACKEND DETERMINISTIC REPLAY ENGINE
 * =====================================================
 *
 * IMPORTANT:
 *
 * Gameplay rules in this file must stay identical to:
 *
 * src/games/flappyRocket/flappyRocketEngine.ts
 * src/games/flappyRocket/flappyRocketConstants.ts
 *
 * Backend NEVER trusts client score.
 */


export interface GenZFlappyRocketObstacle {
  id: number;

  x: number;

  gapY: number;

  gapHeight: number;

  width: number;

  passed: boolean;
}


interface GenZFlappyRocketState {
  rocketY: number;

  rocketVelocity: number;

  obstacles:
    GenZFlappyRocketObstacle[];

  score: number;

  distance: number;

  tick: number;

  nextObstacleId: number;

  lastSpawnTick: number;

  reviveUsed: boolean;

  isGameOver: boolean;
}


export interface GenZFlappyRocketFlapEvent {
  /*
   * Deterministic simulation tick
   * where the flap is applied.
   */
  tick: number;
}


export interface ReplayGenZFlappyRocketRunInput {
  seed: number;

  /*
   * For reward verification this should
   * normally be rewardMilestoneTick.
   */
  tickCount: number;

  flapEvents:
    GenZFlappyRocketFlapEvent[];

  /*
   * Exact crash tick where the player's
   * one pre-50 revive happened.
   *
   * null = no revive used.
   */
  reviveTick:
    number |
    null;
}


export interface ReplayGenZFlappyRocketRunResult {
  rewardMilestoneReached: boolean;

  rewardMilestoneTick:
    number |
    null;

  gameOver: boolean;

  gameOverTick:
    number |
    null;

  reviveUsed: boolean;

  score: number;

  distance: number;

  finalTick: number;

  randomStep: number;
}


/*
 * =====================================================
 * SECURITY LIMITS
 * =====================================================
 *
 * Prevent malicious requests from forcing
 * extremely large backend replay loops.
 *
 * 30,000 ticks @ 60Hz is roughly 8 minutes.
 * Reaching score 50 should normally happen
 * well before this.
 */
export const GENZ_FLAPPY_MAX_REPLAY_TICKS =
  30000;


export const GENZ_FLAPPY_MAX_FLAP_EVENTS =
  10000;


/*
 * =====================================================
 * WORLD
 * =====================================================
 */

const FLAPPY_GAME_WIDTH =
  400;


const FLAPPY_GAME_HEIGHT =
  700;


const FLAPPY_PLAYER_X =
  92;


const FLAPPY_PLAYER_SIZE =
  30;


/*
 * =====================================================
 * PHYSICS
 * =====================================================
 */

const FLAPPY_GRAVITY =
  0.34;


const FLAPPY_FLAP_FORCE =
  -5.6;


const FLAPPY_MIN_VELOCITY =
  -9;


const FLAPPY_MAX_VELOCITY =
  9;


/*
 * =====================================================
 * OBSTACLES
 * =====================================================
 */

const FLAPPY_MIN_GAP_CENTER =
  175;


const FLAPPY_MAX_GAP_CENTER =
  FLAPPY_GAME_HEIGHT -
  175;


/*
 * =====================================================
 * REWARD TARGET
 * =====================================================
 */

export const GENZ_FLAPPY_REWARD_SCORE =
  50;


/*
 * =====================================================
 * REVIVE
 * =====================================================
 *
 * Revive is valid only BEFORE score 50.
 */
const FLAPPY_REVIVE_VELOCITY =
  -2.2;


const FLAPPY_REVIVE_OBSTACLE_SHIFT =
  28;


/*
 * =====================================================
 * DIFFICULTY
 * =====================================================
 */

interface FlappyDifficultyConfig {
  gapHeight: number;

  spawnTicks: number;

  obstacleSpeed: number;

  obstacleWidth: number;
}


const getFlappyDifficultyConfig =
  (
    score:
      number,
  ): FlappyDifficultyConfig => {

    if (
      score <
      100
    ) {

      return {
        gapHeight:
          270,

        spawnTicks:
          192,

        obstacleSpeed:
          1.85,

        obstacleWidth:
          50,
      };
    }


    if (
      score <
      200
    ) {

      return {
        gapHeight:
          250,

        spawnTicks:
          174,

        obstacleSpeed:
          1.95,

        obstacleWidth:
          52,
      };
    }


    return {
      gapHeight:
        235,

      spawnTicks:
        156,

      obstacleSpeed:
        2.05,

      obstacleWidth:
        54,
    };
  };


/*
 * =====================================================
 * DETERMINISTIC RANDOM
 * =====================================================
 *
 * MUST remain identical to frontend:
 *
 * flappyRandomAtStep()
 */
const flappyRandomAtStep =
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
      GenZFlappyRocketObstacle;

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

const createInitialFlappyRocketState =
  (): {
    state:
      GenZFlappyRocketState;

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
 */

const applyFlappyRocketFlap =
  (
    state:
      GenZFlappyRocketState,
  ): GenZFlappyRocketState => {

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
      GenZFlappyRocketObstacle[],
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
     * Same reduced collision box used
     * by the frontend game.
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


      if (
        rocketTop <
          gapTop ||
        rocketBottom >
          gapBottom
      ) {
        return true;
      }
    }


    return false;
  };


/*
 * =====================================================
 * ADVANCE ONE GAME TICK
 * =====================================================
 */

const advanceFlappyRocketTick =
  (
    state:
      GenZFlappyRocketState,

    seed:
      number,

    randomStep:
      number,
  ) => {

    if (
      state.isGameOver
    ) {

      return {
        state,

        randomStep,

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
     * -------------------------------------------------
     * OBSTACLE SPAWN
     * -------------------------------------------------
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


    nextObstacles =
      nextObstacles.map(
        (
          obstacle,
        ) => {

          const passed =
            !obstacle.passed &&
            obstacle.x +
              obstacle.width <
              FLAPPY_PLAYER_X -
                FLAPPY_PLAYER_SIZE /
                  2;


          if (
            !passed
          ) {
            return obstacle;
          }


          nextScore +=
            1;


          return {
            ...obstacle,

            passed:
              true,
          };
        },
      );


    /*
     * Remove completely off-screen obstacles.
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
     * Reward is triggered only when crossing:
     *
     * 49 -> 50
     */
    const rewardMilestoneReached =
      state.score <
        GENZ_FLAPPY_REWARD_SCORE &&
      nextScore >=
        GENZ_FLAPPY_REWARD_SCORE;


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

      rewardMilestoneReached,

      gameOver,
    };
  };


/*
 * =====================================================
 * REVIVE
 * =====================================================
 *
 * Exactly one revive.
 *
 * It is valid only:
 *
 * - after an actual collision
 * - before score 50
 * - if revive has not already been used
 *
 * Rewarded-ad display itself happens on
 * the frontend.
 */
const reviveFlappyRocketState =
  (
    state:
      GenZFlappyRocketState,
  ): GenZFlappyRocketState => {

    if (
      !state.isGameOver ||
      state.reviveUsed ||
      state.score >=
        GENZ_FLAPPY_REWARD_SCORE
    ) {
      return state;
    }


    const safeRocketY =
      clamp(
        state.rocketY,

        FLAPPY_PLAYER_SIZE *
          2,

        FLAPPY_GAME_HEIGHT -
          FLAPPY_PLAYER_SIZE *
            2,
      );


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


/*
 * =====================================================
 * INPUT VALIDATION
 * =====================================================
 */

const validateReplayInput =
  (
    input:
      ReplayGenZFlappyRocketRunInput,
  ) => {

    if (
      !Number.isInteger(
        input.seed,
      ) ||
      input.seed <
        0 ||
      input.seed >
        0xffffffff
    ) {
      throw new Error(
        "Invalid Flappy Rocket seed.",
      );
    }


    if (
      !Number.isInteger(
        input.tickCount,
      ) ||
      input.tickCount <
        1 ||
      input.tickCount >
        GENZ_FLAPPY_MAX_REPLAY_TICKS
    ) {
      throw new Error(
        "Invalid Flappy Rocket tick count.",
      );
    }


    if (
      !Array.isArray(
        input.flapEvents,
      ) ||
      input.flapEvents.length >
        GENZ_FLAPPY_MAX_FLAP_EVENTS
    ) {
      throw new Error(
        "Invalid Flappy Rocket flap events.",
      );
    }


    let previousTick =
      0;


    for (
      const event of
      input.flapEvents
    ) {

      if (
        !event ||
        !Number.isInteger(
          event.tick,
        ) ||
        event.tick <
          1 ||
        event.tick >
          input.tickCount ||
        event.tick <=
          previousTick
      ) {
        throw new Error(
          "Invalid Flappy Rocket flap timeline.",
        );
      }


      previousTick =
        event.tick;
    }


    if (
      input.reviveTick !==
        null &&
      (
        !Number.isInteger(
          input.reviveTick,
        ) ||
        input.reviveTick <
          1 ||
        input.reviveTick >
          input.tickCount
      )
    ) {
      throw new Error(
        "Invalid Flappy Rocket revive tick.",
      );
    }
  };


/*
 * =====================================================
 * FULL SERVER REPLAY
 * =====================================================
 *
 * The backend receives:
 *
 * seed
 * tickCount
 * flapEvents
 * reviveTick
 *
 * It independently reconstructs:
 *
 * rocket movement
 * obstacles
 * score
 * collision
 * revive
 * reward milestone
 *
 * Client score is never accepted.
 */
export const replayGenZFlappyRocketRun =
  (
    input:
      ReplayGenZFlappyRocketRunInput,
  ): ReplayGenZFlappyRocketRunResult => {

    validateReplayInput(
      input,
    );


    const initial =
      createInitialFlappyRocketState();


    let state =
      initial.state;


    let randomStep =
      initial.randomStep;


    let flapIndex =
      0;


    let rewardMilestoneTick:
      number |
      null =
      null;


    let gameOverTick:
      number |
      null =
      null;


    let reviveApplied =
      false;


    for (
      let tick =
        1;

      tick <=
        input.tickCount;

      tick +=
        1
    ) {

      /*
       * Apply the player's flap BEFORE
       * advancing this deterministic tick.
       */
      if (
        flapIndex <
          input.flapEvents.length &&
        input.flapEvents[
          flapIndex
        ].tick ===
          tick
      ) {

        state =
          applyFlappyRocketFlap(
            state,
          );


        flapIndex +=
          1;
      }


      const result =
        advanceFlappyRocketTick(
          state,

          input.seed,

          randomStep,
        );


      state =
        result.state;


      randomStep =
        result.randomStep;


      /*
       * Capture the FIRST verified
       * score-50 crossing.
       */
      if (
        result.rewardMilestoneReached &&
        rewardMilestoneTick ===
          null
      ) {

        rewardMilestoneTick =
          state.tick;
      }


      /*
       * -------------------------------------------------
       * CRASH / REVIVE
       * -------------------------------------------------
       */
      if (
        result.gameOver
      ) {

        const validRevive =
          input.reviveTick ===
            state.tick &&
          !reviveApplied &&
          !state.reviveUsed &&
          state.score <
            GENZ_FLAPPY_REWARD_SCORE;


        if (
          validRevive
        ) {

          const revived =
            reviveFlappyRocketState(
              state,
            );


          /*
           * Revive function must genuinely
           * move game back into playing state.
           */
          if (
            revived.isGameOver ||
            !revived.reviveUsed
          ) {
            throw new Error(
              "Invalid Flappy Rocket revive.",
            );
          }


          state =
            revived;


          reviveApplied =
            true;


          /*
           * Continue replay from next tick.
           */
          continue;
        }


        gameOverTick =
          state.tick;


        break;
      }


      /*
       * A revive tick is invalid if there
       * was no crash on that exact tick.
       */
      if (
        input.reviveTick ===
          state.tick
      ) {

        throw new Error(
          "Flappy Rocket revive did not match a crash.",
        );
      }
    }


    /*
     * If client claims a revive existed but
     * replay never accepted it, reject it.
     */
    if (
      input.reviveTick !==
        null &&
      !reviveApplied
    ) {

      throw new Error(
        "Flappy Rocket revive could not be verified.",
      );
    }


    /*
     * All supplied flap events must have
     * occurred during the replay.
     */
    if (
      flapIndex !==
        input.flapEvents.length
    ) {

      throw new Error(
        "Unused Flappy Rocket flap events detected.",
      );
    }


    return {
      rewardMilestoneReached:
        rewardMilestoneTick !==
        null,

      rewardMilestoneTick,

      gameOver:
        state.isGameOver,

      gameOverTick,

      reviveUsed:
        state.reviveUsed,

      score:
        state.score,

      distance:
        state.distance,

      finalTick:
        state.tick,

      randomStep,
    };
  };