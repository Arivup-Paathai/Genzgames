import {
  BRICK_BREAKER_BALL_PADDLE_GAP,
  BRICK_BREAKER_BALL_RADIUS,
  BRICK_BREAKER_FIXED_SCALE,
  BRICK_BREAKER_GAME_HEIGHT,
  BRICK_BREAKER_GAME_WIDTH,
  BRICK_BREAKER_MAX_RUN_TICKS,
  BRICK_BREAKER_PADDLE_EDGE_PADDING,
  BRICK_BREAKER_PADDLE_HEIGHT,
  BRICK_BREAKER_PADDLE_Y,
  BRICK_BREAKER_STARTING_LIVES,
  generateBrickBreakerLevel,
  getBrickBreakerBallSpeed,
} from "./brickBreakerConstants";

import type {
  BrickBreakerActionResult,
  BrickBreakerBall,
  BrickBreakerBrick,
  BrickBreakerGameState,
  BrickBreakerInputEvent,
  BrickBreakerPaddle,
  BrickBreakerTickResult,
} from "./brickBreakerTypes";


/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER DETERMINISTIC ENGINE
 * =========================================================
 *
 * IMPORTANT:
 *
 * This file must remain PURE.
 *
 * Do NOT add:
 *
 * - React
 * - Firebase
 * - Cloud Functions
 * - AdMob
 * - localStorage
 * - Date.now()
 * - requestAnimationFrame()
 * - Math.random()
 *
 * Frontend and backend should be able to replay exactly
 * the same gameplay using:
 *
 * level + input events
 */


/*
 * =========================================================
 * PHYSICS CONFIG
 * =========================================================
 *
 * Split every deterministic tick into smaller movement
 * steps.
 *
 * This reduces the chance of a fast ball passing through
 * a brick or paddle between two simulation positions.
 */

const PHYSICS_SUBSTEPS =
  3;


/*
 * Paddle bounce adds a very small speed increase.
 *
 * 101 means 1% increase.
 */
const PADDLE_SPEED_MULTIPLIER_PERCENT =
  101;


/*
 * Dynamic speed will never exceed 135% of the level's
 * original configured speed.
 */
const MAX_DYNAMIC_SPEED_PERCENT =
  135;


/*
 * Minimum horizontal component after a paddle hit.
 *
 * Without this, a perfect centre hit could keep the ball
 * moving almost perfectly vertical for a long time.
 */
const MIN_HORIZONTAL_SPEED_PERCENT =
  12;


/*
 * Maximum horizontal share of total speed.
 *
 * Prevents almost-flat trajectories.
 */
const MAX_HORIZONTAL_SPEED_PERCENT =
  82;


/*
 * =========================================================
 * BASIC HELPERS
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


const integer =
  (
    value:
      number,
  ) =>
    Math.round(
      value,
    );


const cloneBrick =
  (
    brick:
      BrickBreakerBrick,
  ): BrickBreakerBrick => ({
    ...brick,
  });


const clonePaddle =
  (
    paddle:
      BrickBreakerPaddle,
  ): BrickBreakerPaddle => ({
    ...paddle,
  });


const cloneBall =
  (
    ball:
      BrickBreakerBall,
  ): BrickBreakerBall => ({
    ...ball,
  });


/*
 * =========================================================
 * BALL POSITION
 * =========================================================
 */

const createRestingBall =
  (
    paddle:
      BrickBreakerPaddle,
  ): BrickBreakerBall => ({
    x:
      integer(
        paddle.x +
        paddle.width /
          2,
      ),

    y:
      paddle.y -
      BRICK_BREAKER_BALL_RADIUS -
      BRICK_BREAKER_BALL_PADDLE_GAP,

    velocityX:
      0,

    velocityY:
      0,

    radius:
      BRICK_BREAKER_BALL_RADIUS,
  });


/*
 * =========================================================
 * INITIAL STATE
 * =========================================================
 *
 * Deterministic from level number alone.
 */

export const createInitialBrickBreakerState =
  (
    level:
      number,
  ): BrickBreakerGameState => {

    const generated =
      generateBrickBreakerLevel(
        level,
      );


    const paddle:
      BrickBreakerPaddle = {
      x:
        integer(
          (
            BRICK_BREAKER_GAME_WIDTH -
            generated
              .config
              .paddleWidth
          ) /
            2,
        ),

      y:
        BRICK_BREAKER_PADDLE_Y,

      width:
        generated
          .config
          .paddleWidth,

      height:
        BRICK_BREAKER_PADDLE_HEIGHT,
    };


    return {
      levelId:
        generated
          .config
          .id,

      tick:
        0,

      score:
        0,

      lives:
        BRICK_BREAKER_STARTING_LIVES,

      paddle,

      ball:
        createRestingBall(
          paddle,
        ),

      bricks:
        generated
          .bricks
          .map(
            cloneBrick,
          ),

      totalBrickHp:
        generated
          .config
          .totalBrickHp,

      destroyedBrickHp:
        0,

      ballLaunched:
        false,

      isPaused:
        false,

      isGameOver:
        false,

      isLevelCleared:
        false,
    };
  };


/*
 * =========================================================
 * PROGRESS
 * =========================================================
 */

export const getBrickBreakerProgressPercent =
  (
    state:
      BrickBreakerGameState,
  ) => {

    if (
      state.totalBrickHp <=
      0
    ) {
      return 100;
    }


    return clamp(
      Math.round(
        (
          state.destroyedBrickHp /
          state.totalBrickHp
        ) *
          100,
      ),
      0,
      100,
    );
  };


export const getBrickBreakerRemainingHp =
  (
    state:
      BrickBreakerGameState,
  ) =>
    Math.max(
      0,
      state.totalBrickHp -
        state.destroyedBrickHp,
    );


/*
 * =========================================================
 * PADDLE INPUT
 * =========================================================
 *
 * centerX is already expected to be quantized by the UI.
 *
 * The engine still clamps it safely.
 */

export const applyBrickBreakerPaddle =
  (
    state:
      BrickBreakerGameState,

    centerX:
      number,
  ): BrickBreakerActionResult => {

    if (
      state.isGameOver ||
      state.isLevelCleared
    ) {
      return {
        state,
        accepted:
          false,
      };
    }


    const halfWidth =
      state.paddle.width /
      2;


    const minimumCenter =
      BRICK_BREAKER_PADDLE_EDGE_PADDING +
      halfWidth;


    const maximumCenter =
      BRICK_BREAKER_GAME_WIDTH -
      BRICK_BREAKER_PADDLE_EDGE_PADDING -
      halfWidth;


    const safeCenter =
      integer(
        clamp(
          centerX,
          minimumCenter,
          maximumCenter,
        ),
      );


    const nextPaddle:
      BrickBreakerPaddle = {
      ...state.paddle,

      x:
        integer(
          safeCenter -
          halfWidth,
        ),
    };


    /*
     * Before launch, the ball follows the paddle.
     */
    const nextBall =
      state.ballLaunched
        ? state.ball
        : createRestingBall(
            nextPaddle,
          );


    return {
      state: {
        ...state,

        paddle:
          nextPaddle,

        ball:
          nextBall,
      },

      accepted:
        true,
    };
  };


/*
 * =========================================================
 * DETERMINISTIC LAUNCH DIRECTION
 * =========================================================
 *
 * No random numbers.
 *
 * Different levels / relaunch moments produce different
 * deterministic horizontal launch strengths.
 */

const getLaunchHorizontalPercent =
  (
    state:
      BrickBreakerGameState,
  ) => {

    const patterns = [
      -44,
      -31,
      -20,
      18,
      29,
      43,
    ];


    const index =
      Math.abs(
        (
          state.levelId *
            17 +
          state.tick *
            13 +
          state.lives *
            7
        ) %
          patterns.length,
      );


    return (
      patterns[
        index
      ] ??
      24
    );
  };


const createLaunchVelocity =
  (
    state:
      BrickBreakerGameState,
  ) => {

    const speed =
      getBrickBreakerBallSpeed(
        state.levelId,
      );


    const horizontalPercent =
      getLaunchHorizontalPercent(
        state,
      );


    const velocityX =
      integer(
        (
          speed *
          horizontalPercent
        ) /
          100,
      );


    const verticalSquared =
      Math.max(
        1,
        speed *
          speed -
          velocityX *
            velocityX,
      );


    const velocityY =
      -integer(
        Math.sqrt(
          verticalSquared,
        ),
      );


    return {
      velocityX,

      velocityY,
    };
  };


/*
 * =========================================================
 * LAUNCH
 * =========================================================
 */

export const launchBrickBreakerBall =
  (
    state:
      BrickBreakerGameState,
  ): BrickBreakerActionResult => {

    if (
      state.isPaused ||
      state.isGameOver ||
      state.isLevelCleared ||
      state.ballLaunched
    ) {
      return {
        state,
        accepted:
          false,
      };
    }


    const velocity =
      createLaunchVelocity(
        state,
      );


    return {
      state: {
        ...state,

        ball: {
          ...state.ball,

          velocityX:
            velocity.velocityX,

          velocityY:
            velocity.velocityY,
        },

        ballLaunched:
          true,
      },

      accepted:
        true,
    };
  };


/*
 * =========================================================
 * INPUT EVENT REPLAY
 * =========================================================
 *
 * Backend can use this helper while replaying a run.
 *
 * An event is accepted only at the exact deterministic
 * tick where the client recorded it.
 */

export const applyBrickBreakerInputEvent =
  (
    state:
      BrickBreakerGameState,

    event:
      BrickBreakerInputEvent,
  ): BrickBreakerActionResult => {

    if (
      event.tick !==
      state.tick
    ) {
      return {
        state,
        accepted:
          false,
      };
    }


    if (
      event.type ===
      "PADDLE"
    ) {
      return applyBrickBreakerPaddle(
        state,
        event.centerX,
      );
    }


    if (
      event.type ===
      "LAUNCH"
    ) {
      return launchBrickBreakerBall(
        state,
      );
    }


    return {
      state,
      accepted:
        false,
    };
  };


/*
 * =========================================================
 * PAUSE
 * =========================================================
 */

export const setBrickBreakerPaused =
  (
    state:
      BrickBreakerGameState,

    paused:
      boolean,
  ): BrickBreakerGameState => {

    if (
      state.isGameOver ||
      state.isLevelCleared
    ) {
      return state;
    }


    if (
      state.isPaused ===
      paused
    ) {
      return state;
    }


    return {
      ...state,

      isPaused:
        paused,
    };
  };


/*
 * =========================================================
 * REVIVE
 * =========================================================
 *
 * Run-level code controls:
 *
 * - rewarded ad
 * - maximum revive count
 *
 * Engine only restores the gameplay state.
 */

export const reviveBrickBreakerState =
  (
    state:
      BrickBreakerGameState,
  ): BrickBreakerActionResult => {

    if (
      !state.isGameOver ||
      state.isLevelCleared
    ) {
      return {
        state,
        accepted:
          false,
      };
    }


    const paddle =
      clonePaddle(
        state.paddle,
      );


    return {
      state: {
        ...state,

        lives:
          1,

        paddle,

        ball:
          createRestingBall(
            paddle,
          ),

        ballLaunched:
          false,

        isPaused:
          false,

        isGameOver:
          false,
      },

      accepted:
        true,
    };
  };


/*
 * =========================================================
 * CIRCLE / RECTANGLE COLLISION
 * =========================================================
 */

const circleTouchesRectangle =
  (
    ball:
      BrickBreakerBall,

    x:
      number,

    y:
      number,

    width:
      number,

    height:
      number,
  ) => {

    const closestX =
      clamp(
        ball.x,
        x,
        x +
          width,
      );


    const closestY =
      clamp(
        ball.y,
        y,
        y +
          height,
      );


    const deltaX =
      ball.x -
      closestX;


    const deltaY =
      ball.y -
      closestY;


    return (
      deltaX *
        deltaX +
      deltaY *
        deltaY <=
      ball.radius *
        ball.radius
    );
  };


/*
 * =========================================================
 * BRICK REFLECTION
 * =========================================================
 */

const reflectBallFromBrick =
  (
    ball:
      BrickBreakerBall,

    brick:
      BrickBreakerBrick,

    previousX:
      number,

    previousY:
      number,
  ): BrickBreakerBall => {

    const next =
      cloneBall(
        ball,
      );


    const radius =
      ball.radius;


    const cameFromLeft =
      previousX +
        radius <=
      brick.x;


    const cameFromRight =
      previousX -
        radius >=
      brick.x +
        brick.width;


    const cameFromTop =
      previousY +
        radius <=
      brick.y;


    const cameFromBottom =
      previousY -
        radius >=
      brick.y +
        brick.height;


    if (
      cameFromLeft
    ) {

      next.x =
        brick.x -
        radius -
        1;

      next.velocityX =
        -Math.abs(
          next.velocityX,
        );


      return next;
    }


    if (
      cameFromRight
    ) {

      next.x =
        brick.x +
        brick.width +
        radius +
        1;

      next.velocityX =
        Math.abs(
          next.velocityX,
        );


      return next;
    }


    if (
      cameFromTop
    ) {

      next.y =
        brick.y -
        radius -
        1;

      next.velocityY =
        -Math.abs(
          next.velocityY,
        );


      return next;
    }


    if (
      cameFromBottom
    ) {

      next.y =
        brick.y +
        brick.height +
        radius +
        1;

      next.velocityY =
        Math.abs(
          next.velocityY,
        );


      return next;
    }


    /*
     * Corner / deep-overlap fallback.
     *
     * Choose whichever rectangle edge is closest.
     */
    const distanceLeft =
      Math.abs(
        ball.x -
        brick.x,
      );


    const distanceRight =
      Math.abs(
        ball.x -
        (
          brick.x +
          brick.width
        ),
      );


    const distanceTop =
      Math.abs(
        ball.y -
        brick.y,
      );


    const distanceBottom =
      Math.abs(
        ball.y -
        (
          brick.y +
          brick.height
        ),
      );


    const minimum =
      Math.min(
        distanceLeft,
        distanceRight,
        distanceTop,
        distanceBottom,
      );


    if (
      minimum ===
      distanceLeft
    ) {

      next.x =
        brick.x -
        radius -
        1;

      next.velocityX =
        -Math.abs(
          next.velocityX,
        );


      return next;
    }


    if (
      minimum ===
      distanceRight
    ) {

      next.x =
        brick.x +
        brick.width +
        radius +
        1;

      next.velocityX =
        Math.abs(
          next.velocityX,
        );


      return next;
    }


    if (
      minimum ===
      distanceTop
    ) {

      next.y =
        brick.y -
        radius -
        1;

      next.velocityY =
        -Math.abs(
          next.velocityY,
        );


      return next;
    }


    next.y =
      brick.y +
      brick.height +
      radius +
      1;

    next.velocityY =
      Math.abs(
        next.velocityY,
      );


    return next;
  };


/*
 * =========================================================
 * PADDLE BOUNCE
 * =========================================================
 */

const bounceFromPaddle =
  (
    ball:
      BrickBreakerBall,

    paddle:
      BrickBreakerPaddle,

    level:
      number,
  ): BrickBreakerBall => {

    const next =
      cloneBall(
        ball,
      );


    const paddleCenter =
      paddle.x +
      paddle.width /
        2;


    const halfWidth =
      paddle.width /
      2;


    const normalizedImpact =
      clamp(
        (
          ball.x -
          paddleCenter
        ) /
          Math.max(
            1,
            halfWidth,
          ),
        -1,
        1,
      );


    const currentSpeed =
      Math.max(
        getBrickBreakerBallSpeed(
          level,
        ),
        integer(
          Math.hypot(
            ball.velocityX,
            ball.velocityY,
          ),
        ),
      );


    const levelBaseSpeed =
      getBrickBreakerBallSpeed(
        level,
      );


    const maximumSpeed =
      integer(
        (
          levelBaseSpeed *
          MAX_DYNAMIC_SPEED_PERCENT
        ) /
          100,
      );


    const increasedSpeed =
      clamp(
        integer(
          (
            currentSpeed *
            PADDLE_SPEED_MULTIPLIER_PERCENT
          ) /
            100,
        ),
        levelBaseSpeed,
        maximumSpeed,
      );


    const maximumHorizontal =
      integer(
        (
          increasedSpeed *
          MAX_HORIZONTAL_SPEED_PERCENT
        ) /
          100,
      );


    let velocityX =
      integer(
        normalizedImpact *
          maximumHorizontal,
      );


    const minimumHorizontal =
      integer(
        (
          increasedSpeed *
          MIN_HORIZONTAL_SPEED_PERCENT
        ) /
          100,
      );


    if (
      Math.abs(
        velocityX,
      ) <
      minimumHorizontal
    ) {

      const fallbackDirection =
        ball.velocityX <
        0
          ? -1
          : ball.velocityX >
              0
            ? 1
            : (
                level %
                  2 ===
                0
                  ? -1
                  : 1
              );


      velocityX =
        minimumHorizontal *
        fallbackDirection;
    }


    velocityX =
      clamp(
        velocityX,
        -maximumHorizontal,
        maximumHorizontal,
      );


    const verticalSquared =
      Math.max(
        1,
        increasedSpeed *
          increasedSpeed -
          velocityX *
            velocityX,
      );


    const velocityY =
      -integer(
        Math.sqrt(
          verticalSquared,
        ),
      );


    next.x =
      clamp(
        next.x,
        paddle.x,
        paddle.x +
          paddle.width,
      );


    next.y =
      paddle.y -
      ball.radius -
      1;


    next.velocityX =
      velocityX;


    next.velocityY =
      velocityY;


    return next;
  };


/*
 * =========================================================
 * ADVANCE ONE DETERMINISTIC TICK
 * =========================================================
 */

export const advanceBrickBreakerTick =
  (
    state:
      BrickBreakerGameState,
  ): BrickBreakerTickResult => {

    /*
     * Frozen / terminal states do not advance.
     */
    if (
      state.isPaused ||
      state.isGameOver ||
      state.isLevelCleared ||
      !state.ballLaunched
    ) {
      return {
        state,

        brickHit:
          false,

        brickDestroyed:
          false,

        brickHpDestroyed:
          0,

        lifeLost:
          false,

        rewardMilestoneReached:
          false,

        levelCleared:
          false,

        gameOver:
          state.isGameOver,
      };
    }


    const nextTick =
      state.tick +
      1;


    /*
     * Safety ceiling.
     */
    if (
      nextTick >
      BRICK_BREAKER_MAX_RUN_TICKS
    ) {

      const paddle =
        clonePaddle(
          state.paddle,
        );


      const stoppedState:
        BrickBreakerGameState = {
        ...state,

        tick:
          nextTick,

        ball:
          createRestingBall(
            paddle,
          ),

        ballLaunched:
          false,

        isPaused:
          false,

        isGameOver:
          true,
      };


      return {
        state:
          stoppedState,

        brickHit:
          false,

        brickDestroyed:
          false,

        brickHpDestroyed:
          0,

        lifeLost:
          false,

        rewardMilestoneReached:
          false,

        levelCleared:
          false,

        gameOver:
          true,
      };
    }


    let nextBall =
      cloneBall(
        state.ball,
      );


    const nextPaddle =
      clonePaddle(
        state.paddle,
      );


    const nextBricks =
      state.bricks.map(
        cloneBrick,
      );


    let nextScore =
      state.score;


    let nextDestroyedBrickHp =
      state.destroyedBrickHp;


    let brickHit =
      false;


    let brickDestroyed =
      false;


    let brickHpDestroyed =
      0;


    let lifeLost =
      false;


    let levelCleared =
      false;


    let nextLives =
      state.lives;


    let nextBallLaunched =
      true;


    let gameOver =
      false;


    /*
     * =====================================================
     * SUBSTEP PHYSICS
     * =====================================================
     */

    for (
      let substep =
        0;

      substep <
      PHYSICS_SUBSTEPS;

      substep +=
        1
    ) {

      const movementX =
        integer(
          nextBall.velocityX /
          PHYSICS_SUBSTEPS,
        );


      const movementY =
        integer(
          nextBall.velocityY /
          PHYSICS_SUBSTEPS,
        );


      const previousX =
        nextBall.x;


      const previousY =
        nextBall.y;


      nextBall.x +=
        movementX;


      nextBall.y +=
        movementY;


      /*
       * -------------------------------------------------
       * LEFT WALL
       * -------------------------------------------------
       */
      if (
        nextBall.x -
          nextBall.radius <
        0
      ) {

        nextBall.x =
          nextBall.radius;

        nextBall.velocityX =
          Math.abs(
            nextBall.velocityX,
          );
      }


      /*
       * -------------------------------------------------
       * RIGHT WALL
       * -------------------------------------------------
       */
      if (
        nextBall.x +
          nextBall.radius >
        BRICK_BREAKER_GAME_WIDTH
      ) {

        nextBall.x =
          BRICK_BREAKER_GAME_WIDTH -
          nextBall.radius;

        nextBall.velocityX =
          -Math.abs(
            nextBall.velocityX,
          );
      }


      /*
       * -------------------------------------------------
       * TOP WALL
       * -------------------------------------------------
       */
      if (
        nextBall.y -
          nextBall.radius <
        0
      ) {

        nextBall.y =
          nextBall.radius;

        nextBall.velocityY =
          Math.abs(
            nextBall.velocityY,
          );
      }


      /*
       * -------------------------------------------------
       * PADDLE
       * -------------------------------------------------
       *
       * Only collide while travelling downward.
       */
      if (
        nextBall.velocityY >
          0 &&
        circleTouchesRectangle(
          nextBall,
          nextPaddle.x,
          nextPaddle.y,
          nextPaddle.width,
          nextPaddle.height,
        )
      ) {

        nextBall =
          bounceFromPaddle(
            nextBall,
            nextPaddle,
            state.levelId,
          );
      }


      /*
       * -------------------------------------------------
       * BRICKS
       * -------------------------------------------------
       *
       * Process the first deterministic collision in the
       * brick array during this substep.
       *
       * Another brick may be hit on a later substep/tick.
       */
      let hitBrickIndex =
        -1;


      for (
        let brickIndex =
          0;

        brickIndex <
        nextBricks.length;

        brickIndex +=
          1
      ) {

        const brick =
          nextBricks[
            brickIndex
          ];


        if (
          !brick ||
          brick.hp <=
            0
        ) {
          continue;
        }


        if (
          circleTouchesRectangle(
            nextBall,
            brick.x,
            brick.y,
            brick.width,
            brick.height,
          )
        ) {

          hitBrickIndex =
            brickIndex;

          break;
        }
      }


      if (
        hitBrickIndex >=
        0
      ) {

        const brick =
          nextBricks[
            hitBrickIndex
          ];


        if (
          brick
        ) {

          nextBall =
            reflectBallFromBrick(
              nextBall,
              brick,
              previousX,
              previousY,
            );


          const previousHp =
            brick.hp;


          const nextHp =
            Math.max(
              0,
              previousHp -
                1,
            );


          const wasDestroyed =
            nextHp ===
              0 &&
            previousHp >
              0;


          nextBricks[
            hitBrickIndex
          ] = {
            ...brick,

            hp:
              nextHp,
          };


          brickHit =
            true;


          brickHpDestroyed +=
            1;


          nextDestroyedBrickHp +=
            1;


          if (
            wasDestroyed
          ) {

            brickDestroyed =
              true;


            nextScore +=
              20;

          } else {

            nextScore +=
              8;
          }


          /*
           * Final brick HP removed.
           */
          if (
            nextDestroyedBrickHp >=
            state.totalBrickHp
          ) {

            nextDestroyedBrickHp =
              state.totalBrickHp;


            levelCleared =
              true;


            nextBallLaunched =
              false;


            nextBall = {
              ...nextBall,

              velocityX:
                0,

              velocityY:
                0,
            };


            nextScore +=
              100 +
              state.levelId *
                20;


            break;
          }
        }
      }


      /*
       * -------------------------------------------------
       * BALL LOST
       * -------------------------------------------------
       */
      if (
        !levelCleared &&
        nextBall.y -
          nextBall.radius >
        BRICK_BREAKER_GAME_HEIGHT
      ) {

        lifeLost =
          true;


        nextLives =
          Math.max(
            0,
            nextLives -
              1,
          );


        nextBallLaunched =
          false;


        if (
          nextLives <=
          0
        ) {

          gameOver =
            true;
        }


        nextBall =
          createRestingBall(
            nextPaddle,
          );


        break;
      }
    }


    /*
     * =====================================================
     * 50% REWARD MILESTONE
     * =====================================================
     *
     * Calculate from HP destroyed, NOT score.
     *
     * The milestone is true only on the exact tick where
     * progress crosses from below the level's threshold
     * to the threshold or above.
     *
     * Gameplay continues.
     */

    const generated =
      generateBrickBreakerLevel(
        state.levelId,
      );


    const rewardTargetHp =
      generated
        .config
        .rewardBrickHp;


    const rewardMilestoneReached =
      state.destroyedBrickHp <
        rewardTargetHp &&
      nextDestroyedBrickHp >=
        rewardTargetHp;


    /*
     * =====================================================
     * FINAL STATE
     * =====================================================
     */

    const nextState:
      BrickBreakerGameState = {
      ...state,

      tick:
        nextTick,

      score:
        nextScore,

      lives:
        nextLives,

      paddle:
        nextPaddle,

      ball:
        nextBall,

      bricks:
        nextBricks,

      destroyedBrickHp:
        nextDestroyedBrickHp,

      ballLaunched:
        nextBallLaunched,

      isPaused:
        false,

      isGameOver:
        gameOver,

      isLevelCleared:
        levelCleared,
    };


    return {
      state:
        nextState,

      brickHit,

      brickDestroyed,

      brickHpDestroyed,

      lifeLost,

      rewardMilestoneReached,

      levelCleared,

      gameOver,
    };
  };


/*
 * =========================================================
 * VISUAL / UI COORDINATE HELPERS
 * =========================================================
 *
 * These helpers are safe for React rendering.
 *
 * They do not alter gameplay.
 */

export const brickBreakerFixedToVisual =
  (
    value:
      number,
  ) =>
    value /
    BRICK_BREAKER_FIXED_SCALE;


export const brickBreakerVisualToFixed =
  (
    value:
      number,
  ) =>
    integer(
      value *
      BRICK_BREAKER_FIXED_SCALE,
    );


/*
 * Convert a pointer X position inside the rendered arena
 * into deterministic engine coordinates.
 *
 * UI can then quantize the result before recording a
 * PADDLE event.
 */
export const brickBreakerPointerToEngineX =
  (
    pointerX:
      number,

    arenaLeft:
      number,

    arenaWidth:
      number,
  ) => {

    if (
      arenaWidth <=
      0
    ) {
      return (
        BRICK_BREAKER_GAME_WIDTH /
        2
      );
    }


    const normalized =
      clamp(
        (
          pointerX -
          arenaLeft
        ) /
          arenaWidth,
        0,
        1,
      );


    return integer(
      normalized *
      BRICK_BREAKER_GAME_WIDTH,
    );
  };