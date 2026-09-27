import {
  BONUS_FOOD_EVERY,
  BONUS_FOOD_PERCENT,
  BONUS_FOOD_POINTS,
  GRID_SIZE,
  INITIAL_DIRECTION,
  INITIAL_SNAKE,
  MAGNET_RADIUS,
  NORMAL_FOOD_PERCENT,
  NORMAL_FOOD_POINTS,
  POWER_UPS,
  SNAKE_COMPLETE_PERCENT,
  generateSnakeLevel,
} from "./snakeConstants";

import {
  Direction,
  PowerUpType,
  type Food,
  type Point,
  type PowerUpItem,
  type SnakeGameState,
  type SnakeTickResult,
} from "./snakeTypes";


/*
 * Chance per game tick while there is
 * currently no power-up on the board.
 *
 * Same probability as the old Snake game.
 */
const POWER_UP_SPAWN_CHANCE =
  0.005;


/*
 * Power-up remains visible on the board
 * for this many game ticks.
 */
const POWER_UP_BOARD_TTL_TICKS =
  100;


/*
 * =====================================================
 * DETERMINISTIC RANDOM
 * =====================================================
 *
 * Never use Math.random() inside GenZSnake.
 *
 * Frontend and backend must produce the exact
 * same result from:
 *
 * seed + randomStep
 */
export const snakeRandomAtStep =
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


const samePoint =
  (
    first:
      Point,

    second:
      Point,
  ) =>
    first.x ===
      second.x &&
    first.y ===
      second.y;


/*
 * Return every currently available cell.
 *
 * This avoids random retry loops and makes
 * frontend/backend replay deterministic.
 */
const getFreeCells =
  (
    excluded:
      Point[],
  ): Point[] => {

    const cells:
      Point[] =
      [];


    for (
      let y =
        0;

      y <
      GRID_SIZE;

      y +=
        1
    ) {

      for (
        let x =
          0;

        x <
        GRID_SIZE;

        x +=
          1
      ) {

        const point = {
          x,
          y,
        };


        const blocked =
          excluded.some(
            (
              excludedPoint,
            ) =>
              samePoint(
                point,
                excludedPoint,
              ),
          );


        if (
          !blocked
        ) {
          cells.push(
            point,
          );
        }
      }
    }


    return cells;
  };


const chooseFreePoint =
  (
    seed:
      number,

    randomStep:
      number,

    excluded:
      Point[],
  ) => {

    const cells =
      getFreeCells(
        excluded,
      );


    if (
      cells.length ===
      0
    ) {
      return {
        point:
          null as Point | null,

        randomStep:
          randomStep +
          1,
      };
    }


    const random =
      snakeRandomAtStep(
        seed,
        randomStep,
      );


    const index =
      Math.min(
        cells.length -
          1,

        Math.floor(
          random *
            cells.length,
        ),
      );


    return {
      point:
        cells[
          index
        ],

      randomStep:
        randomStep +
        1,
    };
  };


const spawnFood =
  (
    seed:
      number,

    randomStep:
      number,

    snake:
      Point[],

    obstacles:
      Point[],

    powerUp:
      PowerUpItem |
      null,

    isBonus:
      boolean,
  ): {
    food:
      Food |
      null;

    randomStep:
      number;
  } => {

    const excluded = [
      ...snake,
      ...obstacles,
    ];


    if (
      powerUp
    ) {
      excluded.push(
        powerUp.pos,
      );
    }


    const selected =
      chooseFreePoint(
        seed,
        randomStep,
        excluded,
      );


    return {
      food:
        selected.point
          ? {
              pos:
                selected.point,

              isBonus,
            }
          : null,

      randomStep:
        selected.randomStep,
    };
  };


const spawnPowerUp =
  (
    seed:
      number,

    randomStep:
      number,

    snake:
      Point[],

    obstacles:
      Point[],

    food:
      Food |
      null,
  ): {
    powerUp:
      PowerUpItem |
      null;

    randomStep:
      number;
  } => {

    /*
     * First random value decides whether
     * a power-up appears at all.
     */
    const spawnRoll =
      snakeRandomAtStep(
        seed,
        randomStep,
      );


    let nextRandomStep =
      randomStep +
      1;


    if (
      spawnRoll >=
      POWER_UP_SPAWN_CHANCE
    ) {
      return {
        powerUp:
          null,

        randomStep:
          nextRandomStep,
      };
    }


    /*
     * Second random value selects its type.
     */
    const typeRoll =
      snakeRandomAtStep(
        seed,
        nextRandomStep,
      );


    nextRandomStep +=
      1;


    const powerIndex =
      Math.min(
        POWER_UPS.length -
          1,

        Math.floor(
          typeRoll *
            POWER_UPS.length,
        ),
      );


    const selectedPower =
      POWER_UPS[
        powerIndex
      ];


    const excluded = [
      ...snake,
      ...obstacles,
    ];


    if (
      food
    ) {
      excluded.push(
        food.pos,
      );
    }


    /*
     * Third random value selects the position.
     */
    const selectedPoint =
      chooseFreePoint(
        seed,
        nextRandomStep,
        excluded,
      );


    return {
      powerUp:
        selectedPoint.point
          ? {
              pos:
                selectedPoint.point,

              type:
                selectedPower.type,

              remainingTicks:
                POWER_UP_BOARD_TTL_TICKS,
            }
          : null,

      randomStep:
        selectedPoint.randomStep,
    };
  };


export const isOppositeSnakeDirection =
  (
    current:
      Direction,

    next:
      Direction,
  ) => {

    return (
      (
        current ===
          Direction.UP &&
        next ===
          Direction.DOWN
      ) ||
      (
        current ===
          Direction.DOWN &&
        next ===
          Direction.UP
      ) ||
      (
        current ===
          Direction.LEFT &&
        next ===
          Direction.RIGHT
      ) ||
      (
        current ===
          Direction.RIGHT &&
        next ===
          Direction.LEFT
      )
    );
  };


/*
 * Safe direction-change helper.
 *
 * UI should use this instead of directly
 * changing nextDirection.
 */
export const applySnakeDirection =
  (
    state:
      SnakeGameState,

    direction:
      Direction,
  ): SnakeGameState => {

    if (
  state.isGameOver
) {
  return state;
}


    if (
      isOppositeSnakeDirection(
        state.direction,
        direction,
      )
    ) {
      return state;
    }


    return {
      ...state,

      nextDirection:
        direction,
    };
  };


/*
 * Create a fresh deterministic run.
 *
 * No Firebase access.
 * No AdMob access.
 * No browser APIs.
 */
export const createInitialSnakeState =
  (
    level:
      number,

    seed:
      number,
  ): {
    state:
      SnakeGameState;

    randomStep:
      number;
  } => {

    const levelConfig =
      generateSnakeLevel(
        level,
      );


    const initialSnake =
      INITIAL_SNAKE.map(
        (
          point,
        ) => ({
          ...point,
        }),
      );


    const firstFood =
      spawnFood(
        seed,
        0,
        initialSnake,
        levelConfig.obstacles,
        null,
        false,
      );


    return {
      state: {
        snake:
          initialSnake,

        direction:
          INITIAL_DIRECTION,

        nextDirection:
          INITIAL_DIRECTION,

        food:
          firstFood.food,

        obstacles:
          levelConfig.obstacles.map(
            (
              point,
            ) => ({
              ...point,
            }),
          ),

        powerUp:
          null,

        activePowerUp:
          null,

        activePowerUpTicksLeft:
          0,

        isGameOver:
          false,

        isPaused:
          false,

        isCompleted:
          false,

        score:
          0,

        foodCount:
          0,

        growthProgress:
          0,

        levelId:
          levelConfig.id,

        tick:
          0,
      },

      randomStep:
        firstFood.randomStep,
    };
  };


const getNextHead =
  (
    head:
      Point,

    direction:
      Direction,
  ): Point => {

    const next = {
      ...head,
    };


    if (
      direction ===
      Direction.UP
    ) {
      next.y -=
        1;
    }


    if (
      direction ===
      Direction.DOWN
    ) {
      next.y +=
        1;
    }


    if (
      direction ===
      Direction.LEFT
    ) {
      next.x -=
        1;
    }


    if (
      direction ===
      Direction.RIGHT
    ) {
      next.x +=
        1;
    }


    return next;
  };


const getPowerDurationTicks =
  (
    type:
      PowerUpType,
  ) => {

    return (
      POWER_UPS.find(
        (
          power,
        ) =>
          power.type ===
          type,
      )
        ?.durationTicks ??
      0
    );
  };


const moveFoodTowardSnake =
  (
    food:
      Food,

    head:
      Point,

    snake:
      Point[],

    obstacles:
      Point[],
  ): Food => {

    const fx =
      food.pos.x;

    const fy =
      food.pos.y;


    const distance =
      Math.abs(
        head.x -
          fx,
      ) +
      Math.abs(
        head.y -
          fy,
      );


    if (
      distance ===
        0 ||
      distance >
        MAGNET_RADIUS
    ) {
      return food;
    }


    let nextX =
      fx;

    let nextY =
      fy;


    if (
      head.x !==
      fx
    ) {
      nextX +=
        head.x >
        fx
          ? 1
          : -1;

    } else if (
      head.y !==
      fy
    ) {
      nextY +=
        head.y >
        fy
          ? 1
          : -1;
    }


    const nextPoint = {
      x:
        nextX,

      y:
        nextY,
    };


    const outside =
      nextX <
        0 ||
      nextX >=
        GRID_SIZE ||
      nextY <
        0 ||
      nextY >=
        GRID_SIZE;


    if (
      outside
    ) {
      return food;
    }


    const blocked =
      snake.some(
        (
          point,
        ) =>
          samePoint(
            point,
            nextPoint,
          ),
      ) ||
      obstacles.some(
        (
          point,
        ) =>
          samePoint(
            point,
            nextPoint,
          ),
      );


    if (
      blocked
    ) {
      return food;
    }


    return {
      ...food,

      pos:
        nextPoint,
    };
  };


/*
 * =====================================================
 * ADVANCE ONE DETERMINISTIC GAME TICK
 * =====================================================
 */
export const advanceSnakeTick =
  (
    state:
      SnakeGameState,

    seed:
      number,

    randomStep:
      number,
  ): SnakeTickResult => {

    if (
  state.isGameOver ||
  state.isPaused
) {
  return {
    state,

    randomStep,

    ateFood:
      false,

    collectedPowerUp:
      false,

    completed:
      false,

    gameOver:
      state.isGameOver,
  };
}


    const nextTick =
      state.tick +
      1;


    const direction =
      state.nextDirection;


    const currentHead =
      state.snake[
        0
      ];


    let newHead =
      getNextHead(
        currentHead,
        direction,
      );


    /*
     * -------------------------------------------------
     * WARP
     * -------------------------------------------------
     */
    let hitWall =
      newHead.x <
        0 ||
      newHead.x >=
        GRID_SIZE ||
      newHead.y <
        0 ||
      newHead.y >=
        GRID_SIZE;


    if (
      state.activePowerUp ===
      PowerUpType.WARP
    ) {

      if (
        newHead.x <
        0
      ) {
        newHead.x =
          GRID_SIZE -
          1;
      }


      if (
        newHead.x >=
        GRID_SIZE
      ) {
        newHead.x =
          0;
      }


      if (
        newHead.y <
        0
      ) {
        newHead.y =
          GRID_SIZE -
          1;
      }


      if (
        newHead.y >=
        GRID_SIZE
      ) {
        newHead.y =
          0;
      }


      hitWall =
        false;
    }


    const hitObstacle =
      state.obstacles.some(
        (
          obstacle,
        ) =>
          samePoint(
            obstacle,
            newHead,
          ),
      );


    const hitSelf =
      state.activePowerUp ===
      PowerUpType.GHOST
        ? false
        : state.snake.some(
            (
              part,
            ) =>
              samePoint(
                part,
                newHead,
              ),
          );


    /*
     * -------------------------------------------------
     * COLLISION
     * -------------------------------------------------
     */
    if (
      hitWall ||
      hitObstacle ||
      hitSelf
    ) {

      /*
       * Shield absorbs exactly one collision.
       */
      if (
        state.activePowerUp ===
        PowerUpType.SHIELD
      ) {

        return {
          state: {
            ...state,

            activePowerUp:
              null,

            activePowerUpTicksLeft:
              0,

            tick:
              nextTick,
          },

          randomStep,

          ateFood:
            false,

          collectedPowerUp:
            false,

          completed:
            false,

          gameOver:
            false,
        };
      }


      return {
        state: {
          ...state,

          direction,

          nextDirection:
            direction,

          isGameOver:
            true,

          isPaused:
            false,

          tick:
            nextTick,
        },

        randomStep,

        ateFood:
          false,

        collectedPowerUp:
          false,

        completed:
          false,

        gameOver:
          true,
      };
    }


    /*
     * -------------------------------------------------
     * POWER-UP TIMERS
     * -------------------------------------------------
     */
    let nextActivePowerUp =
      state.activePowerUp;


    let nextActivePowerUpTicksLeft =
      state.activePowerUpTicksLeft;


    /*
     * Shield remains active until collision.
     *
     * Other timed power-ups count down normally.
     */
    if (
      nextActivePowerUp &&
      nextActivePowerUp !==
        PowerUpType.SHIELD
    ) {

      nextActivePowerUpTicksLeft =
        Math.max(
          0,
          nextActivePowerUpTicksLeft -
            1,
        );


      if (
        nextActivePowerUpTicksLeft ===
        0
      ) {
        nextActivePowerUp =
          null;
      }
    }


    /*
     * Existing board power-up countdown.
     *
     * FREEZE pauses the board-item timer,
     * while FREEZE itself continues to expire.
     */
    let nextPowerUp =
      state.powerUp;


    if (
      nextPowerUp &&
      state.activePowerUp !==
        PowerUpType.FREEZE
    ) {

      const remaining =
        nextPowerUp.remainingTicks -
        1;


      nextPowerUp =
        remaining >
        0
          ? {
              ...nextPowerUp,

              remainingTicks:
                remaining,
            }
          : null;
    }


    let newSnake = [
      newHead,
      ...state.snake,
    ];


    let nextFood =
      state.food;


    let nextScore =
      state.score;


    let nextFoodCount =
      state.foodCount;


    let nextProgress =
      state.growthProgress;


    let nextRandomStep =
      randomStep;


    let ateFood =
      false;


    let collectedPowerUp =
      false;


    /*
     * -------------------------------------------------
     * MAGNET
     * -------------------------------------------------
     */
    if (
      nextFood &&
      nextActivePowerUp ===
        PowerUpType.MAGNET
    ) {

      nextFood =
        moveFoodTowardSnake(
          nextFood,
          newHead,
          state.snake,
          state.obstacles,
        );
    }


    /*
     * -------------------------------------------------
     * FOOD
     * -------------------------------------------------
     */
    const foodWasEaten =
      nextFood !==
        null &&
      samePoint(
        newHead,
        nextFood.pos,
      );


    if (
      foodWasEaten &&
      nextFood
    ) {

      ateFood =
        true;


      const wasBonus =
        nextFood.isBonus;


      let addPoints =
        wasBonus
          ? BONUS_FOOD_POINTS
          : NORMAL_FOOD_POINTS;


      let addPercent =
        wasBonus
          ? BONUS_FOOD_PERCENT
          : NORMAL_FOOD_PERCENT;


      /*
       * Double Points affects gameplay score/progress.
       *
       * It NEVER multiplies real cash or diamonds.
       */
      if (
        !wasBonus &&
        nextActivePowerUp ===
          PowerUpType.DOUBLE_POINTS
      ) {

        addPoints *=
          2;

        addPercent *=
          2;
      }


      nextScore +=
        addPoints;


      nextFoodCount +=
        1;


      nextProgress =
        Math.min(
          1,
          nextProgress +
            addPercent /
              100,
        );


      /*
       * Bonus food itself does not grow the snake.
       */
      const growthAmount =
        wasBonus
          ? 0
          : nextActivePowerUp ===
              PowerUpType.GROWTH_BOOST
            ? 2
            : 1;


      if (
        growthAmount ===
        0
      ) {

        newSnake.pop();

      } else {

        for (
          let extra =
            1;

          extra <
          growthAmount;

          extra +=
            1
        ) {

          const tail =
            newSnake[
              newSnake.length -
              1
            ];


          newSnake.push({
            ...tail,
          });
        }
      }


      /*
       * Every 5th pickup causes the NEXT food
       * to become bonus food, unless the food
       * just eaten was itself already bonus.
       */
      const nextIsBonus =
        nextFoodCount %
          BONUS_FOOD_EVERY ===
          0 &&
        !wasBonus;


      const spawnedFood =
        spawnFood(
          seed,
          nextRandomStep,
          newSnake,
          state.obstacles,
          nextPowerUp,
          nextIsBonus,
        );


      nextFood =
        spawnedFood.food;


      nextRandomStep =
        spawnedFood.randomStep;

    } else {

      /*
       * Normal movement:
       * remove the old tail.
       */
      newSnake.pop();
    }


    /*
     * -------------------------------------------------
     * COLLECT POWER-UP
     * -------------------------------------------------
     */
    if (
      nextPowerUp &&
      samePoint(
        newHead,
        nextPowerUp.pos,
      )
    ) {

      collectedPowerUp =
        true;


      const collectedType =
        nextPowerUp.type;


      if (
        collectedType ===
        PowerUpType.REDUCTION
      ) {

        /*
         * Shrink immediately.
         *
         * Always keep at least one segment.
         */
        newSnake =
          newSnake.slice(
            0,
            Math.max(
              1,
              newSnake.length -
                5,
            ),
          );

      } else if (
        collectedType ===
        PowerUpType.SHIELD
      ) {

        nextActivePowerUp =
          PowerUpType.SHIELD;

        nextActivePowerUpTicksLeft =
          0;

      } else {

        nextActivePowerUp =
          collectedType;

        nextActivePowerUpTicksLeft =
          getPowerDurationTicks(
            collectedType,
          );
      }


      nextPowerUp =
        null;
    }


    /*
 * -------------------------------------------------
 * 50% REWARD MILESTONE
 * -------------------------------------------------
 *
 * Reaching 50% no longer ends the Snake run.
 *
 * `completed` becomes true only on the exact
 * deterministic tick where the player crosses
 * from below 50% to 50% or above.
 *
 * The UI/backend can use that exact tick for the
 * one-time reward verification while gameplay
 * continues normally.
 */
const completed =
  state.growthProgress <
    SNAKE_COMPLETE_PERCENT /
      100 &&
  nextProgress >=
    SNAKE_COMPLETE_PERCENT /
      100;


    /*
     * -------------------------------------------------
     * POWER-UP SPAWN
     * -------------------------------------------------
     *
     * Only attempt to spawn when there isn't
     * already one on the board.
     */
    if (
      !nextPowerUp
    ) {

      const spawned =
        spawnPowerUp(
          seed,
          nextRandomStep,
          newSnake,
          state.obstacles,
          nextFood,
        );


      nextPowerUp =
        spawned.powerUp;


      nextRandomStep =
        spawned.randomStep;
    }


    return {
  state: {
    ...state,

    snake:
      newSnake,

    direction,

    nextDirection:
      direction,

    food:
      nextFood,

    powerUp:
      nextPowerUp,

    activePowerUp:
      nextActivePowerUp,

    activePowerUpTicksLeft:
      nextActivePowerUpTicksLeft,

    score:
      nextScore,

    foodCount:
      nextFoodCount,

    growthProgress:
      nextProgress,

    /*
     * 50% is not a terminal state anymore.
     */
    isCompleted:
      false,

    tick:
      nextTick,
  },

  randomStep:
    nextRandomStep,

  ateFood,

  collectedPowerUp,

  completed,

  gameOver:
    false,
};
  };


export const getSnakeProgressPercent =
  (
    state:
      SnakeGameState,
  ) =>
    Math.min(
      100,
      Math.max(
        0,
        Math.round(
          state.growthProgress *
            100,
        ),
      ),
    );