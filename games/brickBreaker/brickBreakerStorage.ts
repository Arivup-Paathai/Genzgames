import {
  BRICK_BREAKER_MAX_LEVEL,
  normalizeBrickBreakerLevel,
} from "./brickBreakerConstants";

import type {
  BrickBreakerLocalProgress,
  SavedGenZBrickBreakerRun,
} from "./brickBreakerTypes";


/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER LOCAL STORAGE
 * =========================================================
 *
 * This file handles ONLY device-local persistence.
 *
 * No:
 *
 * - Firebase
 * - Cloud Functions
 * - AdMob
 * - React
 *
 * Active gameplay is saved locally so:
 *
 * - app backgrounding is safe
 * - Android Back is safe
 * - rewarded-ad return is safe
 * - accidental close can be resumed
 *
 * Server remains authoritative for:
 *
 * - wallet rewards
 * - diamonds
 * - unlocked level
 * - verified completion
 */


/*
 * =========================================================
 * STORAGE VERSION
 * =========================================================
 */

const BRICK_BREAKER_STORAGE_VERSION =
  1;


/*
 * =========================================================
 * STORAGE KEYS
 * =========================================================
 */

const getRunStorageKey =
  (
    userId:
      string,
  ) =>
    `genzgames-brick-breaker-run-v${BRICK_BREAKER_STORAGE_VERSION}:${userId}`;


const getProgressStorageKey =
  (
    userId:
      string,
  ) =>
    `genzgames-brick-breaker-progress-v${BRICK_BREAKER_STORAGE_VERSION}:${userId}`;


/*
 * =========================================================
 * SAFE LOCAL STORAGE ACCESS
 * =========================================================
 */

const canUseLocalStorage =
  () => {

    try {

      return (
        typeof window !==
          "undefined" &&
        typeof window.localStorage !==
          "undefined"
      );

    } catch {

      return false;
    }
  };


/*
 * =========================================================
 * RUN ID
 * =========================================================
 */

export const createBrickBreakerRunId =
  () => {

    /*
     * Preferred modern browser / Android WebView path.
     */
    try {

      if (
        typeof crypto !==
          "undefined" &&
        typeof crypto.randomUUID ===
          "function"
      ) {

        return (
          `brick_${crypto.randomUUID()}`
        );
      }

    } catch {
      // Fallback below.
    }


    /*
     * Run ID itself does NOT affect gameplay physics.
     *
     * It is only an idempotency identifier for backend
     * reward verification.
     */
    const timestamp =
      Date.now()
        .toString(
          36,
        );


    const randomPart =
      Math.random()
        .toString(
          36,
        )
        .slice(
          2,
          12,
        );


    return (
      `brick_${timestamp}_${randomPart}`
    );
  };


/*
 * =========================================================
 * DEFAULT LOCAL PROGRESS
 * =========================================================
 */

export const createDefaultBrickBreakerProgress =
  (): BrickBreakerLocalProgress => ({
    selectedLevel:
      1,

    bestScore:
      0,

    highestLevelCleared:
      0,
  });


/*
 * =========================================================
 * PROGRESS NORMALIZATION
 * =========================================================
 */

const normalizeProgress =
  (
    value:
      Partial<BrickBreakerLocalProgress> |
      null |
      undefined,
  ): BrickBreakerLocalProgress => {

    const selectedLevel =
      normalizeBrickBreakerLevel(
        Number(
          value
            ?.selectedLevel ??
          1,
        ),
      );


    const bestScore =
      Math.max(
        0,
        Math.floor(
          Number(
            value
              ?.bestScore ??
            0,
          ) ||
            0,
        ),
      );


    const highestLevelCleared =
      Math.max(
        0,
        Math.min(
          BRICK_BREAKER_MAX_LEVEL,
          Math.floor(
            Number(
              value
                ?.highestLevelCleared ??
              0,
            ) ||
              0,
          ),
        ),
      );


    return {
      selectedLevel,

      bestScore,

      highestLevelCleared,
    };
  };


/*
 * =========================================================
 * LOAD LOCAL PROGRESS
 * =========================================================
 */

export const loadGenZBrickBreakerProgress =
  (
    userId:
      string,
  ): BrickBreakerLocalProgress => {

    if (
      !userId ||
      !canUseLocalStorage()
    ) {
      return (
        createDefaultBrickBreakerProgress()
      );
    }


    try {

      const raw =
        window.localStorage
          .getItem(
            getProgressStorageKey(
              userId,
            ),
          );


      if (
        !raw
      ) {
        return (
          createDefaultBrickBreakerProgress()
        );
      }


      const parsed =
        JSON.parse(
          raw,
        ) as Partial<BrickBreakerLocalProgress>;


      return normalizeProgress(
        parsed,
      );

    } catch {

      return (
        createDefaultBrickBreakerProgress()
      );
    }
  };


/*
 * =========================================================
 * SAVE LOCAL PROGRESS
 * =========================================================
 */

export const saveGenZBrickBreakerProgress =
  (
    userId:
      string,

    progress:
      BrickBreakerLocalProgress,
  ) => {

    if (
      !userId ||
      !canUseLocalStorage()
    ) {
      return;
    }


    try {

      const normalized =
        normalizeProgress(
          progress,
        );


      window.localStorage
        .setItem(
          getProgressStorageKey(
            userId,
          ),

          JSON.stringify(
            normalized,
          ),
        );

    } catch {
      /*
       * Local persistence failure must never crash
       * gameplay.
       */
    }
  };


/*
 * =========================================================
 * SELECT LEVEL
 * =========================================================
 */

export const selectBrickBreakerLevel =
  (
    progress:
      BrickBreakerLocalProgress,

    level:
      number,

    highestUnlockedLevel:
      number,
  ): BrickBreakerLocalProgress => {

    const safeHighestUnlocked =
      normalizeBrickBreakerLevel(
        highestUnlockedLevel,
      );


    const requested =
      normalizeBrickBreakerLevel(
        level,
      );


    return {
      ...progress,

      selectedLevel:
        Math.min(
          requested,
          safeHighestUnlocked,
        ),
    };
  };


/*
 * =========================================================
 * PERSONAL BEST
 * =========================================================
 */

export const updateBrickBreakerPersonalBest =
  (
    progress:
      BrickBreakerLocalProgress,

    score:
      number,

    highestLevelCleared:
      number,
  ): BrickBreakerLocalProgress => {

    const safeScore =
      Math.max(
        0,
        Math.floor(
          Number(
            score,
          ) ||
            0,
        ),
      );


    const safeHighestCleared =
      Math.max(
        0,
        Math.min(
          BRICK_BREAKER_MAX_LEVEL,
          Math.floor(
            Number(
              highestLevelCleared,
            ) ||
              0,
          ),
        ),
      );


    return {
      ...progress,

      bestScore:
        Math.max(
          progress.bestScore,
          safeScore,
        ),

      highestLevelCleared:
        Math.max(
          progress
            .highestLevelCleared,
          safeHighestCleared,
        ),
    };
  };


/*
 * =========================================================
 * VALIDATE SAVED RUN
 * =========================================================
 *
 * This is not security validation.
 *
 * Backend performs authoritative reward verification.
 *
 * This only prevents broken localStorage JSON from
 * crashing the React game.
 */

const isValidSavedRun =
  (
    value:
      unknown,
  ): value is SavedGenZBrickBreakerRun => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const candidate =
      value as Partial<SavedGenZBrickBreakerRun>;


    if (
      candidate.version !==
        1 ||
      typeof candidate.runId !==
        "string" ||
      candidate.runId.length <
        4
    ) {
      return false;
    }


    if (
      typeof candidate.level !==
        "number" ||
      candidate.level <
        1 ||
      candidate.level >
        BRICK_BREAKER_MAX_LEVEL
    ) {
      return false;
    }


    if (
      !candidate.gameState ||
      typeof candidate.gameState !==
        "object"
    ) {
      return false;
    }


    if (
      !Array.isArray(
        candidate.inputEvents,
      ) ||
      !Array.isArray(
        candidate.reviveEvents,
      )
    ) {
      return false;
    }


    if (
      typeof candidate.revivesUsed !==
        "number" ||
      candidate.revivesUsed <
        0
    ) {
      return false;
    }


    if (
      candidate.rewardMilestoneTick !==
        null &&
      typeof candidate.rewardMilestoneTick !==
        "number"
    ) {
      return false;
    }


    if (
      typeof candidate.rewardClaimed !==
        "boolean" ||
      typeof candidate.levelClearVerified !==
        "boolean"
    ) {
      return false;
    }


    if (
      typeof candidate.startedAt !==
        "number" ||
      typeof candidate.updatedAt !==
        "number"
    ) {
      return false;
    }


    return true;
  };


/*
 * =========================================================
 * LOAD ACTIVE RUN
 * =========================================================
 */

export const loadGenZBrickBreakerRun =
  (
    userId:
      string,
  ): SavedGenZBrickBreakerRun |
    null => {

    if (
      !userId ||
      !canUseLocalStorage()
    ) {
      return null;
    }


    try {

      const key =
        getRunStorageKey(
          userId,
        );


      const raw =
        window.localStorage
          .getItem(
            key,
          );


      if (
        !raw
      ) {
        return null;
      }


      const parsed =
        JSON.parse(
          raw,
        ) as unknown;


      if (
        !isValidSavedRun(
          parsed,
        )
      ) {

        window.localStorage
          .removeItem(
            key,
          );


        return null;
      }


      return parsed;

    } catch {

      return null;
    }
  };


/*
 * =========================================================
 * SAVE ACTIVE RUN
 * =========================================================
 */

export const saveGenZBrickBreakerRun =
  (
    userId:
      string,

    run:
      SavedGenZBrickBreakerRun,
  ) => {

    if (
      !userId ||
      !canUseLocalStorage()
    ) {
      return;
    }


    try {

      window.localStorage
        .setItem(
          getRunStorageKey(
            userId,
          ),

          JSON.stringify(
            run,
          ),
        );

    } catch {
      /*
       * Do not interrupt gameplay because storage is full
       * or temporarily unavailable.
       */
    }
  };


/*
 * =========================================================
 * CLEAR ACTIVE RUN
 * =========================================================
 */

export const clearGenZBrickBreakerRun =
  (
    userId:
      string,
  ) => {

    if (
      !userId ||
      !canUseLocalStorage()
    ) {
      return;
    }


    try {

      window.localStorage
        .removeItem(
          getRunStorageKey(
            userId,
          ),
        );

    } catch {
      // Ignore local persistence errors.
    }
  };


/*
 * =========================================================
 * RUN STATUS HELPERS
 * =========================================================
 */

export const canResumeBrickBreakerRun =
  (
    run:
      SavedGenZBrickBreakerRun |
      null,
  ) => {

    if (
      !run
    ) {
      return false;
    }


    /*
     * Reward may already be claimed at 50%.
     *
     * That does NOT mean the run is finished.
     *
     * We intentionally allow the player to resume and
     * continue toward 100%.
     */
    return (
      !run.gameState.isGameOver &&
      !run.gameState.isLevelCleared
    );
  };


export const hasPendingBrickBreakerReward =
  (
    run:
      SavedGenZBrickBreakerRun |
      null,
  ) =>
    Boolean(
      run &&
      run.rewardMilestoneTick !==
        null &&
      !run.rewardClaimed
    );


export const hasPendingBrickBreakerLevelClear =
  (
    run:
      SavedGenZBrickBreakerRun |
      null,
  ) =>
    Boolean(
      run &&
      run.gameState.isLevelCleared &&
      !run.levelClearVerified
    );


/*
 * =========================================================
 * INPUT EVENT HELPERS
 * =========================================================
 *
 * Paddle touch events can happen very quickly.
 *
 * Do not store duplicate paddle positions for the same
 * deterministic tick.
 */

export const appendBrickBreakerInputEvent =
  (
    run:
      SavedGenZBrickBreakerRun,

    event:
      SavedGenZBrickBreakerRun["inputEvents"][number],
  ): SavedGenZBrickBreakerRun => {

    const events = [
      ...run.inputEvents,
    ];


    const last =
      events[
        events.length -
        1
      ];


    /*
     * Multiple paddle movements before the next engine
     * tick:
     *
     * only the FINAL paddle position for that tick matters.
     */
    if (
      event.type ===
        "PADDLE" &&
      last?.type ===
        "PADDLE" &&
      last.tick ===
        event.tick
    ) {

      events[
        events.length -
          1
      ] =
        event;

    } else if (
      event.type ===
        "LAUNCH" &&
      last?.type ===
        "LAUNCH" &&
      last.tick ===
        event.tick
    ) {

      /*
       * Never record duplicate launch events for the
       * exact same tick.
       */
      return run;

    } else {

      events.push(
        event,
      );
    }


    return {
      ...run,

      inputEvents:
        events,

      updatedAt:
        Date.now(),
    };
  };