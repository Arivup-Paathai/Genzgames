export enum Direction {
  UP = "UP",
  DOWN = "DOWN",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}


export enum PowerUpType {
  SHIELD = "SHIELD",
  SLOW_MO = "SLOW_MO",
  MAGNET = "MAGNET",
  GROWTH_BOOST = "GROWTH_BOOST",
  REDUCTION = "REDUCTION",
  GHOST = "GHOST",
  WARP = "WARP",
  DOUBLE_POINTS = "DOUBLE_POINTS",
  FREEZE = "FREEZE",
}


export interface Point {
  x: number;

  y: number;
}


export interface Food {
  pos: Point;

  isBonus: boolean;
}


export interface PowerUpItem {
  pos: Point;

  type: PowerUpType;

  /*
   * Deterministic Snake uses game ticks
   * instead of Date.now().
   *
   * This allows the backend to replay
   * the exact same run.
   */
  remainingTicks: number;
}


export interface LevelConfig {
  id: number;

  gridSize: number;

  initialSpeed: number;

  obstacles: Point[];
}


export interface SnakeGameState {
  snake: Point[];

  direction: Direction;

  nextDirection: Direction;

  food:
    Food |
    null;

  obstacles: Point[];

  powerUp:
    PowerUpItem |
    null;

  activePowerUp:
    PowerUpType |
    null;

  activePowerUpTicksLeft: number;

  isGameOver: boolean;

isPaused: boolean;

/*
 * Legacy compatibility flag.
 *
 * Snake no longer ends when the player
 * reaches the 50% reward milestone.
 *
 * New runs keep this false.
 */
isCompleted: boolean;

score: number;

/*
 * Total number of food pickups
 * collected during this run.
 *
 * We keep this inside deterministic
 * game state because bonus-food spawning
 * depends on the pickup count.
 */
foodCount: number;

/*
 * 0 -> 1
 *
 * Example:
 * 0.10 = 10%
 * 0.50 = 50%
 *
 * GenZSnake completes at 50%.
 */
growthProgress: number;

  levelId: number;

  /*
   * Number of deterministic game steps
   * completed during this run.
   */
  tick: number;
}


export interface SnakeDirectionEvent {
  /*
   * The game tick on which the
   * direction changed.
   */
  tick: number;

  direction: Direction;
}


/*
 * Local active-run state.
 *
 * This is stored only in localStorage.
 *
 * We do NOT write active Snake runs
 * to Firebase.
 */
export interface SavedGenZSnakeRun {
  version: 1;

  runId: string;

  /*
   * Seed used by the deterministic
   * random-number generator.
   */
  seed: number;

  /*
   * Current position in the seeded
   * random-number sequence.
   */
  randomStep: number;

  level: number;

  gameState: SnakeGameState;

  directionEvents:
    SnakeDirectionEvent[];

  /*
 * Exact deterministic tick on which this
 * run FIRST reached the 50% reward target.
 *
 * null / undefined:
 * reward milestone has not been reached.
 *
 * We keep this exact tick because gameplay
 * continues after 50%, while the backend
 * must verify only the original milestone.
 *
 * Optional keeps old locally saved runs
 * backward-compatible.
 */
rewardMilestoneTick?:
  number |
  null;


/*
 * True only after the backend has
 * successfully processed this run's
 * 50% reward milestone.
 *
 * The Snake run itself may continue after
 * this becomes true.
 */
rewardClaimed: boolean;

startedAt: number;

  updatedAt: number;
}


/*
 * Small result object produced when the
 * deterministic Snake engine advances
 * by one tick.
 *
 * Later both frontend and backend can
 * follow the same game rules.
 */
export interface SnakeTickResult {
  state: SnakeGameState;

  randomStep: number;

  ateFood: boolean;

  collectedPowerUp: boolean;

  /*
   * True ONLY on the exact tick where
   * growth crosses the 50% reward target.
   *
   * It means:
   * "reward milestone reached"
   *
   * It does NOT mean gameplay should stop.
   */
  completed: boolean;

  gameOver: boolean;
}