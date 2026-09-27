/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER TYPES
 * =========================================================
 *
 * Reward design:
 *
 * - 200 playable levels.
 * - Any unlocked level can be replayed.
 * - Every NEW earning run requires a rewarded ad.
 * - Player starts with 3 lives.
 * - Reach 50% of total brick HP:
 *      ₹0.05 + 10 diamonds
 * - 50% does NOT end the level.
 * - Player continues toward 100%.
 * - 100% clears the level.
 * - Clearing the current frontier unlocks the next level.
 * - Same level can earn again in a brand-new rewarded run.
 *
 * Gameplay verification:
 *
 * - Fixed deterministic ticks.
 * - Paddle movements are recorded against ticks.
 * - Ball launch events are recorded against ticks.
 * - Backend can replay the same run.
 * - Client never decides cash/diamond rewards.
 */


/*
 * =========================================================
 * BASIC GEOMETRY
 * =========================================================
 *
 * All gameplay coordinates are INTEGER fixed-point values.
 *
 * The actual scale is defined in:
 *
 * brickBreakerConstants.ts
 *
 * Example:
 *
 * scale = 100
 *
 * 1 screen unit = 100 engine units.
 *
 * We intentionally avoid relying on animation-frame
 * floating-point timing for reward verification.
 */

export interface BrickBreakerPoint {
  x:
    number;

  y:
    number;
}


export interface BrickBreakerSize {
  width:
    number;

  height:
    number;
}


/*
 * =========================================================
 * BRICK
 * =========================================================
 */

export interface BrickBreakerBrick {
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

  /*
   * Visual color identifier.
   *
   * This must never affect rewards or collision behavior.
   */
  hue:
    number;
}


/*
 * =========================================================
 * PADDLE
 * =========================================================
 */

export interface BrickBreakerPaddle {
  x:
    number;

  y:
    number;

  width:
    number;

  height:
    number;
}


/*
 * =========================================================
 * BALL
 * =========================================================
 */

export interface BrickBreakerBall {
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


/*
 * =========================================================
 * LEVEL CONFIG
 * =========================================================
 */

export interface BrickBreakerLevelConfig {
  id:
    number;

  rows:
    number;

  columns:
    number;

  paddleWidth:
    number;

  /*
   * Deterministic starting ball speed.
   *
   * Engine units per fixed tick.
   */
  ballSpeed:
    number;

  /*
   * Total HP of every brick at the beginning
   * of this level.
   */
  totalBrickHp:
    number;

  /*
   * HP which must be removed before this run
   * reaches its reward milestone.
   *
   * Normally:
   *
   * ceil(totalBrickHp * 0.50)
   */
  rewardBrickHp:
    number;
}


/*
 * =========================================================
 * GAME STATE
 * =========================================================
 */

export interface BrickBreakerGameState {
  levelId:
    number;

  /*
   * Deterministic simulation tick.
   */
  tick:
    number;

  score:
    number;

  lives:
    number;

  paddle:
    BrickBreakerPaddle;

  ball:
    BrickBreakerBall;

  bricks:
    BrickBreakerBrick[];

  /*
   * Sum of all original brick HP.
   */
  totalBrickHp:
    number;

  /*
   * Total HP removed during this run.
   *
   * Example:
   *
   * 3 HP brick:
   *
   * 3 -> 2 = +1
   * 2 -> 1 = +1
   * 1 -> 0 = +1
   */
  destroyedBrickHp:
    number;

  /*
   * Ball remains attached to the paddle until
   * a deterministic LAUNCH event occurs.
   */
  ballLaunched:
    boolean;

  isPaused:
    boolean;

  isGameOver:
    boolean;

  /*
   * True only after every brick HP reaches zero.
   */
  isLevelCleared:
    boolean;
}


/*
 * =========================================================
 * PLAYER INPUT EVENTS
 * =========================================================
 *
 * Only reward-relevant player input is recorded.
 *
 * We do NOT save animation frames, touch coordinates,
 * particles or visual effects.
 */


/*
 * Paddle X represents the desired paddle CENTER X
 * inside the deterministic game coordinate system.
 *
 * UI should quantize and deduplicate these events so
 * we do not create a huge verification payload.
 */
export interface BrickBreakerPaddleInputEvent {
  type:
    "PADDLE";

  tick:
    number;

  centerX:
    number;
}


/*
 * Used when:
 *
 * - Starting the first ball.
 * - Relaunching after losing a life.
 */
export interface BrickBreakerLaunchInputEvent {
  type:
    "LAUNCH";

  tick:
    number;
}


export type BrickBreakerInputEvent =
  | BrickBreakerPaddleInputEvent
  | BrickBreakerLaunchInputEvent;


/*
 * =========================================================
 * REVIVE
 * =========================================================
 *
 * Normal run:
 *
 * 3 lives.
 *
 * When all lives are lost we can optionally allow one
 * rewarded-ad revive.
 *
 * Revive does NOT provide another cash/diamond reward.
 * It continues the same run.
 */

export interface BrickBreakerReviveEvent {
  /*
   * Simulation tick at which the player had already
   * reached GAME OVER and the revive was accepted.
   */
  afterTick:
    number;

  reviveNumber:
    number;
}


/*
 * =========================================================
 * ENGINE TICK RESULT
 * =========================================================
 */

export interface BrickBreakerTickResult {
  state:
    BrickBreakerGameState;

  brickHit:
    boolean;

  brickDestroyed:
    boolean;

  /*
   * Amount of HP removed during this exact tick.
   */
  brickHpDestroyed:
    number;

  lifeLost:
    boolean;

  /*
   * True ONLY on the exact tick where progress crosses
   * from below the reward threshold to the threshold
   * or above.
   *
   * Just like Snake, this is a milestone event.
   *
   * It does NOT stop gameplay.
   */
  rewardMilestoneReached:
    boolean;

  /*
   * True only on the exact tick where the final
   * remaining brick HP is removed.
   */
  levelCleared:
    boolean;

  gameOver:
    boolean;
}


/*
 * =========================================================
 * SAVED REWARDED RUN
 * =========================================================
 */

export interface SavedGenZBrickBreakerRun {
  version:
    1;

  runId:
    string;

  /*
   * Selected/replayed level.
   */
  level:
    number;

  gameState:
    BrickBreakerGameState;

  /*
   * Deterministic player actions.
   *
   * Backend replays these against the same level config.
   */
  inputEvents:
    BrickBreakerInputEvent[];

  /*
   * Optional rewarded-ad revive events.
   */
  reviveEvents:
    BrickBreakerReviveEvent[];

  revivesUsed:
    number;

  /*
   * First deterministic tick where 50% brick HP
   * was destroyed.
   *
   * Once assigned, NEVER change this value.
   */
  rewardMilestoneTick:
    number |
    null;

  /*
   * Server-confirmed reward state.
   *
   * Never set this merely because the client
   * reached 50%.
   */
  rewardClaimed:
    boolean;

  /*
   * Used when 100% completion needs backend
   * verification for progression/unlocking.
   */
  levelClearVerified:
    boolean;

  startedAt:
    number;

  updatedAt:
    number;
}


/*
 * =========================================================
 * LOCAL PLAYER PROGRESS
 * =========================================================
 *
 * Server remains authoritative for level unlocking.
 *
 * Local progress is useful for:
 *
 * - selected level
 * - personal best display
 * - quick UI restoration
 */

export interface BrickBreakerLocalProgress {
  selectedLevel:
    number;

  bestScore:
    number;

  highestLevelCleared:
    number;
}


/*
 * =========================================================
 * ENGINE ACTION RESULT
 * =========================================================
 *
 * Used for actions which happen outside the normal
 * fixed-tick simulation such as launch/revive/reset.
 */

export interface BrickBreakerActionResult {
  state:
    BrickBreakerGameState;

  accepted:
    boolean;
}