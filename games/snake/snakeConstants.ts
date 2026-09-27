import {
  Direction,
  PowerUpType,
  type LevelConfig,
  type Point,
} from "./snakeTypes";


export const GRID_SIZE =
  20;


/*
 * GenZSnake completion:
 *
 * Reach 50% growth in one valid run.
 */
export const SNAKE_COMPLETE_PERCENT =
  50;


/*
 * Normal food:
 *
 * +1 score
 * +1% growth
 */
export const NORMAL_FOOD_POINTS =
  1;

export const NORMAL_FOOD_PERCENT =
  1;


/*
 * Bonus food:
 *
 * +5 score
 * +5% growth
 */
export const BONUS_FOOD_POINTS =
  5;

export const BONUS_FOOD_PERCENT =
  5;


/*
 * Every 5 normal/bonus pickups,
 * the next spawned food may become bonus food.
 */
export const BONUS_FOOD_EVERY =
  5;


/*
 * GenZGames real reward.
 *
 * Backend remains authoritative.
 */
export const SNAKE_REWARD_PAISE =
  5;

export const SNAKE_DIAMOND_REWARD =
  10;


/*
 * Maximum level.
 *
 * No level documents are stored in Firebase.
 * Difficulty is generated locally from
 * the level number.
 */
export const SNAKE_MAX_LEVEL =
  1000;


/*
 * Used by Magnet power-up.
 */
export const MAGNET_RADIUS =
  7;


/*
 * Deterministic power-up configuration.
 *
 * Durations are in game ticks,
 * not milliseconds.
 *
 * This keeps frontend/backend replay identical.
 */
export const POWER_UPS = [
  {
    type:
      PowerUpType.SHIELD,

    name:
      "Shield",

    description:
      "Blocks one collision",

    icon:
      "🛡️",

    durationTicks:
      0,
  },

  {
    type:
      PowerUpType.SLOW_MO,

    name:
      "Slow",

    description:
      "Snake moves slower",

    icon:
      "🐌",

    durationTicks:
      45,
  },

  {
    type:
      PowerUpType.MAGNET,

    name:
      "Magnet",

    description:
      "Pulls nearby food",

    icon:
      "🧲",

    durationTicks:
      60,
  },

  {
    type:
      PowerUpType.GROWTH_BOOST,

    name:
      "Growth+",

    description:
      "Normal food grows +2",

    icon:
      "⚡",

    durationTicks:
      45,
  },

  {
    type:
      PowerUpType.DOUBLE_POINTS,

    name:
      "Double",

    description:
      "Normal food gives double progress",

    icon:
      "💎",

    durationTicks:
      40,
  },

  {
    type:
      PowerUpType.GHOST,

    name:
      "Ghost",

    description:
      "Pass through your own body",

    icon:
      "👻",

    durationTicks:
      40,
  },

  {
    type:
      PowerUpType.WARP,

    name:
      "Warp",

    description:
      "Wrap through walls",

    icon:
      "🌀",

    durationTicks:
      40,
  },

  {
    type:
      PowerUpType.FREEZE,

    name:
      "Freeze",

    description:
      "Freezes power-up countdown briefly",

    icon:
      "❄️",

    durationTicks:
      12,
  },

  {
    type:
      PowerUpType.REDUCTION,

    name:
      "Shrink",

    description:
      "Removes up to 5 snake segments",

    icon:
      "✂️",

    durationTicks:
      0,
  },
] as const;


/*
 * Deterministic obstacle generator.
 *
 * Same level number always produces
 * the same obstacle layout.
 *
 * No Firebase read is required.
 */
const createObstaclePoint =
  (
    level:
      number,

    index:
      number,
  ): Point => {

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


export const generateSnakeLevel =
  (
    level:
      number,
  ): LevelConfig => {

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
     * Keep difficulty inside the proven
     * Level 1 -> 100 range.
     *
     * Examples:
     *
     * Level 1    -> difficulty 1
     * Level 100  -> difficulty 100
     * Level 101  -> difficulty 1
     * Level 200  -> difficulty 100
     * Level 501  -> difficulty 1
     * Level 1000 -> difficulty 100
     *
     * The REAL safeLevel is still used for
     * obstacle generation, so later levels
     * receive different layouts.
     *
     * Existing Levels 1-100 remain exactly
     * compatible with the current game.
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


    /*
     * Level 1 starts at 200ms per movement.
     *
     * Speed gradually increases.
     *
     * Minimum remains 80ms.
     */
    const initialSpeed =
      Math.max(
        80,
        Math.round(
          200 -
            difficultyLevel *
              1.2,
        ),
      );


    /*
     * Add roughly one obstacle
     * every 4 levels.
     *
     * Hard cap = 20 obstacles.
     */
    const obstacleCount =
      Math.min(
        20,
        Math.floor(
          difficultyLevel /
            4,
        ),
      );


    const obstacles:
      Point[] =
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


      /*
       * Keep the starting area clear.
       */
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

      gridSize:
        GRID_SIZE,

      initialSpeed,

      obstacles,
    };
  };


/*
 * Initial Snake direction.
 *
 * Kept here so frontend and backend
 * use the same starting rules.
 */
export const INITIAL_DIRECTION =
  Direction.RIGHT;


/*
 * Starting Snake body.
 *
 * Keep this away from level obstacles.
 */
export const INITIAL_SNAKE:
  Point[] = [
    {
      x:
        5,

      y:
        10,
    },
  ];