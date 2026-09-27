export type KnifeHitRunStatus =
  | "ACTIVE"
  | "READY_TO_SETTLE"
  | "SETTLED";

export type KnifeHitAttemptOutcome =
  | "ACTIVE"
  | "CLEARED"
  | "FAILED";

export type KnifeHitRunEndReason =
  | "BATCH_COMPLETE"
  | "OUT_OF_REVIVES"
  | "USER_END"
  | null;


/*
 * Angles use milli-degrees for deterministic gameplay.
 *
 * 1000 milli-degrees = 1 degree
 * 360000 milli-degrees = full rotation
 */
export interface KnifeHitAttachedKnife {
  relAngleMilliDeg:
    number;
}


export interface KnifeHitApple {
  relAngleMilliDeg:
    number;

  collected:
    boolean;
}


export interface KnifeHitPendingThrow {
  launchedAtTick:
    number;

  impactTick:
    number;
}


export interface KnifeHitLevelState {
  level:
    number;

  tick:
    number;

  wheelAngleMilliDeg:
    number;

  wheelSpeedMilliDegPerTick:
    number;

  knivesLeft:
    number;

  attachedKnives:
    KnifeHitAttachedKnife[];

  apples:
    KnifeHitApple[];

  pendingThrow:
    KnifeHitPendingThrow |
    null;

  levelScore:
    number;

  isLevelComplete:
    boolean;

  isGameOver:
    boolean;
}


export interface KnifeHitThrowEvent {
  tick:
    number;
}


export interface KnifeHitLevelAttempt {
  level:
    number;

  attemptNumber:
    number;

  throwEvents:
    KnifeHitThrowEvent[];

  outcome:
    KnifeHitAttemptOutcome;

  endTick:
    number |
    null;
}


export interface SavedGenZKnifeHitRun {
  version:
    1;

  runId:
    string;

  seed:
    number;

  /*
   * Every rewarded-ad run covers exactly five levels.
   *
   * Examples:
   * 1-5
   * 6-10
   * 11-15
   */
  batchStartLevel:
    number;

  batchEndLevel:
    number;

  currentLevel:
    number;

  /*
   * Only fully cleared levels are stored here.
   *
   * Reward is derived from this count:
   * ₹0.01 + 2 diamonds per verified level.
   *
   * The client may DISPLAY the pending amount,
   * but the backend calculates the real reward.
   */
  completedLevels:
    number[];

  /*
   * Maximum two rewarded-ad revives per five-level run.
   *
   * A revive restarts the failed current level
   * from its deterministic starting state.
   */
  revivesUsed:
    number;

  attempts:
    KnifeHitLevelAttempt[];

  levelState:
    KnifeHitLevelState;

  runScore:
    number;

  status:
    KnifeHitRunStatus;

  endReason:
    KnifeHitRunEndReason;

  rewardClaimed:
    boolean;

  startedAt:
    number;

  updatedAt:
    number;
}


export interface KnifeHitTickResult {
  state:
    KnifeHitLevelState;

  knifeStuck:
    boolean;

  appleCollected:
    boolean;

  collision:
    boolean;

  levelCleared:
    boolean;
}


export interface KnifeHitLocalProgress {
  version:
    1;

  /*
   * Highest five-level batch the player has unlocked.
   *
   * 1 means Levels 1-5 are available.
   * 6 means Levels 1-5 and 6-10 are available.
   * 11 means Levels 1-5, 6-10 and 11-15 are available.
   */
  highestUnlockedBatchStart:
    number;

  bestScore:
    number;

  highestLevelCleared:
    number;

  selectedBatchStart:
    number;
}
