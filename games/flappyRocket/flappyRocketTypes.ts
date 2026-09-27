export type FlappyRocketCharacterKey =
  | "rocket"
  | "bird"
  | "ball"
  | "ufo";


/*
 * One deterministic obstacle.
 *
 * `id` is numeric instead of Date.now()/Math.random()
 * so frontend and backend can create exactly
 * the same obstacle sequence.
 */
export interface FlappyRocketObstacle {
  id: number;

  x: number;

  gapY: number;

  gapHeight: number;

  width: number;

  passed: boolean;
}


/*
 * A flap is the only normal player input
 * that changes verified gameplay.
 *
 * We store the deterministic game tick,
 * not Date.now().
 */
export interface FlappyRocketFlapEvent {
  tick: number;
}


/*
 * Core deterministic gameplay state.
 *
 * Do NOT put:
 *
 * - stars
 * - clouds
 * - particles
 * - animations
 * - sound state
 *
 * here.
 *
 * Those are visual-only and do not need
 * backend verification.
 */
export interface FlappyRocketGameState {
  rocketY: number;

  rocketVelocity: number;

  obstacles:
    FlappyRocketObstacle[];

  score: number;

  distance: number;

  /*
   * Total deterministic simulation ticks
   * completed during this run.
   */
  tick: number;

  /*
   * Used to create deterministic numeric
   * obstacle IDs.
   */
  nextObstacleId: number;

  /*
   * Tick on which the latest obstacle
   * was created.
   */
  lastSpawnTick: number;

  /*
   * One rewarded-ad revive may be used
   * during a run.
   */
  reviveUsed: boolean;

  isGameOver: boolean;
}


/*
 * Result of advancing exactly one
 * deterministic gameplay tick.
 */
export interface FlappyRocketTickResult {
  state:
    FlappyRocketGameState;

  randomStep: number;

  /*
   * True only when an obstacle was passed
   * during this exact tick.
   */
  scored: boolean;

  /*
   * True only on the exact tick where
   * the reward target is reached.
   *
   * Gameplay must continue afterward.
   */
  rewardMilestoneReached: boolean;

  gameOver: boolean;
}


/*
 * Local active run.
 *
 * Stored in localStorage only.
 *
 * Firebase remains authoritative for:
 *
 * - cash
 * - diamonds
 * - verified completed runs
 * - best score
 */
export interface SavedGenZFlappyRocketRun {
  version: 1;

  runId: string;

  /*
   * Seed for deterministic obstacle
   * generation.
   */
  seed: number;

  /*
   * Current seeded-random sequence position.
   */
  randomStep: number;

  gameState:
    FlappyRocketGameState;

  /*
   * Every gameplay-changing flap.
   *
   * Visual taps after game over/menu
   * are not recorded.
   */
  flapEvents:
    FlappyRocketFlapEvent[];

  /*
   * Exact deterministic tick on which
   * this run FIRST reached the reward target.
   *
   * null:
   * reward target not reached yet.
   *
   * Gameplay continues after this tick.
   */
  rewardMilestoneTick:
    number |
    null;

    /*
   * Exact deterministic tick where the
   * one allowed pre-reward revive occurred.
   *
   * null:
   * revive has not been used.
   *
   * Revive is allowed only while score < 50.
   *
   * This remains local during gameplay and
   * is sent to the backend only when the
   * score-50 reward is verified.
   */
  reviveTick:
    number |
    null;

  /*
   * Becomes true only after Firebase backend
   * successfully verifies and processes
   * the reward.
   */
  rewardClaimed: boolean;

  startedAt: number;

  updatedAt: number;
}