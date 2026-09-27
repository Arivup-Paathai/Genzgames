export type GenZSnakeDirection =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT";


export type GenZSnakePowerUpType =
  | "SHIELD"
  | "SLOW_MO"
  | "MAGNET"
  | "GROWTH_BOOST"
  | "REDUCTION"
  | "GHOST"
  | "WARP"
  | "DOUBLE_POINTS"
  | "FREEZE";


export interface GenZSnakePoint {
  x: number;

  y: number;
}


interface GenZSnakeFood {
  pos:
    GenZSnakePoint;

  isBonus:
    boolean;
}


interface GenZSnakePowerUpItem {
  pos:
    GenZSnakePoint;

  type:
    GenZSnakePowerUpType;

  remainingTicks:
    number;
}


interface GenZSnakeState {
  snake:
    GenZSnakePoint[];

  direction:
    GenZSnakeDirection;

  nextDirection:
    GenZSnakeDirection;

  food:
    GenZSnakeFood |
    null;

  obstacles:
    GenZSnakePoint[];

  powerUp:
    GenZSnakePowerUpItem |
    null;

  activePowerUp:
    GenZSnakePowerUpType |
    null;

  activePowerUpTicksLeft:
    number;

  isGameOver:
    boolean;

  isPaused:
    boolean;

  isCompleted:
    boolean;

  score:
    number;

  foodCount:
    number;

  growthProgress:
    number;

  levelId:
    number;

  tick:
    number;
}


interface GenZSnakeTickResult {
  state:
    GenZSnakeState;

  randomStep:
    number;

  completed:
    boolean;

  gameOver:
    boolean;
}


export interface GenZSnakeDirectionEvent {
  tick: number;

  direction:
    GenZSnakeDirection;
}


export interface ReplayGenZSnakeRunInput {
  seed: number;

  level: number;

  tickCount: number;

  directionEvents:
    GenZSnakeDirectionEvent[];
}


export interface ReplayGenZSnakeRunResult {
  completed: boolean;

  gameOver: boolean;

  completionTick:
    number |
    null;

  gameOverTick:
    number |
    null;

  score: number;

  growthPercent: number;

  foodCount: number;

  snakeLength: number;

  finalTick: number;

  randomStep: number;

  level: number;
}


/*
 * Prevent malicious requests from forcing
 * extremely large backend replay loops.
 */
export const GENZ_SNAKE_MAX_REPLAY_TICKS =
  20000;


export const GENZ_SNAKE_MAX_DIRECTION_EVENTS =
  10000;


const GRID_SIZE =
  20;


const SNAKE_COMPLETE_PERCENT =
  50;


const NORMAL_FOOD_POINTS =
  1;


const NORMAL_FOOD_PERCENT =
  1;


const BONUS_FOOD_POINTS =
  5;


const BONUS_FOOD_PERCENT =
  5;


const BONUS_FOOD_EVERY =
  5;


const SNAKE_MAX_LEVEL =

  1000;


const MAGNET_RADIUS =
  7;


const POWER_UP_SPAWN_CHANCE =
  0.005;


const POWER_UP_BOARD_TTL_TICKS =
  100;


const INITIAL_DIRECTION:
GenZSnakeDirection =
  "RIGHT";


const INITIAL_SNAKE:
GenZSnakePoint[] = [
  {
    x:
      5,

    y:
      10,
  },
];


const POWER_UPS: {
  type:
    GenZSnakePowerUpType;

  durationTicks:
    number;
}[] = [
  {
    type:
      "SHIELD",

    durationTicks:
      0,
  },

  {
    type:
      "SLOW_MO",

    durationTicks:
      45,
  },

  {
    type:
      "MAGNET",

    durationTicks:
      60,
  },

  {
    type:
      "GROWTH_BOOST",

    durationTicks:
      45,
  },

  {
    type:
      "DOUBLE_POINTS",

    durationTicks:
      40,
  },

  {
    type:
      "GHOST",

    durationTicks:
      40,
  },

  {
    type:
      "WARP",

    durationTicks:
      40,
  },

  {
    type:
      "FREEZE",

    durationTicks:
      12,
  },

  {
    type:
      "REDUCTION",

    durationTicks:
      0,
  },
];


/*
 * =====================================================
 * DETERMINISTIC RANDOM
 * =====================================================
 *
 * Must remain identical to:
 *
 * src/games/snake/snakeEngine.ts
 */
const snakeRandomAtStep =
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
      GenZSnakePoint,

    second:
      GenZSnakePoint,
  ) =>
    first.x ===
      second.x &&
    first.y ===
      second.y;


const getFreeCells =
  (
    excluded:
      GenZSnakePoint[],
  ): GenZSnakePoint[] => {

    const cells:
      GenZSnakePoint[] =
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
      GenZSnakePoint[],
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
          null as
            GenZSnakePoint |
            null,

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


const createObstaclePoint =
  (
    level:
      number,

    index:
      number,
  ): GenZSnakePoint => {

    const seed =
      level *
        1337 +
      index *
        7919;


    const rawX =
      Math.abs(
        Math.sin(
          seed,
        ),
      );


    const rawY =
      Math.abs(
        Math.cos(
          seed *
            1.37,
        ),
      );


    const x =
      Math.floor(
        rawX *
          (
            GRID_SIZE -
            4
          ),
      ) +
      2;


    const y =
      Math.floor(
        rawY *
          (
            GRID_SIZE -
            4
          ),
      ) +
      2;


    return {
      x,
      y,
    };
  };


const generateSnakeLevel =
  (
    level:
      number,
  ) => {

        const safeLevel =

      Math.max(

        1,

        Math.min(

          SNAKE_MAX_LEVEL,

          Math.floor(

            level,

          ),

        ),

      );





    /*
     * Difficulty repeats through the
     * proven Level 1 -> 100 range.
     *
     * The REAL safeLevel is still used
     * for obstacle positions so Levels
     * 101-1000 receive unique layouts.
     */
    const difficultyLevel =

      (

        (

          safeLevel -

          1

        ) %

        100

      ) +

      1;





       const obstacleCount =

      Math.min(

        20,

        Math.floor(

          difficultyLevel /

            4,

        ),

      );


    const obstacles:
      GenZSnakePoint[] =
      [];


    for (
      let index =
        0;

      index <
      obstacleCount;

      index +=
        1
    ) {

      const candidate =
        createObstaclePoint(
          safeLevel,
          index,
        );


      const insideStartArea =
        candidate.x >=
          3 &&
        candidate.x <=
          8 &&
        candidate.y >=
          7 &&
        candidate.y <=
          13;


      if (
        insideStartArea
      ) {
        continue;
      }


      const duplicate =
        obstacles.some(
          (
            obstacle,
          ) =>
            obstacle.x ===
              candidate.x &&
            obstacle.y ===
              candidate.y,
        );


      if (
        duplicate
      ) {
        continue;
      }


      obstacles.push(
        candidate,
      );
    }


    return {
      id:
        safeLevel,

      obstacles,
    };
  };


const spawnFood =
  (
    seed:
      number,

    randomStep:
      number,

    snake:
      GenZSnakePoint[],

    obstacles:
      GenZSnakePoint[],

    powerUp:
      GenZSnakePowerUpItem |
      null,

    isBonus:
      boolean,
  ) => {

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
      GenZSnakePoint[],

    obstacles:
      GenZSnakePoint[],

    food:
      GenZSnakeFood |
      null,
  ) => {

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
          null as
            GenZSnakePowerUpItem |
            null,

        randomStep:
          nextRandomStep,
      };
    }


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


const isOppositeDirection =
  (
    current:
      GenZSnakeDirection,

    next:
      GenZSnakeDirection,
  ) => {

    return (
      (
        current ===
          "UP" &&
        next ===
          "DOWN"
      ) ||
      (
        current ===
          "DOWN" &&
        next ===
          "UP"
      ) ||
      (
        current ===
          "LEFT" &&
        next ===
          "RIGHT"
      ) ||
      (
        current ===
          "RIGHT" &&
        next ===
          "LEFT"
      )
    );
  };


const applySnakeDirection =
  (
    state:
      GenZSnakeState,

    direction:
      GenZSnakeDirection,
  ): GenZSnakeState => {

    if (
      state.isGameOver ||
      state.isCompleted
    ) {

      return state;
    }


    if (
      isOppositeDirection(
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


const createInitialSnakeState =
  (
    level:
      number,

    seed:
      number,
  ) => {

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


    const state:
      GenZSnakeState = {

        snake:
          initialSnake,

        direction:
          INITIAL_DIRECTION,

        nextDirection:
          INITIAL_DIRECTION,

        food:
          firstFood.food,

        obstacles:
          levelConfig
            .obstacles
            .map(
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
      };


    return {
      state,

      randomStep:
        firstFood.randomStep,
    };
  };


const getNextHead =
  (
    head:
      GenZSnakePoint,

    direction:
      GenZSnakeDirection,
  ): GenZSnakePoint => {

    const next = {
      ...head,
    };


    if (
      direction ===
      "UP"
    ) {

      next.y -=
        1;
    }


    if (
      direction ===
      "DOWN"
    ) {

      next.y +=
        1;
    }


    if (
      direction ===
      "LEFT"
    ) {

      next.x -=
        1;
    }


    if (
      direction ===
      "RIGHT"
    ) {

      next.x +=
        1;
    }


    return next;
  };


const getPowerDurationTicks =
  (
    type:
      GenZSnakePowerUpType,
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
      GenZSnakeFood,

    head:
      GenZSnakePoint,

    snake:
      GenZSnakePoint[],

    obstacles:
      GenZSnakePoint[],
  ): GenZSnakeFood => {

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


const advanceSnakeTick =
  (
    state:
      GenZSnakeState,

    seed:
      number,

    randomStep:
      number,
  ): GenZSnakeTickResult => {

    if (
      state.isGameOver ||
      state.isCompleted ||
      state.isPaused
    ) {

      return {
        state,

        randomStep,

        completed:
          state.isCompleted,

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
      "WARP"
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
      "GHOST"
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


    if (
      hitWall ||
      hitObstacle ||
      hitSelf
    ) {

      if (
        state.activePowerUp ===
        "SHIELD"
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

        completed:
          false,

        gameOver:
          true,
      };
    }


    let nextActivePowerUp =
      state.activePowerUp;


    let nextActivePowerUpTicksLeft =
      state.activePowerUpTicksLeft;


    if (
      nextActivePowerUp &&
      nextActivePowerUp !==
        "SHIELD"
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


    let nextPowerUp =
      state.powerUp;


    if (
      nextPowerUp &&
      state.activePowerUp !==
        "FREEZE"
    ) {

      const remaining =
        nextPowerUp
          .remainingTicks -
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


    if (
      nextFood &&
      nextActivePowerUp ===
        "MAGNET"
    ) {

      nextFood =
        moveFoodTowardSnake(
          nextFood,
          newHead,
          state.snake,
          state.obstacles,
        );
    }


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


      if (
        !wasBonus &&
        nextActivePowerUp ===
          "DOUBLE_POINTS"
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


      const growthAmount =
        wasBonus
          ? 0
          : nextActivePowerUp ===
              "GROWTH_BOOST"
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

      newSnake.pop();
    }


    if (
      nextPowerUp &&
      samePoint(
        newHead,
        nextPowerUp.pos,
      )
    ) {

      const collectedType =
        nextPowerUp.type;


      if (
        collectedType ===
        "REDUCTION"
      ) {

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
        "SHIELD"
      ) {

        nextActivePowerUp =
          "SHIELD";


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


    const completed =
      nextProgress >=
      SNAKE_COMPLETE_PERCENT /
        100;


    if (
      completed
    ) {

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

          isCompleted:
            true,

          isGameOver:
            false,

          isPaused:
            true,

          tick:
            nextTick,
        },

        randomStep:
          nextRandomStep,

        completed:
          true,

        gameOver:
          false,
      };
    }


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

        tick:
          nextTick,
      },

      randomStep:
        nextRandomStep,

      completed:
        false,

      gameOver:
        false,
    };
  };


export const isGenZSnakeDirection =
  (
    value:
      unknown,
  ): value is GenZSnakeDirection => {

    return (
      value ===
        "UP" ||
      value ===
        "DOWN" ||
      value ===
        "LEFT" ||
      value ===
        "RIGHT"
    );
  };


/*
 * =====================================================
 * FULL SERVER REPLAY
 * =====================================================
 *
 * Input:
 *
 * seed
 * level
 * tickCount
 * direction events
 *
 * No client score/progress is trusted.
 */
export const replayGenZSnakeRun =
  (
    input:
      ReplayGenZSnakeRunInput,
  ): ReplayGenZSnakeRunResult => {

    if (
      !Number.isInteger(
        input.tickCount,
      ) ||
      input.tickCount <
        1 ||
      input.tickCount >
        GENZ_SNAKE_MAX_REPLAY_TICKS
    ) {

      throw new Error(
        "Invalid Snake tick count.",
      );
    }


    const initial =
      createInitialSnakeState(
        input.level,
        input.seed,
      );


    let state =
      initial.state;


    let randomStep =
      initial.randomStep;


    let eventIndex =
      0;


    let completionTick:
      number |
      null =
      null;


    let gameOverTick:
      number |
      null =
      null;


    for (
      let tick =
        1;

      tick <=
      input.tickCount;

      tick +=
        1
    ) {

      while (
        eventIndex <
          input.directionEvents.length &&
        input.directionEvents[
          eventIndex
        ].tick ===
          tick
      ) {

        state =
          applySnakeDirection(
            state,
            input
              .directionEvents[
                eventIndex
              ]
              .direction,
          );


        eventIndex +=
          1;
      }


      const result =
        advanceSnakeTick(
          state,
          input.seed,
          randomStep,
        );


      state =
        result.state;


      randomStep =
        result.randomStep;


      if (
        result.completed
      ) {

        completionTick =
          state.tick;


        break;
      }


      if (
        result.gameOver
      ) {

        gameOverTick =
          state.tick;


        break;
      }
    }


    return {
      completed:
        state.isCompleted,

      gameOver:
        state.isGameOver,

      completionTick,

      gameOverTick,

      score:
        state.score,

      growthPercent:
        Math.min(
          100,
          Math.max(
            0,
            Math.round(
              state.growthProgress *
                100,
            ),
          ),
        ),

      foodCount:
        state.foodCount,

      snakeLength:
        state.snake.length,

      finalTick:
        state.tick,

      randomStep,

      level:
        state.levelId,
    };
  };