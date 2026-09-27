import type {
  SavedGenZFlappyRocketRun,
} from "./flappyRocketTypes";


const STORAGE_PREFIX =
  "genzgames_flappy_rocket_active_run_v1";


/*
 * Each signed-in user gets their own
 * locally saved Flappy Rocket run.
 */
const getStorageKey =
  (
    userId:
      string,
  ) =>
    `${STORAGE_PREFIX}_${userId}`;


/*
 * =====================================================
 * RUN ID
 * =====================================================
 *
 * Local run identifier.
 *
 * Backend verification remains authoritative
 * before any cash or diamonds are granted.
 */
export const createFlappyRocketRunId =
  (): string => {

    const timePart =
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


    return `${timePart}-${randomPart}`;
  };


/*
 * =====================================================
 * DETERMINISTIC SEED
 * =====================================================
 */

export const createFlappyRocketSeed =
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


      return (
        values[0] >>>
        0
      );
    }


    return (
      Math.floor(
        Math.random() *
          4294967296,
      ) >>>
      0
    );
  };


/*
 * =====================================================
 * VALIDATE SAVED RUN
 * =====================================================
 *
 * Prevent corrupted/old localStorage data
 * from breaking the game.
 */
const isValidSavedRun =
  (
    value:
      unknown,
  ): value is SavedGenZFlappyRocketRun => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const run =
      value as
        Partial<SavedGenZFlappyRocketRun>;


    if (
      run.version !==
        1
    ) {
      return false;
    }


    if (
      typeof run.runId !==
        "string" ||
      !run.runId.trim()
    ) {
      return false;
    }


    if (
      !Number.isInteger(
        run.seed,
      ) ||
      (
        run.seed ??
        -1
      ) <
        0
    ) {
      return false;
    }


    if (
      !Number.isInteger(
        run.randomStep,
      ) ||
      (
        run.randomStep ??
        -1
      ) <
        0
    ) {
      return false;
    }


    if (
      !run.gameState ||
      typeof run.gameState !==
        "object"
    ) {
      return false;
    }


    if (
      !Array.isArray(
        run.flapEvents,
      )
    ) {
      return false;
    }


    if (
      run.reviveTick !==
        null &&
      (
        !Number.isInteger(
          run.reviveTick,
        ) ||
        (
          run.reviveTick ??
          -1
        ) <
          0
      )
    ) {
      return false;
    }


    if (
      run.rewardMilestoneTick !==
        null &&
      (
        !Number.isInteger(
          run.rewardMilestoneTick,
        ) ||
        (
          run.rewardMilestoneTick ??
          -1
        ) <
          0
      )
    ) {
      return false;
    }


    if (
      typeof run.rewardClaimed !==
        "boolean"
    ) {
      return false;
    }


    if (
      typeof run.startedAt !==
        "number" ||
      typeof run.updatedAt !==
        "number"
    ) {
      return false;
    }


    return true;
  };


/*
 * =====================================================
 * SAVE ACTIVE RUN
 * =====================================================
 *
 * localStorage only.
 *
 * No Firestore write.
 * No Cloud Function.
 */
export const saveGenZFlappyRocketRun =
  (
    userId:
      string,

    run:
      SavedGenZFlappyRocketRun,
  ): void => {

    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      localStorage.setItem(
        getStorageKey(
          userId,
        ),

        JSON.stringify({
          ...run,

          updatedAt:
            Date.now(),
        }),
      );

    } catch (
      error
    ) {

      console.error(
        "Unable to save Flappy Rocket run:",
        error,
      );
    }
  };


/*
 * =====================================================
 * LOAD ACTIVE RUN
 * =====================================================
 */

export const loadGenZFlappyRocketRun =
  (
    userId:
      string,
  ):
    SavedGenZFlappyRocketRun |
    null => {

    if (
      !userId.trim()
    ) {
      return null;
    }


    const key =
      getStorageKey(
        userId,
      );


    try {

      const raw =
        localStorage.getItem(
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

        localStorage.removeItem(
          key,
        );


        return null;
      }


      return parsed;

    } catch (
      error
    ) {

      console.error(
        "Unable to load Flappy Rocket run:",
        error,
      );


      try {

        localStorage.removeItem(
          key,
        );

      } catch {
        // Ignore cleanup failure.
      }


      return null;
    }
  };


/*
 * =====================================================
 * CLEAR ACTIVE RUN
 * =====================================================
 */

export const clearGenZFlappyRocketRun =
  (
    userId:
      string,
  ): void => {

    if (
      !userId.trim()
    ) {
      return;
    }


    try {

      localStorage.removeItem(
        getStorageKey(
          userId,
        ),
      );

    } catch (
      error
    ) {

      console.error(
        "Unable to clear Flappy Rocket run:",
        error,
      );
    }
  };