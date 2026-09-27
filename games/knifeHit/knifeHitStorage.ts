import {
  KNIFE_HIT_FIRST_BATCH_START_LEVEL,
  KNIFE_HIT_LEVELS_PER_BATCH,
  KNIFE_HIT_MAX_APPLES,
  KNIFE_HIT_MAX_EXISTING_KNIVES,
  KNIFE_HIT_MAX_KNIVES_PER_LEVEL,
  KNIFE_HIT_MAX_REVIVES,
  KNIFE_HIT_MAX_TICKS_PER_LEVEL,
  getKnifeHitBatchEndLevel,
  getKnifeHitBatchStartLevel,
} from "./knifeHitConstants";

import type {
  KnifeHitApple,
  KnifeHitAttachedKnife,
  KnifeHitLevelAttempt,
  KnifeHitLevelState,
  KnifeHitLocalProgress,
  KnifeHitPendingThrow,
  KnifeHitRunEndReason,
  KnifeHitRunStatus,
  KnifeHitThrowEvent,
  SavedGenZKnifeHitRun,
} from "./knifeHitTypes";


const ACTIVE_RUN_STORAGE_PREFIX =
  "genzgames_knife_hit_active_run_v1";


const LOCAL_PROGRESS_STORAGE_PREFIX =
  "genzgames_knife_hit_progress_v1";


const MAX_SAVED_ATTEMPTS =
  32;


const MAX_THROW_EVENTS_PER_ATTEMPT =
  64;


/*
 * ============================================================
 * STORAGE KEYS
 * ============================================================
 */

const buildUserScopedKey =
  (
    prefix:
      string,

    userId:
      string,
  ) =>
    `${prefix}:${encodeURIComponent(
      userId,
    )}`;


/*
 * ============================================================
 * BASIC TYPE GUARDS
 * ============================================================
 */

const isRecord =
  (
    value:
      unknown,
  ): value is
    Record<
      string,
      unknown
    > =>
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    );


const isFiniteNumber =
  (
    value:
      unknown,
  ): value is number =>
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    );


const isInteger =
  (
    value:
      unknown,
  ): value is number =>
    isFiniteNumber(
      value,
    ) &&
    Number.isInteger(
      value,
    );


const isNonNegativeInteger =
  (
    value:
      unknown,
  ): value is number =>
    isInteger(
      value,
    ) &&
    value >=
      0;


const isPositiveInteger =
  (
    value:
      unknown,
  ): value is number =>
    isInteger(
      value,
    ) &&
    value >
      0;


/*
 * ============================================================
 * NESTED RUN VALIDATION
 * ============================================================
 */

const isAttachedKnife =
  (
    value:
      unknown,
  ): value is
    KnifeHitAttachedKnife => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    return isInteger(
      value.relAngleMilliDeg,
    );
  };


const isApple =
  (
    value:
      unknown,
  ): value is
    KnifeHitApple => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    return (
      isInteger(
        value.relAngleMilliDeg,
      ) &&
      typeof value.collected ===
        "boolean"
    );
  };


const isPendingThrow =
  (
    value:
      unknown,
  ): value is
    KnifeHitPendingThrow => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    return (
      isNonNegativeInteger(
        value.launchedAtTick,
      ) &&
      isPositiveInteger(
        value.impactTick,
      ) &&
      value.impactTick >
        value.launchedAtTick
    );
  };


const isThrowEvent =
  (
    value:
      unknown,
  ): value is
    KnifeHitThrowEvent => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    return isNonNegativeInteger(
      value.tick,
    );
  };


const isLevelAttempt =
  (
    value:
      unknown,

    batchStartLevel:
      number,

    batchEndLevel:
      number,
  ): value is
    KnifeHitLevelAttempt => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    if (
      !isPositiveInteger(
        value.level,
      ) ||
      value.level <
        batchStartLevel ||
      value.level >
        batchEndLevel
    ) {
      return false;
    }


    if (
      !isPositiveInteger(
        value.attemptNumber,
      )
    ) {
      return false;
    }


    if (
      !Array.isArray(
        value.throwEvents,
      ) ||
      value.throwEvents.length >
        MAX_THROW_EVENTS_PER_ATTEMPT ||
      !value.throwEvents.every(
        isThrowEvent,
      )
    ) {
      return false;
    }


    if (
      value.outcome !==
        "ACTIVE" &&
      value.outcome !==
        "CLEARED" &&
      value.outcome !==
        "FAILED"
    ) {
      return false;
    }


    if (
      value.endTick !==
        null &&
      !isNonNegativeInteger(
        value.endTick,
      )
    ) {
      return false;
    }


    return true;
  };


const isLevelState =
  (
    value:
      unknown,

    expectedLevel:
      number,
  ): value is
    KnifeHitLevelState => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    if (
      value.level !==
        expectedLevel
    ) {
      return false;
    }


    if (
      !isNonNegativeInteger(
        value.tick,
      ) ||
      value.tick >
        KNIFE_HIT_MAX_TICKS_PER_LEVEL
    ) {
      return false;
    }


    if (
      !isInteger(
        value.wheelAngleMilliDeg,
      ) ||
      !isInteger(
        value.wheelSpeedMilliDegPerTick,
      )
    ) {
      return false;
    }


    if (
      !isNonNegativeInteger(
        value.knivesLeft,
      ) ||
      value.knivesLeft >
        KNIFE_HIT_MAX_KNIVES_PER_LEVEL
    ) {
      return false;
    }


    if (
      !Array.isArray(
        value.attachedKnives,
      ) ||
      value.attachedKnives.length >
        (
          KNIFE_HIT_MAX_EXISTING_KNIVES +
          KNIFE_HIT_MAX_KNIVES_PER_LEVEL
        ) ||
      !value.attachedKnives.every(
        isAttachedKnife,
      )
    ) {
      return false;
    }


    if (
      !Array.isArray(
        value.apples,
      ) ||
      value.apples.length >
        KNIFE_HIT_MAX_APPLES ||
      !value.apples.every(
        isApple,
      )
    ) {
      return false;
    }


    if (
      value.pendingThrow !==
        null &&
      !isPendingThrow(
        value.pendingThrow,
      )
    ) {
      return false;
    }


    if (
      !isNonNegativeInteger(
        value.levelScore,
      ) ||
      typeof value.isLevelComplete !==
        "boolean" ||
      typeof value.isGameOver !==
        "boolean"
    ) {
      return false;
    }


    return true;
  };


const isRunStatus =
  (
    value:
      unknown,
  ): value is
    KnifeHitRunStatus =>
    value ===
      "ACTIVE" ||
    value ===
      "READY_TO_SETTLE" ||
    value ===
      "SETTLED";


const isRunEndReason =
  (
    value:
      unknown,
  ): value is
    KnifeHitRunEndReason =>
    value ===
      null ||
    value ===
      "BATCH_COMPLETE" ||
    value ===
      "OUT_OF_REVIVES" ||
    value ===
      "USER_END";


const isSavedRun =
  (
    value:
      unknown,
  ): value is
    SavedGenZKnifeHitRun => {

    if (
      !isRecord(
        value,
      )
    ) {
      return false;
    }


    if (
      value.version !==
        1 ||
      typeof value.runId !==
        "string" ||
      value.runId.length <
        8 ||
      value.runId.length >
        160
    ) {
      return false;
    }


    if (
      !isInteger(
        value.seed,
      ) ||
      value.seed <
        0 ||
      value.seed >
        0xffff_ffff
    ) {
      return false;
    }


    if (
      !isPositiveInteger(
        value.batchStartLevel,
      ) ||
      getKnifeHitBatchStartLevel(
        value.batchStartLevel,
      ) !==
        value.batchStartLevel
    ) {
      return false;
    }


    const batchStartLevel =
      value.batchStartLevel;


    const expectedBatchEnd =
      getKnifeHitBatchEndLevel(
        batchStartLevel,
      );


    if (
      value.batchEndLevel !==
        expectedBatchEnd
    ) {
      return false;
    }


    const batchEndLevel =
      expectedBatchEnd;


    if (
      !isPositiveInteger(
        value.currentLevel,
      ) ||
      value.currentLevel <
        batchStartLevel ||
      value.currentLevel >
        batchEndLevel
    ) {
      return false;
    }


    const currentLevel =
      value.currentLevel;


    if (
      !Array.isArray(
        value.completedLevels,
      ) ||
      value.completedLevels.length >
        KNIFE_HIT_LEVELS_PER_BATCH
    ) {
      return false;
    }


    const completedSet =
      new Set<number>();


    for (
      const level of
        value.completedLevels
    ) {

      if (
        !isPositiveInteger(
          level,
        ) ||
        level <
          batchStartLevel ||
        level >
          batchEndLevel ||
        completedSet.has(
          level,
        )
      ) {
        return false;
      }


      completedSet.add(
        level,
      );
    }


    if (
      !isNonNegativeInteger(
        value.revivesUsed,
      ) ||
      value.revivesUsed >
        KNIFE_HIT_MAX_REVIVES
    ) {
      return false;
    }


    if (
      !Array.isArray(
        value.attempts,
      ) ||
      value.attempts.length >
        MAX_SAVED_ATTEMPTS ||
      !value.attempts.every(
        attempt =>
          isLevelAttempt(
            attempt,
            batchStartLevel,
            batchEndLevel,
          ),
      )
    ) {
      return false;
    }


    if (
      !isLevelState(
        value.levelState,
        currentLevel,
      )
    ) {
      return false;
    }


    if (
      !isNonNegativeInteger(
        value.runScore,
      ) ||
      !isRunStatus(
        value.status,
      ) ||
      !isRunEndReason(
        value.endReason,
      ) ||
      typeof value.rewardClaimed !==
        "boolean" ||
      !isFiniteNumber(
        value.startedAt,
      ) ||
      !isFiniteNumber(
        value.updatedAt,
      )
    ) {
      return false;
    }


    return true;
  };


/*
 * ============================================================
 * ACTIVE RUN STORAGE
 * ============================================================
 */

export const saveGenZKnifeHitRun =
  (
    userId:
      string,

    run:
      SavedGenZKnifeHitRun,
  ) => {

    if (
      !userId
    ) {
      return;
    }


    try {

      localStorage.setItem(
        buildUserScopedKey(
          ACTIVE_RUN_STORAGE_PREFIX,
          userId,
        ),

        JSON.stringify(
          run,
        ),
      );

    } catch {
      /*
       * A localStorage failure must never crash gameplay.
       *
       * Backend verification still remains authoritative when
       * settlement eventually occurs.
       */
    }
  };


export const loadGenZKnifeHitRun =
  (
    userId:
      string,
  ):
    SavedGenZKnifeHitRun |
    null => {

    if (
      !userId
    ) {
      return null;
    }


    try {

      const raw =
        localStorage.getItem(
          buildUserScopedKey(
            ACTIVE_RUN_STORAGE_PREFIX,
            userId,
          ),
        );


      if (
        !raw
      ) {
        return null;
      }


      const parsed:
        unknown =
        JSON.parse(
          raw,
        );


      if (
        !isSavedRun(
          parsed,
        )
      ) {

        clearGenZKnifeHitRun(
          userId,
        );


        return null;
      }


      return parsed;

    } catch {

      clearGenZKnifeHitRun(
        userId,
      );


      return null;
    }
  };


export const clearGenZKnifeHitRun =
  (
    userId:
      string,
  ) => {

    if (
      !userId
    ) {
      return;
    }


    try {

      localStorage.removeItem(
        buildUserScopedKey(
          ACTIVE_RUN_STORAGE_PREFIX,
          userId,
        ),
      );

    } catch {
      // Ignore localStorage failure.
    }
  };


/*
 * ============================================================
 * LOCAL PROGRESS
 * ============================================================
 *
 * This is convenience/UI progress only.
 *
 * Cash and diamonds must NEVER be trusted from localStorage.
 * The backend verifies gameplay and calculates the real reward.
 */

export const createDefaultKnifeHitProgress =
  (): KnifeHitLocalProgress => ({
    version:
      1,

    highestUnlockedBatchStart:
      KNIFE_HIT_FIRST_BATCH_START_LEVEL,

    bestScore:
      0,

    highestLevelCleared:
      0,

    selectedBatchStart:
      KNIFE_HIT_FIRST_BATCH_START_LEVEL,
  });


const normalizeUnlockedBatchStart =
  (
    value:
      number,
  ) =>
    Math.max(
      KNIFE_HIT_FIRST_BATCH_START_LEVEL,

      getKnifeHitBatchStartLevel(
        Math.max(
          KNIFE_HIT_FIRST_BATCH_START_LEVEL,
          Math.floor(
            value,
          ),
        ),
      ),
    );


const normalizeLocalProgress =
  (
    value:
      unknown,
  ): KnifeHitLocalProgress => {

    const fallback =
      createDefaultKnifeHitProgress();


    if (
      !isRecord(
        value,
      ) ||
      value.version !==
        1
    ) {
      return fallback;
    }


    const highestUnlockedBatchStart =
      isPositiveInteger(
        value.highestUnlockedBatchStart,
      )
        ? normalizeUnlockedBatchStart(
            value.highestUnlockedBatchStart,
          )
        : fallback
            .highestUnlockedBatchStart;


    const bestScore =
      isNonNegativeInteger(
        value.bestScore,
      )
        ? value.bestScore
        : 0;


    const highestLevelCleared =
      isNonNegativeInteger(
        value.highestLevelCleared,
      )
        ? value.highestLevelCleared
        : 0;


    let selectedBatchStart =
      isPositiveInteger(
        value.selectedBatchStart,
      )
        ? normalizeUnlockedBatchStart(
            value.selectedBatchStart,
          )
        : KNIFE_HIT_FIRST_BATCH_START_LEVEL;


    /*
     * Previously unlocked easier batches remain replayable,
     * but an unavailable future batch cannot be selected.
     */
    if (
      selectedBatchStart >
      highestUnlockedBatchStart
    ) {
      selectedBatchStart =
        highestUnlockedBatchStart;
    }


    return {
      version:
        1,

      highestUnlockedBatchStart,

      bestScore,

      highestLevelCleared,

      selectedBatchStart,
    };
  };


export const saveGenZKnifeHitProgress =
  (
    userId:
      string,

    progress:
      KnifeHitLocalProgress,
  ) => {

    if (
      !userId
    ) {
      return;
    }


    try {

      const normalized =
        normalizeLocalProgress(
          progress,
        );


      localStorage.setItem(
        buildUserScopedKey(
          LOCAL_PROGRESS_STORAGE_PREFIX,
          userId,
        ),

        JSON.stringify(
          normalized,
        ),
      );

    } catch {
      // Ignore localStorage failure.
    }
  };


export const loadGenZKnifeHitProgress =
  (
    userId:
      string,
  ): KnifeHitLocalProgress => {

    if (
      !userId
    ) {
      return createDefaultKnifeHitProgress();
    }


    try {

      const raw =
        localStorage.getItem(
          buildUserScopedKey(
            LOCAL_PROGRESS_STORAGE_PREFIX,
            userId,
          ),
        );


      if (
        !raw
      ) {
        return createDefaultKnifeHitProgress();
      }


      const parsed:
        unknown =
        JSON.parse(
          raw,
        );


      const normalized =
        normalizeLocalProgress(
          parsed,
        );


      /*
       * Rewrite normalized progress so old/corrupt values do not
       * keep propagating through later app launches.
       */
      saveGenZKnifeHitProgress(
        userId,
        normalized,
      );


      return normalized;

    } catch {

      return createDefaultKnifeHitProgress();
    }
  };


export const updateGenZKnifeHitProgress =
  (
    userId:
      string,

    updater:
      (
        current:
          KnifeHitLocalProgress,
      ) =>
        KnifeHitLocalProgress,
  ) => {

    const current =
      loadGenZKnifeHitProgress(
        userId,
      );


    const next =
      normalizeLocalProgress(
        updater(
          current,
        ),
      );


    saveGenZKnifeHitProgress(
      userId,
      next,
    );


    return next;
  };


/*
 * Call this only after a five-level batch has actually been
 * completed and accepted by the backend.
 *
 * Replaying an older unlocked batch remains allowed.
 */
export const unlockNextKnifeHitBatch =
  (
    progress:
      KnifeHitLocalProgress,

    completedBatchStart:
      number,
  ): KnifeHitLocalProgress => {

    const safeCompletedBatchStart =
      getKnifeHitBatchStartLevel(
        completedBatchStart,
      );


    const nextBatchStart =
      safeCompletedBatchStart +
      KNIFE_HIT_LEVELS_PER_BATCH;


    return normalizeLocalProgress({
      ...progress,

      highestUnlockedBatchStart:
        Math.max(
          progress.highestUnlockedBatchStart,
          nextBatchStart,
        ),
    });
  };


export const selectKnifeHitBatch =
  (
    progress:
      KnifeHitLocalProgress,

    requestedBatchStart:
      number,
  ): KnifeHitLocalProgress => {

    const requested =
      getKnifeHitBatchStartLevel(
        requestedBatchStart,
      );


    if (
      requested >
      progress.highestUnlockedBatchStart
    ) {
      return progress;
    }


    return normalizeLocalProgress({
      ...progress,

      selectedBatchStart:
        requested,
    });
  };


export const updateKnifeHitPersonalBest =
  (
    progress:
      KnifeHitLocalProgress,

    score:
      number,

    highestLevelCleared:
      number,
  ): KnifeHitLocalProgress =>
    normalizeLocalProgress({
      ...progress,

      bestScore:
        Math.max(
          progress.bestScore,
          Math.max(
            0,
            Math.floor(
              score,
            ),
          ),
        ),

      highestLevelCleared:
        Math.max(
          progress.highestLevelCleared,
          Math.max(
            0,
            Math.floor(
              highestLevelCleared,
            ),
          ),
        ),
    });


/*
 * ============================================================
 * RUN ID / SEED CREATION
 * ============================================================
 */

export const createKnifeHitSeed =
  () => {

    try {

      if (
        typeof crypto !==
          "undefined" &&
        typeof crypto.getRandomValues ===
          "function"
      ) {

        const values =
          new Uint32Array(
            1,
          );


        crypto.getRandomValues(
          values,
        );


        return values[0] ??
          0;
      }

    } catch {
      // Use deterministic fallback below.
    }


    /*
     * This value only creates the replay seed.
     * Once created, all gameplay randomness is deterministic.
     */
    const now =
      Date.now() >>>
      0;


    const perf =
      typeof performance !==
        "undefined"
        ? Math.floor(
            performance.now() *
              1_000,
          ) >>>
          0
        : 0;


    return (
      now ^
      perf ^
      0x9e37_79b9
    ) >>>
      0;
  };


export const createKnifeHitRunId =
  () => {

    try {

      if (
        typeof crypto !==
          "undefined" &&
        typeof crypto.randomUUID ===
          "function"
      ) {
        return `knife_${crypto.randomUUID()}`;
      }

    } catch {
      // Use fallback below.
    }


    const seedPart =
      createKnifeHitSeed()
        .toString(
          36,
        );


    const timePart =
      Date.now()
        .toString(
          36,
        );


    return `knife_${timePart}_${seedPart}`;
  };
