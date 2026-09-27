/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER BACKEND REPLAY ENGINE
 * =========================================================
 *
 * IMPORTANT:
 *
 * This must mirror the frontend deterministic engine.
 *
 * Backend does NOT trust:
 *
 * - client score
 * - client progress %
 * - client brick HP
 * - client reward result
 * - client level-clear result
 *
 * Backend rebuilds the level and replays:
 *
 * level
 * + paddle events
 * + launch events
 * + revive events
 *
 * The same run can therefore be verified at:
 *
 * 50% -> cash + diamonds
 * 100% -> level clear / progression
 */


/*
 * =========================================================
 * PUBLIC LIMITS
 * =========================================================
 */

export const GENZ_BRICK_BREAKER_MAX_LEVEL =
  200;


export const GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS =
  45000;


export const GENZ_BRICK_BREAKER_MAX_INPUT_EVENTS =
  50000;


export const GENZ_BRICK_BREAKER_MAX_REVIVES =
  1;


export const GENZ_BRICK_BREAKER_REWARD_PERCENT =
  50;


/*
 * =========================================================
 * ENGINE CONSTANTS
 * =========================================================
 */

const FIXED_SCALE =
  100;


const GAME_WIDTH =
  400 *
  FIXED_SCALE;


const GAME_HEIGHT =
  700 *
  FIXED_SCALE;


const BALL_RADIUS =
  8 *
  FIXED_SCALE;


const BALL_PADDLE_GAP =
  4 *
  FIXED_SCALE;


const PADDLE_HEIGHT =
  14 *
  FIXED_SCALE;


const PADDLE_Y =
  636 *
  FIXED_SCALE;


const START_PADDLE_WIDTH =
  88 *
  FIXED_SCALE;


const MIN_PADDLE_WIDTH =
  60 *
  FIXED_SCALE;


const PADDLE_EDGE_PADDING =
  8 *
  FIXED_SCALE;


const COLUMNS =
  7;


const BRICK_WIDTH =
  48 *
  FIXED_SCALE;


const BRICK_HEIGHT =
  22 *
  FIXED_SCALE;


const BRICK_GAP =
  6 *
  FIXED_SCALE;


const BRICK_TOP =
  110 *
  FIXED_SCALE;


const BRICK_LEFT =
  Math.floor(
    (
      GAME_WIDTH -
      (
        COLUMNS *
          BRICK_WIDTH +
        (
          COLUMNS -
          1
        ) *
          BRICK_GAP
      )
    ) /
      2,
  );


const STARTING_LIVES =
  3;


const PHYSICS_SUBSTEPS =
  3;


const PADDLE_SPEED_MULTIPLIER_PERCENT =
  101;


const MAX_DYNAMIC_SPEED_PERCENT =
  135;


const MIN_HORIZONTAL_SPEED_PERCENT =
  12;


const MAX_HORIZONTAL_SPEED_PERCENT =
  82;


/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface Brick {
  id:
    number;

  row:
    number;

  column:
    number;

  x:
    number;

  y:
    number;

  width:
    number;

  height:
    number;

  hp:
    number;

  maxHp:
    number;

  hue:
    number;
}


interface Paddle {
  x:
    number;

  y:
    number;

  width:
    number;

  height:
    number;
}


interface Ball {
  x:
    number;

  y:
    number;

  velocityX:
    number;

  velocityY:
    number;

  radius:
    number;
}


interface GameState {
  levelId:
    number;

  tick:
    number;

  score:
    number;

  lives:
    number;

  paddle:
    Paddle;

  ball:
    Ball;

  bricks:
    Brick[];

  totalBrickHp:
    number;

  destroyedBrickHp:
    number;

  ballLaunched:
    boolean;

  isPaused:
    boolean;

  isGameOver:
    boolean;

  isLevelCleared:
    boolean;
}


export interface GenZBrickBreakerPaddleEvent {
  type:
    "PADDLE";

  tick:
    number;

  centerX:
    number;
}


export interface GenZBrickBreakerLaunchEvent {
  type:
    "LAUNCH";

  tick:
    number;
}


export type GenZBrickBreakerInputEvent =
  | GenZBrickBreakerPaddleEvent
  | GenZBrickBreakerLaunchEvent;


export interface GenZBrickBreakerReviveEvent {
  afterTick:
    number;

  reviveNumber:
    number;
}


export interface GenZBrickBreakerReplayInput {
  level:
    number;

  tickCount:
    number;

  inputEvents:
    GenZBrickBreakerInputEvent[];

  reviveEvents:
    GenZBrickBreakerReviveEvent[];
}


export interface GenZBrickBreakerReplayResult {
  level:
    number;

  tickCount:
    number;

  score:
    number;

  destroyedBrickHp:
    number;

  totalBrickHp:
    number;

  progressPercent:
    number;

  rewardTargetHp:
    number;

  rewardMilestoneTick:
    number |
    null;

  levelCleared:
    boolean;

  gameOver:
    boolean;

  lives:
    number;

  revivesUsed:
    number;
}


interface TickResult {
  state:
    GameState;

  rewardMilestoneReached:
    boolean;
}


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
      GENZ_BRICK_BREAKER_MAX_LEVEL,
    );


const cloneBrick =
  (
    brick:
      Brick,
  ): Brick => ({
    ...brick,
  });


const clonePaddle =
  (
    paddle:
      Paddle,
  ): Paddle => ({
    ...paddle,
  });


const cloneBall =
  (
    ball:
      Ball,
  ): Ball => ({
    ...ball,
  });


/*
 * =========================================================
 * LEVEL GENERATION
 * =========================================================
 */

const getRows =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
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


const getPaddleWidth =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
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
        FIXED_SCALE
      );


    return Math.round(
      clamp(
        START_PADDLE_WIDTH -
          reduction,
        MIN_PADDLE_WIDTH,
        START_PADDLE_WIDTH,
      ),
    );
  };


const getBallSpeed =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
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
            GENZ_BRICK_BREAKER_MAX_LEVEL -
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


    if (
      pattern ===
      0
    ) {
      return true;
    }


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


    if (
      pattern ===
      5
    ) {

      const gapColumn =
        row %
        COLUMNS;


      return (
        column !==
        gapColumn
      );
    }


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
            COLUMNS -
              1
        )
      ) {
        return false;
      }


      return true;
    }


    if (
      row ===
        totalRows -
          1 &&
      (
        column ===
          0 ||
        column ===
          COLUMNS -
            1
      )
    ) {
      return false;
    }


    return true;
  };


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
      normalizeLevel(
        level,
      );


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


const generateLevel =
  (
    level:
      number,
  ) => {

    const safeLevel =
      normalizeLevel(
        level,
      );


    const rows =
      getRows(
        safeLevel,
      );


    const bricks:
      Brick[] =
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
        COLUMNS;

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
            BRICK_LEFT +
            column *
              (
                BRICK_WIDTH +
                BRICK_GAP
              ),

          y:
            BRICK_TOP +
            row *
              (
                BRICK_HEIGHT +
                BRICK_GAP
              ),

          width:
            BRICK_WIDTH,

          height:
            BRICK_HEIGHT,

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


    const rewardTargetHp =
      Math.max(
        1,
        Math.ceil(
          (
            totalBrickHp *
            GENZ_BRICK_BREAKER_REWARD_PERCENT
          ) /
            100,
        ),
      );


    return {
      level:
        safeLevel,

      paddleWidth:
        getPaddleWidth(
          safeLevel,
        ),

      totalBrickHp,

      rewardTargetHp,

      bricks,
    };
  };


/*
 * =========================================================
 * INITIAL STATE
 * =========================================================
 */

const createRestingBall =
  (
    paddle:
      Paddle,
  ): Ball => ({
    x:
      integer(
        paddle.x +
        paddle.width /
          2,
      ),

    y:
      paddle.y -
      BALL_RADIUS -
      BALL_PADDLE_GAP,

    velocityX:
      0,

    velocityY:
      0,

    radius:
      BALL_RADIUS,
  });


const createInitialState =
  (
    level:
      number,
  ): GameState => {

    const generated =
      generateLevel(
        level,
      );


    const paddle:
      Paddle = {
      x:
        integer(
          (
            GAME_WIDTH -
            generated.paddleWidth
          ) /
            2,
        ),

      y:
        PADDLE_Y,

      width:
        generated.paddleWidth,

      height:
        PADDLE_HEIGHT,
    };


    return {
      levelId:
        generated.level,

      tick:
        0,

      score:
        0,

      lives:
        STARTING_LIVES,

      paddle,

      ball:
        createRestingBall(
          paddle,
        ),

      bricks:
        generated.bricks.map(
          cloneBrick,
        ),

      totalBrickHp:
        generated.totalBrickHp,

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
 * PADDLE
 * =========================================================
 */

const applyPaddle =
  (
    state:
      GameState,

    centerX:
      number,
  ) => {

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
      PADDLE_EDGE_PADDING +
      halfWidth;


    const maximumCenter =
      GAME_WIDTH -
      PADDLE_EDGE_PADDING -
      halfWidth;


    const safeCenter =
      integer(
        clamp(
          centerX,
          minimumCenter,
          maximumCenter,
        ),
      );


    const paddle: Paddle = {
      ...state.paddle,

      x:
        integer(
          safeCenter -
          halfWidth,
        ),
    };


    return {
      state: {
        ...state,

        paddle,

        ball:
          state.ballLaunched
            ? state.ball
            : createRestingBall(
                paddle,
              ),
      },

      accepted:
        true,
    };
  };


/*
 * =========================================================
 * LAUNCH
 * =========================================================
 */

const getLaunchHorizontalPercent =
  (
    state:
      GameState,
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


const launchBall =
  (
    state:
      GameState,
  ) => {

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


    const speed =
      getBallSpeed(
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


    const velocityY =
      -integer(
        Math.sqrt(
          Math.max(
            1,
            speed *
              speed -
            velocityX *
              velocityX,
          ),
        ),
      );


    return {
      state: {
        ...state,

        ball: {
          ...state.ball,

          velocityX,

          velocityY,
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
 * REVIVE
 * =========================================================
 */

const reviveState =
  (
    state:
      GameState,
  ) => {

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
 * COLLISION HELPERS
 * =========================================================
 */

const circleTouchesRectangle =
  (
    ball:
      Ball,

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


    const dx =
      ball.x -
      closestX;


    const dy =
      ball.y -
      closestY;


    return (
      dx *
        dx +
      dy *
        dy <=
      ball.radius *
        ball.radius
    );
  };


const reflectFromBrick =
  (
    ball:
      Ball,

    brick:
      Brick,

    previousX:
      number,

    previousY:
      number,
  ) => {

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


const bounceFromPaddle =
  (
    ball:
      Ball,

    paddle:
      Paddle,

    level:
      number,
  ) => {

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


    const levelBaseSpeed =
      getBallSpeed(
        level,
      );


    const currentSpeed =
      Math.max(
        levelBaseSpeed,
        integer(
          Math.hypot(
            ball.velocityX,
            ball.velocityY,
          ),
        ),
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

      const direction =
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
        direction;
    }


    velocityX =
      clamp(
        velocityX,
        -maximumHorizontal,
        maximumHorizontal,
      );


    const velocityY =
      -integer(
        Math.sqrt(
          Math.max(
            1,
            increasedSpeed *
              increasedSpeed -
            velocityX *
              velocityX,
          ),
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
 * ADVANCE ONE FIXED TICK
 * =========================================================
 */

const advanceTick =
  (
    state:
      GameState,
  ): TickResult => {

    if (
      state.isPaused ||
      state.isGameOver ||
      state.isLevelCleared ||
      !state.ballLaunched
    ) {
      return {
        state,

        rewardMilestoneReached:
          false,
      };
    }


    const nextTick =
      state.tick +
      1;


    if (
      nextTick >
      GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS
    ) {
      return {
        state: {
          ...state,

          tick:
            nextTick,

          ball:
            createRestingBall(
              state.paddle,
            ),

          ballLaunched:
            false,

          isGameOver:
            true,
        },

        rewardMilestoneReached:
          false,
      };
    }


    let nextBall =
      cloneBall(
        state.ball,
      );


    const paddle =
      clonePaddle(
        state.paddle,
      );


    const bricks =
      state.bricks.map(
        cloneBrick,
      );


    let score =
      state.score;


    let destroyedBrickHp =
      state.destroyedBrickHp;


    let lives =
      state.lives;


    let ballLaunched =
      true;


    let gameOver =
      false;


    let levelCleared =
      false;


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


      if (
        nextBall.x +
          nextBall.radius >
        GAME_WIDTH
      ) {

        nextBall.x =
          GAME_WIDTH -
          nextBall.radius;

        nextBall.velocityX =
          -Math.abs(
            nextBall.velocityX,
          );
      }


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


      if (
        nextBall.velocityY >
          0 &&
        circleTouchesRectangle(
          nextBall,
          paddle.x,
          paddle.y,
          paddle.width,
          paddle.height,
        )
      ) {

        nextBall =
          bounceFromPaddle(
            nextBall,
            paddle,
            state.levelId,
          );
      }


      let hitBrickIndex =
        -1;


      for (
        let index =
          0;

        index <
        bricks.length;

        index +=
          1
      ) {

        const brick =
          bricks[
            index
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
            index;

          break;
        }
      }


      if (
        hitBrickIndex >=
        0
      ) {

        const brick =
          bricks[
            hitBrickIndex
          ];


        if (
          brick
        ) {

          nextBall =
            reflectFromBrick(
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


          bricks[
            hitBrickIndex
          ] = {
            ...brick,

            hp:
              nextHp,
          };


          destroyedBrickHp +=
            1;


          if (
            nextHp ===
              0 &&
            previousHp >
              0
          ) {

            score +=
              20;

          } else {

            score +=
              8;
          }


          if (
            destroyedBrickHp >=
            state.totalBrickHp
          ) {

            destroyedBrickHp =
              state.totalBrickHp;


            levelCleared =
              true;


            ballLaunched =
              false;


            nextBall = {
              ...nextBall,

              velocityX:
                0,

              velocityY:
                0,
            };


            score +=
              100 +
              state.levelId *
                20;


            break;
          }
        }
      }


      if (
        !levelCleared &&
        nextBall.y -
          nextBall.radius >
        GAME_HEIGHT
      ) {

        lives =
          Math.max(
            0,
            lives -
              1,
          );


        ballLaunched =
          false;


        if (
          lives <=
          0
        ) {
          gameOver =
            true;
        }


        nextBall =
          createRestingBall(
            paddle,
          );


        break;
      }
    }


    const generated =
      generateLevel(
        state.levelId,
      );


    const milestoneReached =
      state.destroyedBrickHp <
        generated.rewardTargetHp &&
      destroyedBrickHp >=
        generated.rewardTargetHp;


    return {
      state: {
        ...state,

        tick:
          nextTick,

        score,

        lives,

        paddle,

        ball:
          nextBall,

        bricks,

        destroyedBrickHp,

        ballLaunched,

        isPaused:
          false,

        isGameOver:
          gameOver,

        isLevelCleared:
          levelCleared,
      },

      rewardMilestoneReached:
        milestoneReached,
    };
  };


/*
 * =========================================================
 * INPUT VALIDATION HELPERS
 * =========================================================
 */

export const isGenZBrickBreakerInputEvent =
  (
    value:
      unknown,
  ): value is GenZBrickBreakerInputEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as Partial<
        GenZBrickBreakerInputEvent
      >;


    if (
      !Number.isInteger(
        event.tick,
      ) ||
      Number(
        event.tick,
      ) <
        0 ||
      Number(
        event.tick,
      ) >
        GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS
    ) {
      return false;
    }


    if (
      event.type ===
      "LAUNCH"
    ) {
      return true;
    }


    if (
      event.type ===
      "PADDLE"
    ) {

      return (
        typeof event.centerX ===
          "number" &&
        Number.isFinite(
          event.centerX,
        ) &&
        Number.isInteger(
          event.centerX,
        ) &&
        event.centerX >=
          0 &&
        event.centerX <=
          GAME_WIDTH
      );
    }


    return false;
  };


export const isGenZBrickBreakerReviveEvent =
  (
    value:
      unknown,
  ): value is GenZBrickBreakerReviveEvent => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const event =
      value as Partial<
        GenZBrickBreakerReviveEvent
      >;


    return (
      Number.isInteger(
        event.afterTick,
      ) &&
      Number(
        event.afterTick,
      ) >=
        1 &&
      Number(
        event.afterTick,
      ) <=
        GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS &&
      Number.isInteger(
        event.reviveNumber,
      ) &&
      Number(
        event.reviveNumber,
      ) >=
        1 &&
      Number(
        event.reviveNumber,
      ) <=
        GENZ_BRICK_BREAKER_MAX_REVIVES
    );
  };


/*
 * =========================================================
 * REPLAY
 * =========================================================
 */

export const replayGenZBrickBreakerRun =
  (
    input:
      GenZBrickBreakerReplayInput,
  ): GenZBrickBreakerReplayResult => {

    if (
      !Number.isInteger(
        input.level,
      ) ||
      input.level <
        1 ||
      input.level >
        GENZ_BRICK_BREAKER_MAX_LEVEL
    ) {
      throw new Error(
        "INVALID_LEVEL",
      );
    }


    if (
      !Number.isInteger(
        input.tickCount,
      ) ||
      input.tickCount <
        1 ||
      input.tickCount >
        GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS
    ) {
      throw new Error(
        "INVALID_TICK_COUNT",
      );
    }


    if (
      input.inputEvents.length >
      GENZ_BRICK_BREAKER_MAX_INPUT_EVENTS
    ) {
      throw new Error(
        "TOO_MANY_INPUT_EVENTS",
      );
    }


    if (
      input.reviveEvents.length >
      GENZ_BRICK_BREAKER_MAX_REVIVES
    ) {
      throw new Error(
        "TOO_MANY_REVIVES",
      );
    }


    let previousInputTick =
      -1;


    for (
      const event of
      input.inputEvents
    ) {

      if (
        !isGenZBrickBreakerInputEvent(
          event,
        )
      ) {
        throw new Error(
          "INVALID_INPUT_EVENT",
        );
      }


      if (
        event.tick <
        previousInputTick
      ) {
        throw new Error(
          "INPUT_EVENTS_NOT_SORTED",
        );
      }


      if (
        event.tick >
        input.tickCount
      ) {
        throw new Error(
          "INPUT_EVENT_AFTER_END",
        );
      }


      previousInputTick =
        event.tick;
    }


    let previousReviveTick =
      -1;


    let expectedReviveNumber =
      1;


    for (
      const event of
      input.reviveEvents
    ) {

      if (
        !isGenZBrickBreakerReviveEvent(
          event,
        )
      ) {
        throw new Error(
          "INVALID_REVIVE_EVENT",
        );
      }


      if (
        event.afterTick <
        previousReviveTick
      ) {
        throw new Error(
          "REVIVE_EVENTS_NOT_SORTED",
        );
      }


      if (
        event.afterTick >
        input.tickCount
      ) {
        throw new Error(
          "REVIVE_AFTER_END",
        );
      }


      if (
        event.reviveNumber !==
        expectedReviveNumber
      ) {
        throw new Error(
          "INVALID_REVIVE_NUMBER",
        );
      }


      previousReviveTick =
        event.afterTick;


      expectedReviveNumber +=
        1;
    }


    const generated =
      generateLevel(
        input.level,
      );


    let state =
      createInitialState(
        input.level,
      );


    let inputIndex =
      0;


    let reviveIndex =
      0;


    let revivesUsed =
      0;


    let rewardMilestoneTick:
      number |
      null =
      null;


    /*
     * Safety guard protects Functions from malformed
     * payloads that could otherwise create a replay loop.
     */
    let replayGuard =
      0;


    const maximumReplayGuard =
      input.tickCount +
      input.inputEvents.length +
      input.reviveEvents.length +
      100;


    while (
      state.tick <
      input.tickCount
    ) {

      replayGuard +=
        1;


      if (
        replayGuard >
        maximumReplayGuard
      ) {
        throw new Error(
          "REPLAY_GUARD_EXCEEDED",
        );
      }


      /*
       * -------------------------------------------------
       * REVIVE
       * -------------------------------------------------
       *
       * Revive happens while the engine is stopped on the
       * exact game-over tick.
       */
      const reviveEvent =
        input.reviveEvents[
          reviveIndex
        ];


      if (
        reviveEvent &&
        reviveEvent.afterTick <
          state.tick
      ) {
        throw new Error(
          "MISSED_REVIVE_EVENT",
        );
      }


      if (
        reviveEvent &&
        reviveEvent.afterTick ===
          state.tick
      ) {

        if (
          !state.isGameOver
        ) {
          throw new Error(
            "REVIVE_WITHOUT_GAME_OVER",
          );
        }


        if (
          revivesUsed >=
          GENZ_BRICK_BREAKER_MAX_REVIVES
        ) {
          throw new Error(
            "REVIVE_LIMIT_EXCEEDED",
          );
        }


        const revived =
          reviveState(
            state,
          );


        if (
          !revived.accepted
        ) {
          throw new Error(
            "REVIVE_REJECTED",
          );
        }


        state =
          revived.state;


        revivesUsed +=
          1;


        reviveIndex +=
          1;
      }


      /*
       * -------------------------------------------------
       * PLAYER INPUT AT CURRENT TICK
       * -------------------------------------------------
       */
      while (
        inputIndex <
        input.inputEvents.length
      ) {

        const event =
          input.inputEvents[
            inputIndex
          ];


        if (
          !event
        ) {
          break;
        }


        if (
          event.tick <
          state.tick
        ) {
          throw new Error(
            "MISSED_INPUT_EVENT",
          );
        }


        if (
          event.tick >
          state.tick
        ) {
          break;
        }


        if (
          event.type ===
          "PADDLE"
        ) {

          const result =
            applyPaddle(
              state,
              event.centerX,
            );


          if (
            !result.accepted
          ) {
            throw new Error(
              "PADDLE_EVENT_REJECTED",
            );
          }


          state =
            result.state;

        } else {

          const result =
            launchBall(
              state,
            );


          if (
            !result.accepted
          ) {
            throw new Error(
              "LAUNCH_EVENT_REJECTED",
            );
          }


          state =
            result.state;
        }


        inputIndex +=
          1;
      }


      /*
       * A terminal level cannot magically continue.
       */
      if (
        state.isLevelCleared
      ) {
        throw new Error(
          "LEVEL_CLEARED_BEFORE_SUBMITTED_END",
        );
      }


      /*
       * Game over requires a valid revive before replay
       * can continue.
       */
      if (
        state.isGameOver
      ) {
        throw new Error(
          "GAME_OVER_BEFORE_SUBMITTED_END",
        );
      }


      /*
       * Tick advances only while the ball is launched.
       *
       * The frontend behaves the same way.
       *
       * If the player was waiting to launch, a LAUNCH
       * event at this exact tick must exist.
       */
      if (
        !state.ballLaunched
      ) {
        throw new Error(
          "MISSING_LAUNCH_EVENT",
        );
      }


      const tickResult =
        advanceTick(
          state,
        );


      state =
        tickResult.state;


      if (
        tickResult
          .rewardMilestoneReached &&
        rewardMilestoneTick ===
          null
      ) {

        rewardMilestoneTick =
          state.tick;
      }
    }


    /*
     * Events at exactly tickCount may have been recorded
     * after the final verified simulation tick.
     *
     * They cannot affect the already-reached state and are
     * intentionally not used for reward/progression.
     *
     * Earlier events, however, must all have been consumed.
     */
    while (
      inputIndex <
      input.inputEvents.length &&
      input.inputEvents[
        inputIndex
      ]?.tick ===
        input.tickCount
    ) {
      inputIndex +=
        1;
    }


    if (
      inputIndex !==
      input.inputEvents.length
    ) {
      throw new Error(
        "UNCONSUMED_INPUT_EVENTS",
      );
    }


    /*
     * A revive at the exact final tick cannot affect the
     * already-verified result, so it must not be submitted
     * as part of this replay.
     */
    if (
      reviveIndex !==
      input.reviveEvents.length
    ) {
      throw new Error(
        "UNCONSUMED_REVIVE_EVENTS",
      );
    }


    const progressPercent =
      state.totalBrickHp >
        0
        ? clamp(
            Math.round(
              (
                state.destroyedBrickHp /
                state.totalBrickHp
              ) *
                100,
            ),
            0,
            100,
          )
        : 100;


    return {
      level:
        state.levelId,

      tickCount:
        state.tick,

      score:
        state.score,

      destroyedBrickHp:
        state.destroyedBrickHp,

      totalBrickHp:
        state.totalBrickHp,

      progressPercent,

      rewardTargetHp:
        generated.rewardTargetHp,

      rewardMilestoneTick,

      levelCleared:
        state.isLevelCleared,

      gameOver:
        state.isGameOver,

      lives:
        state.lives,

      revivesUsed,
    };
  };