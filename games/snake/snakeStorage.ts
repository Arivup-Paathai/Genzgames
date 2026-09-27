import type {
  SavedGenZSnakeRun,
} from "./snakeTypes";


const STORAGE_PREFIX =
  "genzgames_snake_active_run_v1";


/*
 * Each signed-in user gets their own
 * local Snake run.
 *
 * This prevents one account on the same
 * phone from restoring another account's run.
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
 * Only identifies this local run.
 *
 * The backend will still independently
 * verify gameplay before granting rewards.
 */
export const createSnakeRunId =
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
export const createSnakeSeed =
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
        values[
          0
        ] >>>
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
 * SAVE ACTIVE RUN
 * =====================================================
 *
 * localStorage only.
 *
 * No Firebase write.
 * No Cloud Function.
 */
export const saveGenZSnakeRun =
  (
    userId:
      string,

    run:
      SavedGenZSnakeRun,
  ): void => {

    if (
      !userId
        .trim()
    ) {
      return;
    }


    try {

      localStorage.setItem(
        getStorageKey(
          userId,
        ),

        JSON.stringify(
          run,
        ),
      );

    } catch (
      error
    ) {

      console.error(
        "Unable to save GenZSnake run:",
        error,
      );
    }
  };


/*
 * Small runtime validation.
 *
 * If localStorage becomes corrupted or
 * contains an old incompatible version,
 * ignore it instead of breaking the game.
 */
const isValidSavedRun =
  (
    value:
      unknown,
  ): value is SavedGenZSnakeRun => {

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return false;
    }


    const run =
      value as
        Partial<SavedGenZSnakeRun>;


    if (
      run.version !==
        1
    ) {
      return false;
    }


    if (
      typeof run.runId !==
        "string" ||
      !run.runId
        .trim()
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
      !Number.isInteger(
        run.level,
      ) ||
      (
        run.level ??
        0
      ) <
        1
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
        run.directionEvents,
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
 * LOAD ACTIVE RUN
 * =====================================================
 */
export const loadGenZSnakeRun =
  (
    userId:
      string,
  ):
    SavedGenZSnakeRun |
    null => {

    if (
      !userId
        .trim()
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
        "Unable to load GenZSnake run:",
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
export const clearGenZSnakeRun =
  (
    userId:
      string,
  ): void => {

    if (
      !userId
        .trim()
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
        "Unable to clear GenZSnake run:",
        error,
      );
    }
  };