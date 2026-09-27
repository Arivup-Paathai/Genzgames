import {
  CANDY_CASCADE_MAX_LEVEL,
} from "./candyCascadeConstants";

import {
  createInitialCandyCascadeState,
  isCandyCascadeContinueEvent,
  isCandyCascadeRunEvent,
  isCandyCascadeSwapEvent,
} from "./candyCascadeEngine";

import type {
  CandyCascadeContinueEvent,
  CandyCascadeLocalProgress,
  CandyCascadeRunEvent,
  CandyCascadeStarCount,
  CandyCascadeSwapEvent,
  SavedGenZCandyCascadeRun,
} from "./candyCascadeTypes";


/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE LOCAL STORAGE
 * ============================================================
 *
 * Local storage is used for:
 *
 * - active run resume
 * - selected level
 * - local best score
 * - local stars
 * - locally remembered cleared level
 *
 * IMPORTANT:
 *
 * Server remains authoritative for:
 *
 * - cash reward
 * - diamonds
 * - verified completion
 * - highest unlocked level
 *
 * Math.random / Date.now are allowed HERE because:
 *
 * - runId is identity only
 * - seed is generated once before deterministic gameplay
 * - timestamps are persistence metadata
 *
 * They are NOT used to resolve gameplay.
 */


/*
 * ============================================================
 * STORAGE VERSION
 * ============================================================
 */

const CANDY_CASCADE_STORAGE_VERSION =
  1;


/*
 * ============================================================
 * STORAGE PREFIXES
 * ============================================================
 */

const CANDY_CASCADE_RUN_KEY_PREFIX =
  "genz-candy-cascade-run-v1";


const CANDY_CASCADE_PROGRESS_KEY_PREFIX =
  "genz-candy-cascade-progress-v1";


/*
 * ============================================================
 * BASIC HELPERS
 * ============================================================
 */

const clamp =
  (
    value:
      number,

    minimum:
      number,

    maximum:
      number,
  ) =>
    Math.max(
      minimum,
      Math.min(
        maximum,
        value,
      ),
    );


const normalizeUserKey =
  (
    userId:
      string,
  ) =>
    encodeURIComponent(
      userId.trim(),
    );


const getRunStorageKey =
  (
    userId:
      string,
  ) =>
    `${CANDY_CASCADE_RUN_KEY_PREFIX}:${normalizeUserKey(
      userId,
    )}`;


const getProgressStorageKey =
  (
    userId:
      string,
  ) =>
    `${CANDY_CASCADE_PROGRESS_KEY_PREFIX}:${normalizeUserKey(
      userId,
    )}`;


/*
 * ============================================================
 * DEFAULT PROGRESS
 * ============================================================
 */

export const createDefaultCandyCascadeProgress =
  (): CandyCascadeLocalProgress => ({
    selectedLevel:
      1,

    highestLevelCleared:
      0,

    bestScore:
      0,

    stars:
      {},
  });


/*
 * ============================================================
 * SAFE NUMBER HELPERS
 * ============================================================
 */

const safeInteger =
  (
    value:
      unknown,

    fallback:
      number,

    minimum =
      0,

    maximum =
      Number.MAX_SAFE_INTEGER,
  ) => {

    if (
      typeof value !==
        "number" ||
      !Number.isFinite(
        value,
      )
    ) {
      return fallback;
    }


    return clamp(
      Math.floor(
        value,
      ),
      minimum,
      maximum,
    );
  };


const isStarCount =
  (
    value:
      unknown,
  ): value is CandyCascadeStarCount =>
    value ===
      0 ||
    value ===
      1 ||
    value ===
      2 ||
    value ===
      3;


/*
 * ============================================================
 * NORMALIZE STAR RECORD
 * ============================================================
 */

const normalizeStars =
  (
    value:
      unknown,
  ): Record<
    number,
    CandyCascadeStarCount
  > => {

    if (
      !value ||
      typeof value !==
        "object" ||
      Array.isArray(
        value,
      )
    ) {
      return {};
    }


    const normalized:
      Record<
        number,
        CandyCascadeStarCount
      > =
      {};


    Object.entries(
      value,
    ).forEach(
      (
        [
          key,
          starValue,
        ],
      ) => {

        const level =
          Number(
            key,
          );


        if (
          !Number.isInteger(
            level,
          ) ||
          level <
            1 ||
          level >
            CANDY_CASCADE_MAX_LEVEL ||
          !isStarCount(
            starValue,
          )
        ) {
          return;
        }


        normalized[
          level
        ] =
          starValue;
      },
    );


    return normalized;
  };


/*
 * ============================================================
 * NORMALIZE LOCAL PROGRESS
 * ============================================================
 */

export const normalizeCandyCascadeProgress =
  (
    value:
      unknown,
  ): CandyCascadeLocalProgress => {

    const fallback =
      createDefaultCandyCascadeProgress();


    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return fallback;
    }


    const raw =
      value as
        Partial<
          CandyCascadeLocalProgress
        >;


    const highestLevelCleared =
      safeInteger(
        raw.highestLevelCleared,
        0,
        0,
        CANDY_CASCADE_MAX_LEVEL,
      );


    const selectedLevel =
      safeInteger(
        raw.selectedLevel,
        Math.max(
          1,
          highestLevelCleared +
            1,
        ),
        1,
        CANDY_CASCADE_MAX_LEVEL,
      );


    return {
      selectedLevel,

      highestLevelCleared,

      bestScore:
        safeInteger(
          raw.bestScore,
          0,
        ),

      stars:
        normalizeStars(
          raw.stars,
        ),
    };
  };


/*
 * ============================================================
 * LOAD LOCAL PROGRESS
 * ============================================================
 */

export const loadCandyCascadeProgress =
  (
    userId:
      string,
  ): CandyCascadeLocalProgress => {

    if (
      !userId.trim()
    ) {
      return createDefaultCandyCascadeProgress();
    }


    try {

      const raw =
        localStorage.getItem(
          getProgressStorageKey(
            userId,
          ),
        );


      if (
        !raw
      ) {
        return createDefaultCandyCascadeProgress();
      }


      return normalizeCandyCascadeProgress(
        JSON.parse(
          raw,
        ),
      );

    } catch {

      return createDefaultCandyCascadeProgress();
    }
  };


/*
 * ============================================================
 * SAVE LOCAL PROGRESS
 * ============================================================
 */

export const saveCandyCascadeProgress =
  (
    userId:
      string,

    progress:
      CandyCascadeLocalProgress,
  ) => {

    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      localStorage.setItem(
        getProgressStorageKey(
          userId,
        ),

        JSON.stringify(
          normalizeCandyCascadeProgress(
            progress,
          ),
        ),
      );

    } catch {

      /*
       * Local persistence failure must never crash gameplay.
       */
    }
  };


/*
 * ============================================================
 * UPDATE SELECTED LEVEL
 * ============================================================
 */

export const selectCandyCascadeLevel =
  (
    progress:
      CandyCascadeLocalProgress,

    level:
      number,
  ): CandyCascadeLocalProgress => ({
    ...progress,

    selectedLevel:
      clamp(
        Math.floor(
          level,
        ),
        1,
        CANDY_CASCADE_MAX_LEVEL,
      ),
  });


/*
 * ============================================================
 * UPDATE VERIFIED COMPLETION
 * ============================================================
 *
 * Call this only after backend verification succeeds.
 */

export const applyVerifiedCandyCascadeProgress =
  (
    progress:
      CandyCascadeLocalProgress,

    level:
      number,

    score:
      number,

    stars:
      CandyCascadeStarCount,
  ): CandyCascadeLocalProgress => {

    const safeLevel =
      clamp(
        Math.floor(
          level,
        ),
        1,
        CANDY_CASCADE_MAX_LEVEL,
      );


    const previousStars =
      progress.stars[
        safeLevel
      ] ??
      0;


    return {
      ...progress,

      selectedLevel:
        Math.min(
          CANDY_CASCADE_MAX_LEVEL,
          safeLevel +
            1,
        ),

      highestLevelCleared:
        Math.max(
          progress.highestLevelCleared,
          safeLevel,
        ),

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

      stars: {
        ...progress.stars,

        [safeLevel]:
          Math.max(
            previousStars,
            stars,
          ) as
            CandyCascadeStarCount,
      },
    };
  };


/*
 * ============================================================
 * RUN ID
 * ============================================================
 *
 * Backend-safe characters only:
 *
 * A-Z
 * a-z
 * 0-9
 * _
 * -
 */

export const createCandyCascadeRunId =
  () => {

    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {

      return `cc_${crypto
        .randomUUID()
        .replace(
          /-/g,
          "_",
        )}`;
    }


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
          14,
        );


    return `cc_${timestamp}_${randomPart}`;
  };


/*
 * ============================================================
 * GAME SEED
 * ============================================================
 */

export const createCandyCascadeSeed =
  (): number => {

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


      const seed =
        values[
          0
        ] >>>
        0;


      /*
       * Zero is technically valid, but keeping a non-zero
       * seed makes logs/debugging easier.
       */
      return seed ===
        0
        ? 1
        : seed;
    }


    const fallback =
      Math.floor(
        Math.random() *
          0xffffffff,
      ) >>>
      0;


    return fallback ===
      0
      ? 1
      : fallback;
  };


/*
 * ============================================================
 * CREATE NEW RUN
 * ============================================================
 */

export const createNewCandyCascadeRun =
  (
    level:
      number,
  ): SavedGenZCandyCascadeRun => {

    const safeLevel =
      clamp(
        Math.floor(
          level,
        ),
        1,
        CANDY_CASCADE_MAX_LEVEL,
      );


    const seed =
      createCandyCascadeSeed();


    const now =
      Date.now();


    return {
      version:
        CANDY_CASCADE_STORAGE_VERSION,

      runId:
        createCandyCascadeRunId(),

      seed,

      level:
        safeLevel,

      gameState:
        createInitialCandyCascadeState(
          safeLevel,
          seed,
        ),

      events:
        [],

      rewardClaimed:
        false,

      levelClearVerified:
        false,

      startedAt:
        now,

      updatedAt:
        now,
    };
  };


/*
 * ============================================================
 * VALIDATE SAVED RUN SHAPE
 * ============================================================
 */

const isValidSavedRun =
  (
    value:
      unknown,
  ): value is SavedGenZCandyCascadeRun => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const run =
      value as
        Partial<
          SavedGenZCandyCascadeRun
        >;


    if (
      run.version !==
        CANDY_CASCADE_STORAGE_VERSION ||
      typeof run.runId !==
        "string" ||
      run.runId.length <
        12 ||
      !Number.isInteger(
        run.seed,
      ) ||
      !Number.isInteger(
        run.level,
      ) ||
      (
        run.level ??
        0
      ) <
        1 ||
      (
        run.level ??
        0
      ) >
        CANDY_CASCADE_MAX_LEVEL ||
      !run.gameState ||
      typeof run.gameState !==
        "object" ||
      !Array.isArray(
        run.events,
      ) ||
      typeof run.rewardClaimed !==
        "boolean" ||
      typeof run.levelClearVerified !==
        "boolean" ||
      typeof run.startedAt !==
        "number" ||
      typeof run.updatedAt !==
        "number"
    ) {
      return false;
    }


    if (
      !run.events.every(
        event =>
          isCandyCascadeRunEvent(
            event,
          ),
      )
    ) {
      return false;
    }


    /*
     * The saved state must belong to this exact run level/seed.
     */
    if (
      run.gameState.levelId !==
        run.level ||
      run.gameState.seed !==
        (
          run.seed! >>>
          0
        )
    ) {
      return false;
    }


    return true;
  };


/*
 * ============================================================
 * LOAD ACTIVE RUN
 * ============================================================
 */

export const loadCandyCascadeRun =
  (
    userId:
      string,
  ): SavedGenZCandyCascadeRun |
    null => {

    if (
      !userId.trim()
    ) {
      return null;
    }


    try {

      const raw =
        localStorage.getItem(
          getRunStorageKey(
            userId,
          ),
        );


      if (
        !raw
      ) {
        return null;
      }


      const parsed =
        JSON.parse(
          raw,
        );


      if (
        !isValidSavedRun(
          parsed,
        )
      ) {

        localStorage.removeItem(
          getRunStorageKey(
            userId,
          ),
        );


        return null;
      }


      return parsed;

    } catch {

      return null;
    }
  };


/*
 * ============================================================
 * SAVE ACTIVE RUN
 * ============================================================
 */

export const saveCandyCascadeRun =
  (
    userId:
      string,

    run:
      SavedGenZCandyCascadeRun,
  ) => {

    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      const next: SavedGenZCandyCascadeRun = {
        ...run,

        updatedAt:
          Date.now(),
      };


      localStorage.setItem(
        getRunStorageKey(
          userId,
        ),

        JSON.stringify(
          next,
        ),
      );

    } catch {

      /*
       * Never crash the active game if localStorage is full
       * or temporarily unavailable.
       */
    }
  };


/*
 * ============================================================
 * CLEAR ACTIVE RUN
 * ============================================================
 */

export const clearCandyCascadeRun =
  (
    userId:
      string,
  ) => {

    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      localStorage.removeItem(
        getRunStorageKey(
          userId,
        ),
      );

    } catch {

      /*
       * No-op.
       */
    }
  };


/*
 * ============================================================
 * APPEND SWAP EVENT
 * ============================================================
 *
 * Only accepted swaps should ever be recorded.
 */

export const appendCandyCascadeSwapEvent =
  (
    run:
      SavedGenZCandyCascadeRun,

    event:
      CandyCascadeSwapEvent,
  ): SavedGenZCandyCascadeRun => {

    if (
      !isCandyCascadeSwapEvent(
        event,
      )
    ) {
      return run;
    }


    return {
      ...run,

      events: [
        ...run.events,
        event,
      ],

      updatedAt:
        Date.now(),
    };
  };


/*
 * ============================================================
 * APPEND CONTINUE EVENT
 * ============================================================
 */

export const appendCandyCascadeContinueEvent =
  (
    run:
      SavedGenZCandyCascadeRun,

    event:
      CandyCascadeContinueEvent,
  ): SavedGenZCandyCascadeRun => {

    if (
      !isCandyCascadeContinueEvent(
        event,
      )
    ) {
      return run;
    }


    /*
     * A run may contain only one continue event.
     */
    const alreadyHasContinue =
      run.events.some(
        existing =>
          existing.type ===
          "CONTINUE",
      );


    if (
      alreadyHasContinue
    ) {
      return run;
    }


    return {
      ...run,

      events: [
        ...run.events,
        event,
      ],

      updatedAt:
        Date.now(),
    };
  };


/*
 * ============================================================
 * REPLACE GAME STATE
 * ============================================================
 */

export const updateCandyCascadeRunState =
  (
    run:
      SavedGenZCandyCascadeRun,

    gameState:
      SavedGenZCandyCascadeRun[
        "gameState"
      ],
  ): SavedGenZCandyCascadeRun => ({
    ...run,

    gameState,

    updatedAt:
      Date.now(),
  });


/*
 * ============================================================
 * SET COMPLETION FLAGS
 * ============================================================
 */

export const markCandyCascadeRunVerified =
  (
    run:
      SavedGenZCandyCascadeRun,
  ): SavedGenZCandyCascadeRun => ({
    ...run,

    rewardClaimed:
      true,

    levelClearVerified:
      true,

    updatedAt:
      Date.now(),
  });


/*
 * ============================================================
 * PENDING SETTLEMENT
 * ============================================================
 *
 * A locally completed level must NEVER be silently destroyed
 * before the backend verifies/grants it.
 */

export const hasPendingCandyCascadeSettlement =
  (
    run:
      SavedGenZCandyCascadeRun |
      null,
  ) =>
    Boolean(
      run &&
      run.gameState.isLevelCleared &&
      (
        !run.rewardClaimed ||
        !run.levelClearVerified
      ),
    );


/*
 * ============================================================
 * RUN STATUS HELPERS
 * ============================================================
 */

export const isCandyCascadeRunFullySettled =
  (
    run:
      SavedGenZCandyCascadeRun |
      null,
  ) =>
    Boolean(
      run &&
      run.gameState.isLevelCleared &&
      run.rewardClaimed &&
      run.levelClearVerified,
    );


export const isCandyCascadeRunActive =
  (
    run:
      SavedGenZCandyCascadeRun |
      null,
  ) =>
    Boolean(
      run &&
      !run.gameState.isLevelCleared &&
      !run.gameState.isGameOver,
    );


export const isCandyCascadeRunFailed =
  (
    run:
      SavedGenZCandyCascadeRun |
      null,
  ) =>
    Boolean(
      run &&
      run.gameState.isGameOver &&
      !run.gameState.isLevelCleared,
    );


/*
 * ============================================================
 * DISCARD SAFETY
 * ============================================================
 *
 * Safe to discard:
 *
 * - no run
 * - failed run
 * - already fully settled run
 *
 * Do NOT discard a locally completed but unverified run.
 */

export const canDiscardCandyCascadeRun =
  (
    run:
      SavedGenZCandyCascadeRun |
      null,
  ) => {

    if (
      !run
    ) {
      return true;
    }


    if (
      hasPendingCandyCascadeSettlement(
        run,
      )
    ) {
      return false;
    }


    if (
      isCandyCascadeRunFullySettled(
        run,
      )
    ) {
      return true;
    }


    return run.gameState.isGameOver;
  };


/*
 * ============================================================
 * COPY EVENTS FOR BACKEND
 * ============================================================
 */

export const getCandyCascadeEventsForVerification =
  (
    run:
      SavedGenZCandyCascadeRun,
  ): CandyCascadeRunEvent[] =>
    run.events.map(
      event => {

        if (
          event.type ===
          "SWAP"
        ) {

          return {
            type:
              "SWAP",

            moveIndex:
              event.moveIndex,

            from: {
              ...event.from,
            },

            to: {
              ...event.to,
            },
          };
        }


        return {
          type:
            "CONTINUE",

          afterMoveIndex:
            event.afterMoveIndex,

          movesGranted:
            event.movesGranted,
        };
      },
    );


/*
 * ============================================================
 * LOCAL STORAGE RESET
 * ============================================================
 *
 * Useful only for development/testing.
 */

export const resetCandyCascadeLocalData =
  (
    userId:
      string,
  ) => {

    clearCandyCascadeRun(
      userId,
    );


    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      localStorage.removeItem(
        getProgressStorageKey(
          userId,
        ),
      );

    } catch {

      /*
       * No-op.
       */
    }
  };