/*
 * =====================================================
 * FLAPPY ROCKET WORLD
 * =====================================================
 */

export const FLAPPY_GAME_WIDTH =
  400;


export const FLAPPY_GAME_HEIGHT =
  700;


export const FLAPPY_PLAYER_X =
  92;


export const FLAPPY_PLAYER_SIZE =
  30;


/*
 * =====================================================
 * DETERMINISTIC TICK RATE
 * =====================================================
 *
 * Gameplay runs using fixed simulation ticks.
 *
 * 60 ticks = approximately 1 second.
 *
 * Frontend and backend must use these exact
 * same values.
 */
export const FLAPPY_TICKS_PER_SECOND =
  60;


export const FLAPPY_TICK_MS =
  1000 /
  FLAPPY_TICKS_PER_SECOND;


/*
 * =====================================================
 * PHYSICS
 * =====================================================
 *
 * These match the feel of the original
 * Flappy Rocket.
 *
 * They are applied once per deterministic
 * simulation tick.
 */
export const FLAPPY_GRAVITY =
  0.34;


export const FLAPPY_FLAP_FORCE =
  -5.6;


/*
 * Maximum velocity protection.
 */
export const FLAPPY_MIN_VELOCITY =
  -9;


export const FLAPPY_MAX_VELOCITY =
  9;


/*
 * =====================================================
 * OBSTACLE GAP LIMITS
 * =====================================================
 */

export const FLAPPY_MIN_GAP_CENTER =
  175;


export const FLAPPY_MAX_GAP_CENTER =
  FLAPPY_GAME_HEIGHT -
  175;


/*
 * =====================================================
 * REWARD
 * =====================================================
 *
 * Score = number of successfully passed gates.
 *
 * Reaching 50 is the one-time reward milestone.
 *
 * Gameplay continues after the milestone.
 */
export const FLAPPY_REWARD_SCORE =
  50;


export const FLAPPY_REWARD_PAISE =
  5;


export const FLAPPY_DIAMOND_REWARD =
  10;


/*
 * =====================================================
 * REVIVE
 * =====================================================
 *
 * One rewarded-ad revive is allowed per run.
 */
export const FLAPPY_MAX_REVIVES =
  1;


/*
 * On revive, give the player a small
 * upward velocity so they do not
 * immediately fall again.
 */
export const FLAPPY_REVIVE_VELOCITY =
  -2.2;


/*
 * Shift existing obstacles slightly
 * forward when reviving.
 *
 * This gives the player a small safe
 * recovery window.
 */
export const FLAPPY_REVIVE_OBSTACLE_SHIFT =
  28;


/*
 * =====================================================
 * DIFFICULTY
 * =====================================================
 */

export interface FlappyDifficultyConfig {
  gapHeight: number;

  /*
   * Number of deterministic ticks
   * between obstacle spawns.
   */
  spawnTicks: number;

  /*
   * Pixels moved every deterministic tick.
   */
  obstacleSpeed: number;

  obstacleWidth: number;
}


/*
 * 3200 ms @ 60Hz ≈ 192 ticks.
 *
 * 2900 ms @ 60Hz ≈ 174 ticks.
 *
 * 2600 ms @ 60Hz ≈ 156 ticks.
 *
 * This keeps the original game's
 * difficulty progression while removing
 * dependency on Date.now()/requestAnimationFrame
 * timing for gameplay.
 */
export const getFlappyDifficultyConfig =
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