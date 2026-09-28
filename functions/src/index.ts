import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";
import * as crypto from "node:crypto";
import { generateGenZSudokuLevel } from "./genzGamesEngine.js";

import {
  GENZ_SNAKE_MAX_DIRECTION_EVENTS,
  GENZ_SNAKE_MAX_REPLAY_TICKS,
  isGenZSnakeDirection,
  replayGenZSnakeRun,
  type GenZSnakeDirectionEvent,
} from "./genzSnakeEngine.js";

import {
  GENZ_FLAPPY_MAX_FLAP_EVENTS,
  GENZ_FLAPPY_MAX_REPLAY_TICKS,
  GENZ_FLAPPY_REWARD_SCORE,
  replayGenZFlappyRocketRun,
  type GenZFlappyRocketFlapEvent,
} from "./genzFlappyRocketEngine.js";

import {
  KNIFE_HIT_LEVELS_PER_BATCH,
  replayKnifeHitRun,
  type KnifeHitReplayAttemptInput,
  type KnifeHitReplayEndReason,
} from "./genzKnifeHitEngine.js";

import {
  GENZ_BRICK_BREAKER_MAX_INPUT_EVENTS,
  GENZ_BRICK_BREAKER_MAX_LEVEL,
  GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS,
  GENZ_BRICK_BREAKER_MAX_REVIVES,
  isGenZBrickBreakerInputEvent,
  isGenZBrickBreakerReviveEvent,
  replayGenZBrickBreakerRun,
  type GenZBrickBreakerInputEvent,
  type GenZBrickBreakerReviveEvent,
} from "./genzBrickBreakerEngine.js";

import {
  GENZ_CANDY_CASCADE_DIAMOND_REWARD,
  GENZ_CANDY_CASCADE_MAX_ELAPSED_SECONDS,
  GENZ_CANDY_CASCADE_MAX_LEVEL,
  GENZ_CANDY_CASCADE_MAX_RUN_EVENTS,
  GENZ_CANDY_CASCADE_REWARD_PAISE,
  getGenZCandyCascadeStarCount,
  isGenZCandyCascadeCompletedReplay,
  isGenZCandyCascadeRunEvent,
  replayGenZCandyCascadeRun,
  type GenZCandyCascadeRunEvent,
} from "./genzCandyCascadeEngine.js";

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

const CURRENCY = "INR" as const;
const GENZ_GAMES_ALL_USERS_TOPIC =
  "genzgames_all";
const SUDOKU_TOTAL_LEVELS = 1000;
const NORMAL_GAME_REWARD_PAISE = 5; // ₹0.05
const FIRST_GAME_REWARD_PAISE = 100; // first successful Sudoku completion = ₹1.00 incl. welcome bonus

/*
 * =====================================================
 * 7-DAY DAILY STREAK
 * =====================================================
 *
 * Complete 3 verified eligible game levels per IST day.
 *
 * Each successful day adds ₹0.05 to the PENDING
 * streak bonus only.
 *
 * Day 1 = ₹0.05 pending
 * Day 2 = ₹0.10 pending
 * ...
 * Day 7 = ₹0.35 credited to Game Balance.
 *
 * Missing one complete IST calendar day resets:
 * - streak
 * - today's progress
 * - pending streak bonus
 */
const DAILY_STREAK_LEVEL_TARGET =
  3;

const DAILY_STREAK_TOTAL_DAYS =
  7;

const DAILY_STREAK_BONUS_PAISE_PER_DAY =
  5;

const DAILY_STREAK_FULL_REWARD_PAISE =
  DAILY_STREAK_TOTAL_DAYS *
  DAILY_STREAK_BONUS_PAISE_PER_DAY;

const FIRST_REDEEM_MIN_PAISE = 100; // ₹1.00
const STANDARD_REDEEM_MIN_PAISE = 500; // ₹5.00
const GOLD_MINE_COUNT = 5;
const MINE_CYCLE_SECONDS = 180;
const MINE_CAPACITY_GOLD = 300;
const MINE_GOLD_PER_MINUTE = 100;

/*
 * Gold Mine:
 *
 * Each miner works independently.
 *
 * 100 Gold / minute
 * 3-minute cycle
 * 300 Gold capacity
 * ₹0.05 / 5 paise per completed miner cycle.
 */
const GOLD_MINE_REWARD_PAISE =
  5;
/*
 * =====================================================
 * REAL GOLD MINING
 * =====================================================
 *
 * Completely separate from Cash Mine.
 *
 * 2 independent miners
 * 15-minute cycle
 * 100 Gold Ore / minute
 * 1,500 Gold Ore capacity
 * Each completed miner gives:
 * - real gold worth ₹0.06
 * - 10 diamonds
 *
 * Gold rate is controlled by Admin.
 * Default fallback = ₹12,000 / gram.
 */
const REAL_GOLD_MINER_COUNT =
  2;

const REAL_GOLD_MINE_CYCLE_SECONDS =
  15 * 60;

const REAL_GOLD_ORE_PER_MINUTE =
  100;

const REAL_GOLD_ORE_CAPACITY =
  1500;

const REAL_GOLD_REWARD_PAISE =
  6;

const REAL_GOLD_DIAMOND_REWARD =
  10;

/*
 * Real Gold redemption:
 *
 * Users redeem exactly ₹5 worth of their
 * accumulated Real Gold balance.
 *
 * The actual nanograms required are calculated
 * from the Admin gold rate at request time.
 */
const REAL_GOLD_REDEMPTION_PAISE =
  500;

const DEFAULT_GOLD_RATE_PAISE_PER_GRAM =
  12000 * 100;

const NANOGRAMS_PER_GRAM =
  1_000_000_000;

const REAL_GOLD_CONFIG_COLLECTION =
  "genzGamesConfig";

const REAL_GOLD_CONFIG_DOCUMENT =
  "realGoldMining";

/*
 * =====================================================
 * GENZGAMES DIAMONDS
 * =====================================================
 *
 * Daily leaderboard day:
 * Asia/Kolkata / IST
 *
 * 00:00:00 -> 23:59:59
 *
 * Rewards:
 * Sudoku first completion = 10
 * Gold Mine collect      = 2
 * Successful referral    = 20
 */
const SUDOKU_DIAMOND_REWARD =
  10;

const GOLD_MINE_DIAMOND_REWARD =
  2;

const GENZ_2048_MAX_REWARD_PAISE =
  5;

const GENZ_2048_MAX_DIAMOND_REWARD =
  10;

const SNAKE_REWARD_PAISE =
  5;


const SNAKE_DIAMOND_REWARD =
  10;

const FLAPPY_ROCKET_REWARD_PAISE =
  5;


const FLAPPY_ROCKET_DIAMOND_REWARD =
  10;


const BRICK_BREAKER_REWARD_PAISE =
  5;


const BRICK_BREAKER_DIAMOND_REWARD =
  10;


const SNAKE_MAX_LEVEL =
  1000;

const REFERRAL_DIAMOND_REWARD =
  20;
/*
 * Referrer receives ₹0.01 whenever
 * a referred player completes one
 * NEW eligible earning event.
 */
const REFERRAL_GAME_REWARD_PAISE =
  1;

const IST_OFFSET_MS =
  (
    5 *
    60 +
    30
  ) *
  60 *
  1000;


const DAY_MS =
  24 *
  60 *
  60 *
  1000;


const REFERRAL_ID_PREFIX =
  "GZ";


const REFERRAL_ID_PATTERN =
  /^GZ[A-F0-9]{10}$/;


const PAYOUT_ENCRYPTION_KEY = defineSecret("PAYOUT_ENCRYPTION_KEY");
const R2_ACCESS_KEY_ID =
  defineSecret(
    "R2_ACCESS_KEY_ID",
  );

const R2_SECRET_ACCESS_KEY =
  defineSecret(
    "R2_SECRET_ACCESS_KEY",
  );

const R2_ACCOUNT_ID =
  defineSecret(
    "R2_ACCOUNT_ID",
  );

const R2_BUCKET_NAME =
  defineSecret(
    "R2_BUCKET_NAME",
  );

const R2_PUBLIC_BASE_URL =
  defineSecret(
    "R2_PUBLIC_BASE_URL",
  );


const PROFILE_PHOTO_MAX_BYTES =
  5 *
  1024 *
  1024;


const PROFILE_PHOTO_CONTENT_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);


function createR2Client() {

  return new S3Client({
    region:
      "auto",

    endpoint:
      `https://${R2_ACCOUNT_ID.value()}.r2.cloudflarestorage.com`,

    credentials: {
      accessKeyId:
        R2_ACCESS_KEY_ID.value(),

      secretAccessKey:
        R2_SECRET_ACCESS_KEY.value(),
    },
  });
}


function profilePhotoObjectKey(
  uid:
    string,
) {

  return `profiles/${uid}/avatar`;
}


function profilePhotoPublicUrl(
  uid:
    string,
) {

  const base =
    R2_PUBLIC_BASE_URL
      .value()
      .replace(
        /\/+$/,
        "",
      );


  return `${base}/${profilePhotoObjectKey(uid)}`;
}

interface PushDeviceRequest {
  token?: unknown;
  platform?: unknown;
}


interface UnregisterPushDeviceRequest {
  token?: unknown;
}


const getPushDeviceId =
  (
    token: string,
  ) =>
    crypto
      .createHash(
        "sha256",
      )
      .update(
        token,
      )
      .digest(
        "hex",
      );


interface MiniGamesPushOptions {
  userId: string;

  title: string;

  body: string;

  type:
    | "admin_redemption"
    | "payout"
    | "admin_message";

  data?: Record<
    string,
    string
  >;
}


async function sendMiniGamesPushNotification(
  options:
    MiniGamesPushOptions,
) {

  const userId =
    options.userId.trim();


  if (
    !userId
  ) {
    return;
  }


  try {

    const snapshot =
      await db
        .collection(
          "pushDevices",
        )
        .where(
          "userId",
          "==",
          userId,
        )
        .get();


    const devices =
      snapshot.docs
        .map(
          (
            document,
          ) => {

            const data =
              document.data();


            const token =
              typeof data.token ===
              "string"
                ? data.token.trim()
                : "";


            if (
              !token ||
              data.enabled === false
            ) {
              return null;
            }


            return {
              ref:
                document.ref,

              token,
            };
          },
        )
        .filter(
          (
            device,
          ):
            device is {
              ref:
                FirebaseFirestore.DocumentReference;

              token:
                string;
            } =>
              device !==
              null,
        );


    if (
      devices.length ===
      0
    ) {
      return;
    }


    for (
      let index = 0;
      index <
        devices.length;
      index += 500
    ) {

      const chunk =
        devices.slice(
          index,
          index + 500,
        );


      const response =
        await getMessaging()
          .sendEachForMulticast({
            tokens:
              chunk.map(
                (
                  device,
                ) =>
                  device.token,
              ),

            notification: {
              title:
                options.title,

              body:
                options.body,
            },

            data: {
              type:
                options.type,

              ...(options.data ?? {}),
            },

            android: {
              priority:
                "high",

              notification: {
                channelId:
                  "mini_games_wallet",

                sound:
                  "default",
              },
            },
          });


      const invalidRefs:
        FirebaseFirestore.DocumentReference[] =
        [];


      response.responses
        .forEach(
          (
            result,
            responseIndex,
          ) => {

            if (
              result.success
            ) {
              return;
            }


            const code =
              result.error?.code ??
              "";


            if (
              code ===
                "messaging/registration-token-not-registered" ||
              code ===
                "messaging/invalid-registration-token"
            ) {

              invalidRefs.push(
                chunk[
                  responseIndex
                ].ref,
              );

            }
          },
        );


      if (
        invalidRefs.length >
        0
      ) {

        const batch =
          db.batch();


        invalidRefs.forEach(
          (
            ref,
          ) =>
            batch.delete(
              ref,
            ),
        );


        await batch.commit();
      }
    }

  } catch (error) {

    // Push failure must never break
    // wallet/redemption processing.
    console.error(
      "Unable to send GenZGames push notification:",
      error,
    );

  }
}

async function sendMiniGamesTopicNotification(
  options: {
    title:
      string;

    body:
      string;

    type:
      "admin_message";

    data?: Record<
      string,
      string
    >;
  },
) {

  await getMessaging()
    .send({
      topic:
        GENZ_GAMES_ALL_USERS_TOPIC,

      notification: {
        title:
          options.title,

        body:
          options.body,
      },

      data: {
        type:
          options.type,

        ...(options.data ?? {}),
      },

      android: {
        priority:
          "high",

        notification: {
          channelId:
            "mini_games_wallet",

          sound:
            "default",
        },
      },
    });
}

const safeInt = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeKnifeHitBatchStart =
  (
    value:
      unknown,
  ) => {

    const level =
      Math.max(
        1,
        safeInt(
          value,
        ) ||
          1,
      );


    return (
      Math.floor(
        (
          level -
          1
        ) /
          KNIFE_HIT_LEVELS_PER_BATCH,
      ) *
        KNIFE_HIT_LEVELS_PER_BATCH
    ) +
      1;
  };

const iso = (value: unknown): string => value instanceof Timestamp ? value.toDate().toISOString() : "";
const normalizeCompleted = (value: unknown): number[] => Array.isArray(value) ? Array.from(new Set(value.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= SUDOKU_TOTAL_LEVELS))).sort((a,b)=>a-b) : [];
const normalizeCandyCascadeLevelStars =
  (
    value:
      unknown,
  ):
    Record<
      string,
      number
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
        string,
        number
      > =
      {};


    Object.entries(
      value,
    ).forEach(
      (
        [
          key,
          rawStars,
        ],
      ) => {

        const level =
          Number(
            key,
          );


        const stars =
          safeInt(
            rawStars,
          );


        if (
          !Number.isInteger(
            level,
          ) ||
          level <
            1 ||
          level >
            GENZ_CANDY_CASCADE_MAX_LEVEL ||
          stars >
            3
        ) {
          return;
        }


        normalized[
          String(
            level,
          )
        ] =
          stars;
      },
    );


    return normalized;
  };


const getCandyCascadeTotalStars =
  (
    levelStars:
      Record<
        string,
        number
      >,
  ) =>
    Object.values(
      levelStars,
    ).reduce(
      (
        total,
        stars,
      ) =>
        total +
        stars,
      0,
    );


function normalizeGenZCandyCascadeEvents(
  value:
    unknown,
):
  GenZCandyCascadeRunEvent[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_CANDY_CASCADE_MAX_RUN_EVENTS
  ) {
    return null;
  }


  const events:
    GenZCandyCascadeRunEvent[] =
    [];


  for (
    const item of
    value
  ) {

    if (
      !isGenZCandyCascadeRunEvent(
        item,
      )
    ) {
      return null;
    }


    if (
      item.type ===
      "SWAP"
    ) {

      events.push({
        type:
          "SWAP",

        moveIndex:
          item.moveIndex,

        from: {
          row:
            item.from.row,

          col:
            item.from.col,
        },

        to: {
          row:
            item.to.row,

          col:
            item.to.col,
        },
      });


      continue;
    }


    events.push({
      type:
        "CONTINUE",

      afterMoveIndex:
        item.afterMoveIndex,

      movesGranted:
        item.movesGranted,
    });
  }


  return events;
}
const nextReward = (account: FirebaseFirestore.DocumentData) => account.firstGameRewardGranted === true ? NORMAL_GAME_REWARD_PAISE : FIRST_GAME_REWARD_PAISE;
const minRedeem = (account: FirebaseFirestore.DocumentData) => account.hasCompletedFirstGameRedemption === true || safeInt(account.redeemedPaise) > 0 ? STANDARD_REDEEM_MIN_PAISE : FIRST_REDEEM_MIN_PAISE;

const accountDefaults = (uid: string) => ({
  userId:
    uid,

  currency:
    CURRENCY,

  balancePaise:
    0,

  lifetimeEarningsPaise:
    0,

  lifetimeDiamonds:
  0,

/*
 * Cash earned because referred
 * players completed eligible
 * GenZGames earning events.
 */
referralEarningsPaise:
  0,

referralEarningsTodayPaise:
  0,

referralEarningsDayKey:
  "",

referralQualifiedEvents:
  0,

referralUsersCount:
  0,

redeemedPaise:
  0,

  pendingRedemptionPaise:
    0,

  firstGameRewardGranted:
    false,

  hasCompletedFirstGameRedemption:
    false,

  /*
   * ===================================================
   * 7-DAY DAILY STREAK
   * ===================================================
   */

  dailyStreakDay:
    0,

  dailyStreakProgress:
    0,

  dailyStreakProgressDayKey:
    "",

  dailyStreakLastCompletedDayKey:
    "",

  dailyStreakPendingPaise:
    0,

  dailyStreakCompletedCycles:
    0,

  dailyStreakLifetimeRewardPaise:
    0,

  sudokuCompletedLevelNumbers:
    [],

  sudokuHighestUnlockedLevel:
    1,

  goldMineCollectedCycles:
    0,

  /*
   * Legacy single-miner fields.
   *
   * Keep these for compatibility with
   * accounts created before the 5-miner
   * Gold Mine release.
   *
   * Legacy active state is treated as
   * Miner 1 until it is collected.
   */
  goldMineCurrentCycleId:
    null,

  goldMineStartedAt:
    null,

  /*
   * New independent miner states.
   */
  goldMiners: {
    "1": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },

    "2": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },

    "3": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },

    "4": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },

    "5": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },
  },
  
    /*
   * ===================================================
   * REAL GOLD MINING
   * ===================================================
   *
   * Separate from Cash Mine.
   *
   * Gold balance is stored as integer nanograms.
   */
  realGoldBalanceNanograms:
    0,

  realGoldLifetimeNanograms:
    0,

  /*
   * Real Gold currently reserved for a
   * pending ₹5 redemption.
   *
   * Kept completely separate from the
   * normal cash-wallet redemption.
   */
  pendingRealGoldRedemptionNanograms:
    0,

  /*
   * Total Real Gold successfully redeemed.
   */
  redeemedRealGoldNanograms:
    0,

  realGoldCollectedCycles:
    0,

  realGoldMiners: {
    "1": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },

    "2": {
      currentCycleId:
        null,

      startedAt:
        null,

      collectedCycles:
        0,
    },
  },

  game2048CompletedRuns:
    0,

  game2048BestTile:
    0,

  game2048HighScore:
    0,
  
  snakeHighestUnlockedLevel:
  1,

snakeCompletedRuns:
  0,

snakeBestScore:
  0,

snakeBestLevel:
  1,

flappyRocketCompletedRuns:
  0,

knifeHitCompletedRuns:
  0,

knifeHitBestScore:
  0,

knifeHitHighestLevelCleared:
  0,

knifeHitHighestUnlockedBatchStart:
  1,

brickBreakerRewardedRuns:
  0,

brickBreakerCompletedRuns:
  0,

brickBreakerBestScore:
  0,

brickBreakerHighestLevelCleared:
  0,

brickBreakerHighestUnlockedLevel:
  1,

candyCascadeCompletedRuns:
  0,

candyCascadeBestScore:
  0,

candyCascadeHighestLevelCleared:
  0,

candyCascadeHighestUnlockedLevel:
  1,

candyCascadeLevelStars:
  {},

  createdAt:
    FieldValue.serverTimestamp(),

  updatedAt:
    FieldValue.serverTimestamp(),
});

type GenZDiamondSource =
  | "sudoku"
  | "mining"
  | "2048"
  | "snake"
  | "flappyRocket"
  | "knifeHit"
  | "brickBreaker"
  | "candyCascade"
  | "referral";


const getIstDayKey =
  (
    date:
      Date =
      new Date(),

    dayOffset =
      0,
  ) => {

    const shifted =
      new Date(
        date.getTime() +
        IST_OFFSET_MS +
        dayOffset *
          DAY_MS,
      );


    return shifted
      .toISOString()
      .slice(
        0,
        10,
      );
  };

interface DailyStreakResult {
  day:
    number;

  progress:
    number;

  progressDayKey:
    string;

  lastCompletedDayKey:
    string;

  pendingPaise:
    number;

  completedCycles:
    number;

  lifetimeRewardPaise:
    number;

  walletCreditPaise:
    number;

  dayCompleted:
    boolean;

  cycleCompleted:
    boolean;
}


function getDailyStreakState(
  account:
    FirebaseFirestore.DocumentData,

  dayKey:
    string,

  now:
    Timestamp,
): DailyStreakResult {

  const yesterdayKey =
    getIstDayKey(
      now.toDate(),
      -1,
    );


  const storedProgressDayKey =
    typeof account
      .dailyStreakProgressDayKey ===
    "string"
      ? account
          .dailyStreakProgressDayKey
      : "";


  const storedLastCompletedDayKey =
    typeof account
      .dailyStreakLastCompletedDayKey ===
    "string"
      ? account
          .dailyStreakLastCompletedDayKey
      : "";


  let streakDay =
    Math.min(
      DAILY_STREAK_TOTAL_DAYS,

      safeInt(
        account
          .dailyStreakDay,
      ),
    );


  let progress =
    Math.min(
      DAILY_STREAK_LEVEL_TARGET,

      safeInt(
        account
          .dailyStreakProgress,
      ),
    );


  let pendingPaise =
    safeInt(
      account
        .dailyStreakPendingPaise,
    );


  const completedCycles =
    safeInt(
      account
        .dailyStreakCompletedCycles,
    );


  const lifetimeRewardPaise =
    safeInt(
      account
        .dailyStreakLifetimeRewardPaise,
    );


  /*
   * We entered a new IST calendar day.
   */
  if (
    storedProgressDayKey !==
    dayKey
  ) {

    progress =
      0;


    /*
     * Day 7 was completed yesterday.
     *
     * That cycle has already been paid,
     * so today's first completion starts
     * a completely fresh Day 1.
     */
    if (
      streakDay >=
        DAILY_STREAK_TOTAL_DAYS &&
      storedLastCompletedDayKey ===
        yesterdayKey
    ) {

      streakDay =
        0;

      pendingPaise =
        0;

    } else if (
      storedLastCompletedDayKey !==
      yesterdayKey
    ) {

      /*
       * User missed at least one required
       * calendar day.
       *
       * All pending streak money is lost.
       */
      streakDay =
        0;

      pendingPaise =
        0;
    }
  }


  return {
    day:
      streakDay,

    progress,

    progressDayKey:
      dayKey,

    lastCompletedDayKey:
      storedLastCompletedDayKey,

    pendingPaise,

    completedCycles,

    lifetimeRewardPaise,

    walletCreditPaise:
      0,

    dayCompleted:
      false,

    cycleCompleted:
      false,
  };
}


function applyDailyStreakLevelCompletion(
  account:
    FirebaseFirestore.DocumentData,

  dayKey:
    string,

  now:
    Timestamp,

  verifiedLevelCount =
    1,
): DailyStreakResult {

  const current =
    getDailyStreakState(
      account,
      dayKey,
      now,
    );


  /*
   * Today's task was already completed.
   *
   * Additional levels today do not
   * increase the streak again.
   */
  if (
    current.progress >=
    DAILY_STREAK_LEVEL_TARGET
  ) {
    return current;
  }


  const safeVerifiedLevelCount =
    Math.max(
      0,

      safeInt(
        verifiedLevelCount,
      ),
    );


  const nextProgress =
    Math.min(
      DAILY_STREAK_LEVEL_TARGET,

      current.progress +
      safeVerifiedLevelCount,
    );


  /*
   * Still working toward today's 3 levels.
   */
  if (
    nextProgress <
    DAILY_STREAK_LEVEL_TARGET
  ) {

    return {
      ...current,

      progress:
        nextProgress,
    };
  }


  const nextDay =
    Math.min(
      DAILY_STREAK_TOTAL_DAYS,

      current.day +
      1,
    );


  const nextPendingPaise =
    nextDay *
    DAILY_STREAK_BONUS_PAISE_PER_DAY;


  /*
   * Days 1-6:
   *
   * Money remains pending and cannot
   * be withdrawn.
   */
  if (
    nextDay <
    DAILY_STREAK_TOTAL_DAYS
  ) {

    return {
      ...current,

      day:
        nextDay,

      progress:
        DAILY_STREAK_LEVEL_TARGET,

      lastCompletedDayKey:
        dayKey,

      pendingPaise:
        nextPendingPaise,

      dayCompleted:
        true,
    };
  }


  /*
   * Day 7:
   *
   * The complete ₹0.35 streak is now
   * valid and enters Game Balance.
   */
  return {
    ...current,

    day:
      DAILY_STREAK_TOTAL_DAYS,

    progress:
      DAILY_STREAK_LEVEL_TARGET,

    lastCompletedDayKey:
      dayKey,

    pendingPaise:
      0,

    completedCycles:
      current.completedCycles +
      1,

    lifetimeRewardPaise:
      current.lifetimeRewardPaise +
      DAILY_STREAK_FULL_REWARD_PAISE,

    walletCreditPaise:
      DAILY_STREAK_FULL_REWARD_PAISE,

    dayCompleted:
      true,

    cycleCompleted:
      true,
  };
}


function getDailyStreakAccountUpdate(
  streak:
    DailyStreakResult,
) {

  return {
    dailyStreakDay:
      streak.day,

    dailyStreakProgress:
      streak.progress,

    dailyStreakProgressDayKey:
      streak.progressDayKey,

    dailyStreakLastCompletedDayKey:
      streak.lastCompletedDayKey,

    dailyStreakPendingPaise:
      streak.pendingPaise,

    dailyStreakCompletedCycles:
      streak.completedCycles,

    dailyStreakLifetimeRewardPaise:
      streak.lifetimeRewardPaise,
  };
}
type ReferralCashSource =
  | "sudoku"
  | "mining"
  | "2048"
  | "snake"
  | "flappyRocket"
  | "knifeHit"
  | "brickBreaker"
  | "candyCascade";


async function creditReferralGameReward(
  tx:
    FirebaseFirestore.Transaction,

  options: {
    referredUserId:
      string;

    referredByUserId:
      unknown;

    referredByReferralId:
      unknown;

    source:
      ReferralCashSource;

    eventId:
      string;

    now:
      Timestamp;
  },
) {

  const referredUserId =
    options
      .referredUserId
      .trim();


  const referrerUserId =
    typeof options
      .referredByUserId ===
    "string"
      ? options
          .referredByUserId
          .trim()
      : "";


  /*
   * User has no referrer.
   */
  if (
    !referrerUserId ||
    referrerUserId ===
      referredUserId
  ) {

    return {
      credited:
        false,

      amountPaise:
        0,
    };
  }


  const referrerAccountRef =
    db
      .collection(
        "genzGameAccounts",
      )
      .doc(
        referrerUserId,
      );


  /*
   * Deterministic audit record.
   *
   * The player's own verified game
   * transaction remains the primary
   * duplicate guard.
   *
   * This record gives us a clean
   * history of referral earnings.
   */
  const referralRewardId =
    crypto
      .createHash(
        "sha256",
      )
      .update(
        [
          referrerUserId,
          referredUserId,
          options.source,
          options.eventId,
        ].join(
          "|",
        ),
      )
      .digest(
        "hex",
      );


  const referralRewardRef =
    db
      .collection(
        "genzReferralEarnings",
      )
      .doc(
        referralRewardId,
      );


  /*
   * IMPORTANT:
   *
   * Call this helper only AFTER all
   * other transaction reads have
   * completed.
   */
  const referrerAccountSnapshot =
    await tx.get(
      referrerAccountRef,
    );


  const referrerAccount =
    referrerAccountSnapshot.exists
      ? (
          referrerAccountSnapshot
            .data() ??
          {}
        )
      : accountDefaults(
          referrerUserId,
        );


  const dayKey =
    getIstDayKey(
      options
        .now
        .toDate(),
    );


  const previousDayKey =
    typeof referrerAccount
      .referralEarningsDayKey ===
    "string"
      ? referrerAccount
          .referralEarningsDayKey
      : "";


  const previousToday =
    previousDayKey ===
    dayKey
      ? safeInt(
          referrerAccount
            .referralEarningsTodayPaise,
        )
      : 0;


  const nextBalance =
    safeInt(
      referrerAccount
        .balancePaise,
    ) +
    REFERRAL_GAME_REWARD_PAISE;


  const nextLifetimeEarnings =
    safeInt(
      referrerAccount
        .lifetimeEarningsPaise,
    ) +
    REFERRAL_GAME_REWARD_PAISE;


  const nextReferralLifetime =
    safeInt(
      referrerAccount
        .referralEarningsPaise,
    ) +
    REFERRAL_GAME_REWARD_PAISE;


  const nextReferralToday =
    previousToday +
    REFERRAL_GAME_REWARD_PAISE;


  const nextQualifiedEvents =
    safeInt(
      referrerAccount
        .referralQualifiedEvents,
    ) +
    1;


  if (
    referrerAccountSnapshot.exists
  ) {

    tx.set(
      referrerAccountRef,
      {
        balancePaise:
          nextBalance,

        lifetimeEarningsPaise:
          nextLifetimeEarnings,

        referralEarningsPaise:
          nextReferralLifetime,

        referralEarningsTodayPaise:
          nextReferralToday,

        referralEarningsDayKey:
          dayKey,

        referralQualifiedEvents:
          nextQualifiedEvents,

        updatedAt:
          options.now,
      },
      {
        merge:
          true,
      },
    );

  } else {

    tx.set(
      referrerAccountRef,
      {
        ...referrerAccount,

        balancePaise:
          nextBalance,

        lifetimeEarningsPaise:
          nextLifetimeEarnings,

        referralEarningsPaise:
          nextReferralLifetime,

        referralEarningsTodayPaise:
          nextReferralToday,

        referralEarningsDayKey:
          dayKey,

        referralQualifiedEvents:
          nextQualifiedEvents,

        createdAt:
          options.now,

        updatedAt:
          options.now,
      },
    );
  }


  tx.set(
    referralRewardRef,
    {
      referrerUserId,

      referredUserId,

      referralId:
        typeof options
          .referredByReferralId ===
        "string"
          ? options
              .referredByReferralId
              .trim()
          : "",

      source:
        options.source,

      eventId:
        options.eventId,

      amountPaise:
        REFERRAL_GAME_REWARD_PAISE,

      currency:
        CURRENCY,

      dayKey,

      createdAt:
        options.now,
    },
  );


  return {
    credited:
      true,

    amountPaise:
      REFERRAL_GAME_REWARD_PAISE,
  };
}


const getDailyDiamondPlayerRef =
  (
    dayKey:
      string,

    uid:
      string,
  ) =>
    db
      .collection(
        "genzDailyDiamondLeaderboards",
      )
      .doc(
        dayKey,
      )
      .collection(
        "players",
      )
      .doc(
        uid,
      );


function buildDailyDiamondPlayerData(
  existing:
    FirebaseFirestore.DocumentData,

  options: {
    uid: string;
    dayKey: string;
    amount: number;
    source: GenZDiamondSource;
    userData:
      FirebaseFirestore.DocumentData;
    now: Timestamp;
  },
) {

  const amount =
    safeInt(
      options.amount,
    );


  const currentDiamonds =
    safeInt(
      existing.diamonds,
    );


  return {
    userId:
      options.uid,

    dayKey:
      options.dayKey,

    gamerName:
      String(
        options.userData
          .gamerName ??
        options.userData
          .displayName ??
        "Player",
      ),

    photoUrl:
      String(
        options.userData
          .photoUrl ??
        "",
      ),

    diamonds:
      currentDiamonds +
      amount,

    sudokuDiamonds:
      safeInt(
        existing
          .sudokuDiamonds,
      ) +
      (
        options.source ===
        "sudoku"
          ? amount
          : 0
      ),

    miningDiamonds:
      safeInt(
        existing
          .miningDiamonds,
      ) +
      (
        options.source ===
        "mining"
          ? amount
          : 0
      ),

    referralDiamonds:
      safeInt(
        existing
          .referralDiamonds,
      ) +
      (
        options.source ===
        "referral"
          ? amount
          : 0
      ),

    game2048Diamonds:
      safeInt(
        existing
          .game2048Diamonds,
      ) +
      (
        options.source ===
        "2048"
          ? amount
          : 0
      ),

    snakeDiamonds:
  safeInt(
    existing
      .snakeDiamonds,
  ) +
  (
    options.source ===
    "snake"
      ? amount
      : 0
  ),

  flappyRocketDiamonds:
  safeInt(
    existing
      .flappyRocketDiamonds,
  ) +
  (
    options.source ===
    "flappyRocket"
      ? amount
      : 0
  ),

  knifeHitDiamonds:
  safeInt(
    existing
      .knifeHitDiamonds,
  ) +
  (
    options.source ===
    "knifeHit"
      ? amount
      : 0
  ),

  brickBreakerDiamonds:
  safeInt(
    existing
      .brickBreakerDiamonds,
  ) +
  (
    options.source ===
    "brickBreaker"
      ? amount
      : 0
  ),

  candyCascadeDiamonds:
  safeInt(
    existing
      .candyCascadeDiamonds,
  ) +
  (
    options.source ===
    "candyCascade"
      ? amount
      : 0
  ),

    createdAt:
      existing.createdAt ??
      options.now,

    updatedAt:
      options.now,

    lastEarnedAt:
      options.now,
  };
}


function normalizeReferralId(
  value:
    unknown,
) {

  if (
    typeof value !==
    "string"
  ) {
    return "";
  }


  const referralId =
    value
      .trim()
      .toUpperCase();


  return REFERRAL_ID_PATTERN
    .test(
      referralId,
    )
      ? referralId
      : "";
}


function createReferralIdCandidate(
  uid:
    string,

  attempt:
    number,
) {

  const suffix =
    crypto
      .createHash(
        "sha256",
      )
      .update(
        `${uid}:${attempt}`,
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        10,
      )
      .toUpperCase();


  return `${REFERRAL_ID_PREFIX}${suffix}`;
}


async function ensureReferralIdentity(
  uid:
    string,
) {

  const userRef =
    db
      .collection(
        "users",
      )
      .doc(
        uid,
      );


  const currentSnapshot =
    await userRef.get();


  if (
    !currentSnapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Profile not found.",
    );
  }


  const existingReferralId =
    normalizeReferralId(
      currentSnapshot
        .data()
        ?.referralId,
    );


  /*
   * Existing users who already have an ID:
   * make sure its claim document exists.
   */
  if (
    existingReferralId
  ) {

    const claimRef =
      db
        .collection(
          "genzReferralClaims",
        )
        .doc(
          existingReferralId,
        );


    await db.runTransaction(
      async (
        tx,
      ) => {

        const [
          userSnapshot,
          claimSnapshot,
        ] =
          await Promise.all([
            tx.get(
              userRef,
            ),

            tx.get(
              claimRef,
            ),
          ]);


        if (
          !userSnapshot.exists
        ) {
          throw new HttpsError(
            "not-found",
            "Profile not found.",
          );
        }


        if (
          claimSnapshot.exists &&
          claimSnapshot
            .data()
            ?.userId !==
            uid
        ) {
          throw new HttpsError(
            "internal",
            "Referral ID conflict detected.",
          );
        }


        const now =
          Timestamp.now();


        tx.set(
          claimRef,
          {
            userId:
              uid,

            referralId:
              existingReferralId,

            createdAt:
              claimSnapshot.exists
                ? (
                    claimSnapshot
                      .data()
                      ?.createdAt ??
                    now
                  )
                : now,

            updatedAt:
              now,
          },
          {
            merge:
              true,
          },
        );
      },
    );


    return existingReferralId;
  }


  /*
   * New referral IDs use a deterministic candidate
   * plus a Firestore claim document.
   *
   * If the extremely unlikely event of a collision
   * happens, another candidate is tried.
   */
  for (
    let attempt =
      0;

    attempt <
      20;

    attempt +=
      1
  ) {

    const candidate =
      createReferralIdCandidate(
        uid,
        attempt,
      );


    try {

      const assigned =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const userSnapshot =
              await tx.get(
                userRef,
              );


            if (
              !userSnapshot.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Profile not found.",
              );
            }


            const latestExisting =
              normalizeReferralId(
                userSnapshot
                  .data()
                  ?.referralId,
              );


            /*
             * Another request may already have
             * assigned an ID while we waited.
             */
            if (
              latestExisting
            ) {
              return latestExisting;
            }


            const claimRef =
              db
                .collection(
                  "genzReferralClaims",
                )
                .doc(
                  candidate,
                );


            const claimSnapshot =
              await tx.get(
                claimRef,
              );


            if (
              claimSnapshot.exists &&
              claimSnapshot
                .data()
                ?.userId !==
                uid
            ) {
              throw new Error(
                "REFERRAL_ID_COLLISION",
              );
            }


            const now =
              Timestamp.now();


            tx.set(
              claimRef,
              {
                userId:
                  uid,

                referralId:
                  candidate,

                createdAt:
                  claimSnapshot.exists
                    ? (
                        claimSnapshot
                          .data()
                          ?.createdAt ??
                        now
                      )
                    : now,

                updatedAt:
                  now,
              },
              {
                merge:
                  true,
              },
            );


            tx.update(
              userRef,
              {
                referralId:
                  candidate,

                referralIdCreatedAt:
                  now,

                updatedAt:
                  now,
              },
            );


            return candidate;
          },
        );


      return assigned;

    } catch (
      error
    ) {

      if (
        error instanceof
          Error &&
        error.message ===
          "REFERRAL_ID_COLLISION"
      ) {
        continue;
      }


      throw error;
    }
  }


  throw new HttpsError(
    "internal",
    "Unable to create a referral ID.",
  );
}

async function getOrCreateAccount(uid: string) {
  const ref = db.collection("genzGameAccounts").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data() ?? {};
    const data = accountDefaults(uid);
    tx.set(ref, data);
    return { ...data, createdAt: null, updatedAt: null };
  });
}

type GoldMinerId =
  1 |
  2 |
  3 |
  4 |
  5;


function normalizeGoldMinerId(
  value:
    unknown,
): GoldMinerId {
  const minerId =
    Number(
      value,
    );


  if (
    !Number.isInteger(
      minerId,
    ) ||
    minerId <
      1 ||
    minerId >
      GOLD_MINE_COUNT
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid Gold Mine miner.",
    );
  }


  return minerId as
    GoldMinerId;
}


function getGoldMinerRecord(
  account:
    FirebaseFirestore.DocumentData,

  minerId:
    GoldMinerId,
) {
  const miners =
    account.goldMiners &&
    typeof account.goldMiners ===
      "object"
      ? account.goldMiners
      : {};


  const stored =
    miners[
      String(
        minerId,
      )
    ] &&
    typeof miners[
      String(
        minerId,
      )
    ] ===
      "object"
      ? miners[
          String(
            minerId,
          )
        ]
      : {};


  /*
   * Backward compatibility:
   *
   * The old Gold Mine becomes Miner 1.
   *
   * Only use the legacy active-cycle fields
   * when Miner 1 does not already have a
   * new-format active cycle.
   */
  const legacyCycleId =
    minerId ===
      1 &&
    typeof account
      .goldMineCurrentCycleId ===
      "string" &&
    account
      .goldMineCurrentCycleId
      ? account
          .goldMineCurrentCycleId
      : null;


  const legacyStartedAt =
    minerId ===
      1 &&
    account
      .goldMineStartedAt instanceof
      Timestamp
      ? account
          .goldMineStartedAt
      : null;


  const currentCycleId =
    typeof stored
      .currentCycleId ===
      "string" &&
    stored
      .currentCycleId
      ? stored
          .currentCycleId
      : legacyCycleId;


  const startedAt =
    stored
      .startedAt instanceof
      Timestamp
      ? stored
          .startedAt
      : legacyStartedAt;


  const collectedCycles =
    safeInt(
      stored
        .collectedCycles,
    );


  return {
    currentCycleId,
    startedAt,
    collectedCycles,
  };
}


function mineState(
  account:
    FirebaseFirestore.DocumentData,

  minerId:
    GoldMinerId,

  now =
    Date.now(),
) {
  const miner =
    getGoldMinerRecord(
      account,
      minerId,
    );


  if (
    !miner.currentCycleId ||
    !miner.startedAt
  ) {
    return {
      minerId,

      level:
        minerId,

      cycleSeconds:
        MINE_CYCLE_SECONDS,

      capacityGold:
        MINE_CAPACITY_GOLD,

      goldPerMinute:
        MINE_GOLD_PER_MINUTE,

      rewardPaise:
        GOLD_MINE_REWARD_PAISE,

      collectedCycles:
        miner.collectedCycles,

      currentCycleId:
        null,

      startedAt:
        null,

      status:
        "idle" as const,

      elapsedSeconds:
        0,

      remainingSeconds:
        MINE_CYCLE_SECONDS,

      goldCollected:
        0,

      canCollect:
        false,
    };
  }


  const elapsed =
    Math.max(
      0,

      Math.min(
        MINE_CYCLE_SECONDS,

        Math.floor(
          (
            now -
            miner
              .startedAt
              .toMillis()
          ) /
            1000,
        ),
      ),
    );


  const full =
    elapsed >=
    MINE_CYCLE_SECONDS;


  /*
   * 100 Gold / minute.
   *
   * 100 / 60 Gold each second.
   *
   * Use floor only for the visual integer
   * Gold amount. Completion itself is based
   * on trusted server elapsed time.
   */
  const goldCollected =
    full
      ? MINE_CAPACITY_GOLD
      : Math.min(
          MINE_CAPACITY_GOLD,

          Math.floor(
            (
              elapsed *
              MINE_GOLD_PER_MINUTE
            ) /
              60,
          ),
        );


  return {
    minerId,

    level:
      minerId,

    cycleSeconds:
      MINE_CYCLE_SECONDS,

    capacityGold:
      MINE_CAPACITY_GOLD,

    goldPerMinute:
      MINE_GOLD_PER_MINUTE,

    rewardPaise:
      GOLD_MINE_REWARD_PAISE,

    collectedCycles:
      miner.collectedCycles,

    currentCycleId:
      miner.currentCycleId,

    startedAt:
      miner
        .startedAt
        .toDate()
        .toISOString(),

    status:
      full
        ? "full" as const
        : "mining" as const,

    elapsedSeconds:
      elapsed,

    remainingSeconds:
      Math.max(
        0,

        MINE_CYCLE_SECONDS -
          elapsed,
      ),

    goldCollected,

    canCollect:
      full,
  };
}


function allMineStates(
  account:
    FirebaseFirestore.DocumentData,

  now =
    Date.now(),
) {
  return (
    [
      1,
      2,
      3,
      4,
      5,
    ] as GoldMinerId[]
  ).map(
    (
      minerId,
    ) =>
      mineState(
        account,
        minerId,
        now,
      ),
  );
}

function maskUpi(upi: string) {
  const [name, handle] = upi.split("@");
  const prefix = name.length <= 2 ? name.charAt(0) + "*" : name.slice(0,2) + "***";
  return `${prefix}@${handle}`;
}
function normalizeUpi(value: unknown) {
  if (typeof value !== "string") return null;
  const upi = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,100}@[a-z0-9.-]{2,100}$/.test(upi) && upi.length <= 160 ? upi : null;
}
function encryptionKey() {
  const secret = PAYOUT_ENCRYPTION_KEY.value();
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) throw new HttpsError("failed-precondition", "Payout encryption is not configured.");
  return Buffer.from(secret, "hex");
}
function encrypt(value: string) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), algorithm: "aes-256-gcm" };
}
function decrypt(data: FirebaseFirestore.DocumentData) {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(String(data.iv), "base64"));
    decipher.setAuthTag(Buffer.from(String(data.authTag), "base64"));
    return Buffer.concat([decipher.update(Buffer.from(String(data.ciphertext), "base64")), decipher.final()]).toString("utf8");
  } catch { throw new HttpsError("failed-precondition", "Unable to decrypt payout UPI ID."); }
}

async function requireAdmin(uid: string) {
  const snap = await db.collection("users").doc(uid).get();
  const user = snap.data() ?? {};
  if (!snap.exists || user.accountStatus === "suspended" || !["admin","super_admin"].includes(user.role)) throw new HttpsError("permission-denied", "Administrator access required.");
  return user.role as "admin"|"super_admin";
}

const GAMER_NAME_MIN_LENGTH =
  3;

const GAMER_NAME_MAX_LENGTH =
  24;


function normalizeGamerName(
  value:
    unknown,
):
  string |
  null {

  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const gamerName =
    value
      .normalize(
        "NFKC",
      )
      .trim()
      .replace(
        /\s+/g,
        " ",
      );


  if (
    gamerName.length <
      GAMER_NAME_MIN_LENGTH ||
    gamerName.length >
      GAMER_NAME_MAX_LENGTH
  ) {
    return null;
  }


  if (
    !/^[\p{L}\p{N}._ -]+$/u.test(
      gamerName,
    )
  ) {
    return null;
  }


  return gamerName;
}


function getGamerNameNormalized(
  gamerName:
    string,
) {

  return gamerName
    .normalize(
      "NFKC",
    )
    .toLocaleLowerCase(
      "en-US",
    );
}


function getGamerNameClaimId(
  normalizedName:
    string,
) {

  return crypto
    .createHash(
      "sha256",
    )
    .update(
      normalizedName,
    )
    .digest(
      "hex",
    );
}


function prepareInitialGamerName(
  value:
    unknown,

  uid:
    string,
) {

  let candidate =
    typeof value ===
    "string"
      ? value
          .normalize(
            "NFKC",
          )
          .replace(
            /[^\p{L}\p{N}._ -]+/gu,
            " ",
          )
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
      : "";


  if (
    candidate.length >
    20
  ) {
    candidate =
      candidate
        .slice(
          0,
          20,
        )
        .trim();
  }


  if (
    candidate.length <
    3
  ) {
    candidate =
      `Player_${uid.slice(
        0,
        6,
      )}`;
  }


  return candidate;
}


async function ensureInitialGamerName(
  uid:
    string,

  preferredName:
    unknown,
) {

  const userRef =
    db
      .collection(
        "users",
      )
      .doc(
        uid,
      );


  const currentSnapshot =
    await userRef.get();


  const current =
    currentSnapshot.data() ??
    {};


  const existingName =
    normalizeGamerName(
      current.gamerName ??
      current.displayName,
    );


  const existingNormalized =
    typeof current.gamerNameNormalized ===
    "string"
      ? current.gamerNameNormalized
          .trim()
      : "";


  if (
    existingName &&
    existingNormalized
  ) {
    return existingName;
  }


  const base =
    prepareInitialGamerName(
      current.gamerName ??
      current.displayName ??
      preferredName,

      uid,
    );


  const suffix =
    uid.slice(
      0,
      4,
    );


  const withSuffix =
    `${base.slice(
      0,
      Math.max(
        3,
        GAMER_NAME_MAX_LENGTH -
          suffix.length -
          1,
      ),
    )}_${suffix}`;


  const candidates =
    Array.from(
      new Set([
        base,
        withSuffix,
        `Player_${uid.slice(
          0,
          6,
        )}`,
      ]),
    );


  for (
    const candidateRaw of
    candidates
  ) {

    const candidate =
      normalizeGamerName(
        candidateRaw,
      );


    if (
      !candidate
    ) {
      continue;
    }


    const normalized =
      getGamerNameNormalized(
        candidate,
      );


    const claimRef =
      db
        .collection(
          "gamerNameClaims",
        )
        .doc(
          getGamerNameClaimId(
            normalized,
          ),
        );


    try {

      await db.runTransaction(
        async (
          tx,
        ) => {

          const [
            userSnapshot,
            claimSnapshot,
          ] =
            await Promise.all([
              tx.get(
                userRef,
              ),

              tx.get(
                claimRef,
              ),
            ]);


          const latestUser =
            userSnapshot.data() ??
            {};


          const alreadyAssigned =
            normalizeGamerName(
              latestUser.gamerName,
            );


          const alreadyNormalized =
            typeof latestUser
              .gamerNameNormalized ===
            "string"
              ? latestUser
                  .gamerNameNormalized
                  .trim()
              : "";


          if (
            alreadyAssigned &&
            alreadyNormalized
          ) {
            return;
          }


          if (
            claimSnapshot.exists &&
            claimSnapshot
              .data()
              ?.userId !==
              uid
          ) {
            throw new Error(
              "GAMER_NAME_TAKEN",
            );
          }


          const now =
            Timestamp.now();


          tx.set(
            claimRef,
            {
              userId:
                uid,

              gamerName:
                candidate,

              gamerNameNormalized:
                normalized,

              createdAt:
                claimSnapshot.exists
                  ? (
                      claimSnapshot
                        .data()
                        ?.createdAt ??
                      now
                    )
                  : now,

              updatedAt:
                now,
            },
            {
              merge:
                true,
            },
          );


          tx.set(
            userRef,
            {
              gamerName:
                candidate,

              displayName:
                candidate,

              gamerNameNormalized:
                normalized,

              updatedAt:
                now,
            },
            {
              merge:
                true,
            },
          );

        },
      );


      const latest =
        (
          await userRef.get()
        ).data() ??
        {};


      return String(
        latest.gamerName ??
        candidate,
      );

    } catch (
      error
    ) {

      if (
        error instanceof
          Error &&
        error.message ===
          "GAMER_NAME_TAKEN"
      ) {
        continue;
      }


      throw error;
    }
  }


  throw new HttpsError(
    "internal",
    "Unable to create a unique Gamer Name.",
  );
}


function normalizePhoneNumber(
  value:
    unknown,
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const phone =
    value
      .trim()
      .replace(
        /[\s()-]/g,
        "",
      );


  if (
    !/^\+?[0-9]{7,15}$/.test(
      phone,
    )
  ) {
    return null;
  }


  return phone;
}

function maskWhatsAppNumber(
  value:
    string,
) {

  const digits =
    value.replace(
      /\D/g,
      "",
    );


  if (
    digits.length <=
      4
  ) {
    return "*".repeat(
      Math.max(
        0,
        digits.length -
          1,
      ),
    ) +
      digits.slice(
        -1,
      );
  }


  const prefix =
    value.startsWith(
      "+",
    )
      ? "+"
      : "";


  return (
    prefix +
    "*".repeat(
      Math.max(
        3,
        digits.length -
          4,
      ),
    ) +
    digits.slice(
      -4,
    )
  );
}

function normalizeDateOfBirth(
  value:
    unknown,
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  if (
    typeof value !==
    "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }


  const parsed =
    new Date(
      `${value}T00:00:00Z`,
    );


  if (
    Number.isNaN(
      parsed.getTime(),
    ) ||
    parsed
      .toISOString()
      .slice(
        0,
        10,
      ) !==
      value
  ) {
    return null;
  }


  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );


  if (
    value >
      today ||
    value <
      "1900-01-01"
  ) {
    return null;
  }


  return value;
}


function normalizeCountry(
  value:
    unknown,
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const country =
    value
      .normalize(
        "NFKC",
      )
      .trim()
      .replace(
        /\s+/g,
        " ",
      );


  if (
    country.length <
      2 ||
    country.length >
      56 ||
    !/^[\p{L} .'-]+$/u.test(
      country,
    )
  ) {
    return null;
  }


  return country;
}


function normalizeProfilePhotoUrl(
  value:
    unknown,
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const url =
    value.trim();


  if (
    url.length >
      2500 ||
    !url.startsWith(
      "https://",
    )
  ) {
    return null;
  }


  return url;
}


function miniGamesProfileResponse(
  uid:
    string,

  data:
    FirebaseFirestore.DocumentData,
) {

  const role =
    data.role ===
      "admin" ||
    data.role ===
      "super_admin"
      ? data.role
      : "user";


  return {
    id:
      uid,

    email:
      String(
        data.email ??
        "",
      ),

    displayName:
      String(
        data.gamerName ??
        data.displayName ??
        "Player",
      ),

    photoUrl:
      String(
        data.photoUrl ??
        "",
      ),

    phoneNumber:
      String(
        data.phoneNumber ??
        "",
      ),

    dateOfBirth:
      String(
        data.dateOfBirth ??
        "",
      ),

        country:
      String(
        data.country ??
        "",
      ),

    referralId:
      String(
        data.referralId ??
        "",
      ),

    referredByReferralId:
      String(
        data.referredByReferralId ??
        "",
      ),

    role,
  };
}
export const registerPushDevice =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before registering notifications.",
        );
      }


      const data =
        request.data as
          PushDeviceRequest;


      const token =
        typeof data?.token ===
        "string"
          ? data.token.trim()
          : "";


      const platform =
        typeof data?.platform ===
        "string"
          ? data.platform
              .trim()
              .toLowerCase()
          : "";


      if (
        !token ||
        token.length > 4096
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid push notification token.",
        );
      }


      if (
        platform !== "android" &&
        platform !== "ios"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Unsupported push notification platform.",
        );
      }


      const deviceId =
        getPushDeviceId(
          token,
        );


      const ref =
        db
          .collection(
            "pushDevices",
          )
          .doc(
            deviceId,
          );


      const existing =
        await ref.get();


      const now =
        FieldValue
          .serverTimestamp();


      await ref.set(
        {
          userId:
            request.auth.uid,

          token,

          platform,

          enabled:
            true,

          ...(existing.exists
            ? {}
            : {
                createdAt:
                  now,
              }),

          updatedAt:
            now,

          lastRegisteredAt:
            now,
        },
        {
          merge:
            true,
        },
      );

      const topicResult =
        await getMessaging()
          .subscribeToTopic(
            [
              token,
            ],
            GENZ_GAMES_ALL_USERS_TOPIC,
          );


      if (
        topicResult.failureCount >
        0
      ) {

        console.error(
          "GenZGames broadcast topic subscription failed:",
          topicResult.errors,
        );


        throw new HttpsError(
          "internal",
          "Unable to enable broadcast notifications for this device.",
        );
      }



      return {
        success:
          true,

        deviceId,

        topicSubscribed:
          true,
      };
    },
  );


export const unregisterPushDevice =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before unregistering notifications.",
        );
      }


      const data =
        request.data as
          UnregisterPushDeviceRequest;


      const token =
        typeof data?.token ===
        "string"
          ? data.token.trim()
          : "";


      if (
        !token
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Push token is required.",
        );
      }


      const ref =
        db
          .collection(
            "pushDevices",
          )
          .doc(
            getPushDeviceId(
              token,
            ),
          );


      const snapshot =
        await ref.get();


      if (
        !snapshot.exists
      ) {
        return {
          success:
            true,
        };
      }


      if (
        snapshot.data()?.userId !==
        request.auth.uid
      ) {
        return {
          success:
            true,
        };
      }

            try {

        await getMessaging()
          .unsubscribeFromTopic(
            [
              token,
            ],
            GENZ_GAMES_ALL_USERS_TOPIC,
          );

      } catch (error) {

        console.error(
          "Unable to unsubscribe GenZGames device from broadcast topic:",
          error,
        );
      }


      await ref.delete();


      return {
        success:
          true,
      };
    },
  );
export const ensureMiniGamesUserProfile =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const uid =
        request.auth.uid;


      const userRef =
        db
          .collection(
            "users",
          )
          .doc(
            uid,
          );


      const existing =
        await userRef.get();


      const token =
        request.auth.token;


      if (
        !existing.exists
      ) {

        await userRef.set({
          userId:
            uid,

          email:
            String(
              token.email ??
              "",
            ),

          displayName:
            String(
              token.name ??
              "Player",
            ),

          photoUrl:
            String(
              token.picture ??
              "",
            ),

          authPhotoUrl:
            String(
              token.picture ??
              "",
            ),

          phoneNumber:
            "",

          dateOfBirth:
            "",

          country:
            "",

          role:
            "user",

          accountStatus:
            "active",

          createdAt:
            FieldValue
              .serverTimestamp(),

          updatedAt:
            FieldValue
              .serverTimestamp(),
        });

      } else {

        await userRef.set(
          {
            email:
              String(
                token.email ??
                existing
                  .data()
                  ?.email ??
                "",
              ),

            authPhotoUrl:
              String(
                token.picture ??
                "",
              ),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      }


            await ensureInitialGamerName(
        uid,

        existing
          .data()
          ?.gamerName ??
        existing
          .data()
          ?.displayName ??
        token.name,
      );


      await ensureReferralIdentity(
        uid,
      );


      const latest =
        (
          await userRef.get()
        ).data() ??
        {};


      return {
        success:
          true,

        profile:
          miniGamesProfileResponse(
            uid,
            latest,
          ),
      };
    },
  );
export const createGenZGamesProfilePhotoUploadUrl =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      secrets: [
        R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY,
        R2_ACCOUNT_ID,
        R2_BUCKET_NAME,
      ],
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before uploading a profile photo.",
        );
      }


      const contentType =
        typeof request.data
          ?.contentType ===
        "string"
          ? request.data
              .contentType
              .trim()
              .toLowerCase()
          : "";


      const size =
        typeof request.data
          ?.size ===
        "number"
          ? Math.floor(
              request.data.size,
            )
          : 0;


      if (
        !PROFILE_PHOTO_CONTENT_TYPES
          .has(
            contentType,
          )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Profile photo must be JPG, PNG or WEBP.",
        );
      }


      if (
        size <= 0 ||
        size >
          PROFILE_PHOTO_MAX_BYTES
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Profile photo must be 5 MB or smaller.",
        );
      }


      const uid =
        request.auth.uid;


      const objectKey =
        profilePhotoObjectKey(
          uid,
        );


      const client =
        createR2Client();


      const command =
        new PutObjectCommand({
          Bucket:
            R2_BUCKET_NAME
              .value(),

          Key:
            objectKey,

          ContentType:
            contentType,
        });


      const uploadUrl =
        await getSignedUrl(
          client,
          command,
          {
            expiresIn:
              300,
          },
        );


      return {
        success:
          true,

        uploadUrl,

        expiresInSeconds:
          300,
      };
    },
  );
  export const confirmGenZGamesProfilePhotoUpload =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      secrets: [
        R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY,
        R2_ACCOUNT_ID,
        R2_BUCKET_NAME,
        R2_PUBLIC_BASE_URL,
      ],
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before confirming a profile photo.",
        );
      }


      const uid =
        request.auth.uid;


      const objectKey =
        profilePhotoObjectKey(
          uid,
        );


      const client =
        createR2Client();


      let head;


      try {

        head =
          await client.send(
            new HeadObjectCommand({
              Bucket:
                R2_BUCKET_NAME
                  .value(),

              Key:
                objectKey,
            }),
          );

      } catch (
        error
      ) {

        console.error(
          "Unable to verify R2 profile photo:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Profile photo upload could not be verified.",
        );
      }


      const size =
        Number(
          head.ContentLength ??
          0,
        );


      const contentType =
        String(
          head.ContentType ??
          "",
        )
          .trim()
          .toLowerCase();


      if (
        size <= 0 ||
        size >
          PROFILE_PHOTO_MAX_BYTES ||
        !PROFILE_PHOTO_CONTENT_TYPES
          .has(
            contentType,
          )
      ) {

        try {

          await client.send(
            new DeleteObjectCommand({
              Bucket:
                R2_BUCKET_NAME
                  .value(),

              Key:
                objectKey,
            }),
          );

        } catch (
          deleteError
        ) {

          console.error(
            "Unable to delete invalid R2 profile photo:",
            deleteError,
          );

        }


        throw new HttpsError(
          "failed-precondition",
          "Uploaded profile photo is invalid.",
        );
      }


      const baseUrl =
        profilePhotoPublicUrl(
          uid,
        );


      const photoUrl =
        `${baseUrl}?v=${Date.now()}`;


      await db
        .collection(
          "users",
        )
        .doc(
          uid,
        )
        .set(
          {
            photoUrl,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
              const todayLeaderboardRef =
        getDailyDiamondPlayerRef(
          getIstDayKey(),
          uid,
        );


      const todayLeaderboardSnapshot =
        await todayLeaderboardRef
          .get();


      if (
        todayLeaderboardSnapshot.exists
      ) {

        await todayLeaderboardRef
          .update({
            photoUrl,

            updatedAt:
              Timestamp.now(),
          });
      }


      return {
        success:
          true,

        photoUrl,
      };
    },
  );

export const getMiniGamesProfile =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const uid =
        request.auth.uid;


            await ensureReferralIdentity(
        uid,
      );


      const snapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      if (
        !snapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "GenZGames profile not found.",
        );
      }


      return {
        success:
          true,

        profile:
          miniGamesProfileResponse(
            uid,

            snapshot.data() ??
            {},
          ),
      };
    },
  );

export const updateMiniGamesProfile =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const uid =
        request.auth.uid;


      const gamerName =
        normalizeGamerName(
          request.data
            ?.gamerName,
        );


      if (
        !gamerName
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Gamer Name must be 3-24 characters and may contain letters, numbers, spaces, dot, underscore or hyphen.",
        );
      }


      const phoneNumber =
        normalizePhoneNumber(
          request.data
            ?.phoneNumber,
        );


      if (
        phoneNumber ===
        null
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid phone number.",
        );
      }


      const dateOfBirth =
        normalizeDateOfBirth(
          request.data
            ?.dateOfBirth,
        );


      if (
        dateOfBirth ===
        null
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid date of birth.",
        );
      }


      const country =
        normalizeCountry(
          request.data
            ?.country,
        );


      if (
        country ===
        null
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid country.",
        );
      }

      const normalized =
        getGamerNameNormalized(
          gamerName,
        );


      const claimRef =
        db
          .collection(
            "gamerNameClaims",
          )
          .doc(
            getGamerNameClaimId(
              normalized,
            ),
          );


      const userRef =
        db
          .collection(
            "users",
          )
          .doc(
            uid,
          );


      await db.runTransaction(
        async (
          tx,
        ) => {

          const [
            userSnapshot,
            claimSnapshot,
          ] =
            await Promise.all([
              tx.get(
                userRef,
              ),

              tx.get(
                claimRef,
              ),
            ]);


          if (
            !userSnapshot.exists
          ) {
            throw new HttpsError(
              "not-found",
              "Profile not found.",
            );
          }


          if (
            claimSnapshot.exists &&
            claimSnapshot
              .data()
              ?.userId !==
              uid
          ) {
            throw new HttpsError(
              "already-exists",
              "This Gamer Name is already taken.",
            );
          }


          const current =
            userSnapshot.data() ??
            {};


          const oldNormalized =
            typeof current
              .gamerNameNormalized ===
            "string"
              ? current
                  .gamerNameNormalized
                  .trim()
              : "";


          const now =
            Timestamp.now();


          tx.set(
            claimRef,
            {
              userId:
                uid,

              gamerName,

              gamerNameNormalized:
                normalized,

              createdAt:
                claimSnapshot.exists
                  ? (
                      claimSnapshot
                        .data()
                        ?.createdAt ??
                      now
                    )
                  : now,

              updatedAt:
                now,
            },
            {
              merge:
                true,
            },
          );


          if (
            oldNormalized &&
            oldNormalized !==
              normalized
          ) {

            const oldClaimRef =
              db
                .collection(
                  "gamerNameClaims",
                )
                .doc(
                  getGamerNameClaimId(
                    oldNormalized,
                  ),
                );


            tx.delete(
              oldClaimRef,
            );
          }


          tx.update(
            userRef,
            {
              gamerName,

              displayName:
                gamerName,

              gamerNameNormalized:
                normalized,

              phoneNumber,

              dateOfBirth,

              country,

              updatedAt:
                now,
            },
          );

        },
      );

            const todayLeaderboardRef =
        getDailyDiamondPlayerRef(
          getIstDayKey(),
          uid,
        );


      const todayLeaderboardSnapshot =
        await todayLeaderboardRef
          .get();


      if (
        todayLeaderboardSnapshot.exists
      ) {

        await todayLeaderboardRef
          .update({
            gamerName,

            updatedAt:
              Timestamp.now(),
          });
      }


      const latest =
        (
          await userRef.get()
        ).data() ??
        {};


      return {
        success:
          true,

        profile:
          miniGamesProfileResponse(
            uid,
            latest,
          ),
      };
    },
  );

/*
 * =====================================================
 * APPLY GENZGAMES REFERRAL
 * =====================================================
 *
 * One account can use one referral ID only once.
 *
 * Reward is credited to the REFERRER:
 *
 * +20 diamonds on the current IST day.
 */
export const applyGenZGamesReferral =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before applying a referral ID.",
        );
      }


      const uid =
        request.auth.uid;


      /*
       * Make sure this user already owns
       * their permanent referral identity.
       */
      await ensureReferralIdentity(
        uid,
      );


      const referralId =
        normalizeReferralId(
          request.data
            ?.referralId,
        );


      if (
        !referralId
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid GenZGames referral ID.",
        );
      }


      const applicantRef =
        db
          .collection(
            "users",
          )
          .doc(
            uid,
          );


      const claimRef =
        db
          .collection(
            "genzReferralClaims",
          )
          .doc(
            referralId,
          );


      /*
       * User ID is used as the referral-use document ID,
       * so one Firebase account can create only one use.
       */
      const useRef =
        db
          .collection(
            "genzReferralUses",
          )
          .doc(
            uid,
          );


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              applicantSnapshot,
              claimSnapshot,
              useSnapshot,
            ] =
              await Promise.all([
                tx.get(
                  applicantRef,
                ),

                tx.get(
                  claimRef,
                ),

                tx.get(
                  useRef,
                ),
              ]);


            if (
              !applicantSnapshot.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Profile not found.",
              );
            }


            const applicant =
              applicantSnapshot.data() ??
              {};


            if (
              useSnapshot.exists ||
              normalizeReferralId(
                applicant
                  .referredByReferralId,
              )
            ) {
              throw new HttpsError(
                "failed-precondition",
                "A referral ID has already been applied to this account.",
              );
            }


            if (
              !claimSnapshot.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Referral ID was not found.",
              );
            }


            const referrerId =
              String(
                claimSnapshot
                  .data()
                  ?.userId ??
                "",
              )
                .trim();


            if (
              !referrerId
            ) {
              throw new HttpsError(
                "not-found",
                "Referral owner was not found.",
              );
            }


            if (
              referrerId ===
              uid
            ) {
              throw new HttpsError(
                "invalid-argument",
                "You cannot use your own referral ID.",
              );
            }


            const referrerUserRef =
              db
                .collection(
                  "users",
                )
                .doc(
                  referrerId,
                );


            const referrerAccountRef =
              db
                .collection(
                  "genzGameAccounts",
                )
                .doc(
                  referrerId,
                );


            const dailyRef =
              getDailyDiamondPlayerRef(
                dayKey,
                referrerId,
              );


            const [
              referrerUserSnapshot,
              referrerAccountSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  referrerUserRef,
                ),

                tx.get(
                  referrerAccountRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            if (
              !referrerUserSnapshot.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Referral owner was not found.",
              );
            }


            const referrerUser =
              referrerUserSnapshot.data() ??
              {};


            const account =
              referrerAccountSnapshot.exists
                ? (
                    referrerAccountSnapshot
                      .data() ??
                    {}
                  )
                : {};


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                {},

                {
                  uid:
                    referrerId,

                  dayKey,

                  amount:
                    REFERRAL_DIAMOND_REWARD,

                  source:
                    "referral",

                  userData:
                    referrerUser,

                  now,
                },
              );


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              REFERRAL_DIAMOND_REWARD;

            const referralUsersCount =
  safeInt(
    account
      .referralUsersCount,
  ) +
  1;


            if (
              referrerAccountSnapshot.exists
            ) {

              tx.set(
                referrerAccountRef,
                {
  lifetimeDiamonds,

  referralUsersCount,

  updatedAt:
    now,
},
                {
                  merge:
                    true,
                },
              );

            } else {

              tx.set(
                referrerAccountRef,
                {
                  ...accountDefaults(
                    referrerId,
                  ),

                  lifetimeDiamonds,

referralUsersCount,

createdAt:
  now,

                  updatedAt:
                    now,
                },
              );
            }


            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            tx.update(
              applicantRef,
              {
                referredByUserId:
                  referrerId,

                referredByReferralId:
                  referralId,

                referredAt:
                  now,

                updatedAt:
                  now,
              },
            );


            tx.set(
              useRef,
              {
                userId:
                  uid,

                referrerUserId:
                  referrerId,

                referralId,

                rewardDiamonds:
                  REFERRAL_DIAMOND_REWARD,

                rewardDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              referrerId,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              lifetimeDiamonds,
            };
          },
        );


      return {
        success:
          true,

        referralId,

        referrerUserId:
          result.referrerId,

        diamondsGranted:
          REFERRAL_DIAMOND_REWARD,

        diamondDayKey:
          dayKey,

        referrerTodayDiamonds:
          result.todayDiamonds,

        referrerLifetimeDiamonds:
          result.lifetimeDiamonds,
      };
    },
  );


/*
 * =====================================================
 * DAILY DIAMOND LEADERBOARD
 * =====================================================
 *
 * period:
 *
 * today
 * yesterday
 *
 * Ranking:
 * 1 + number of users with MORE diamonds.
 *
 * Therefore exact score ties share the same rank.
 */
export const getGenZGamesDailyLeaderboard =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to view the leaderboard.",
        );
      }


      const uid =
        request.auth.uid;


      const period =
        request.data
          ?.period ===
        "yesterday"
          ? "yesterday"
          : "today";


      const dayKey =
        getIstDayKey(
          new Date(),

          period ===
          "yesterday"
            ? -1
            : 0,
        );


      const playersRef =
        db
          .collection(
            "genzDailyDiamondLeaderboards",
          )
          .doc(
            dayKey,
          )
          .collection(
            "players",
          );


      const [
        topSnapshot,
        currentPlayerSnapshot,
      ] =
        await Promise.all([
          playersRef
            .orderBy(
              "diamonds",
              "desc",
            )
            .limit(
              10,
            )
            .get(),

          playersRef
            .doc(
              uid,
            )
            .get(),
        ]);


      let previousDiamonds:
        number |
        null =
        null;


      let currentCompetitionRank =
        0;


      const topPlayers =
        topSnapshot.docs.map(
          (
            document,
            index,
          ) => {

            const data =
              document.data();


            const diamonds =
              safeInt(
                data.diamonds,
              );


            /*
             * Exact score ties share rank.
             *
             * Example:
             *
             * 100 -> #1
             * 100 -> #1
             *  90 -> #3
             */
            if (
              previousDiamonds ===
                null ||
              diamonds !==
                previousDiamonds
            ) {
              currentCompetitionRank =
                index +
                1;
            }


            previousDiamonds =
              diamonds;


            return {
              userId:
                document.id,

              gamerName:
                String(
                  data.gamerName ??
                  "Player",
                ),

              photoUrl:
                String(
                  data.photoUrl ??
                  "",
                ),

              diamonds,

              rank:
                currentCompetitionRank,
            };
          },
        );


      const currentPlayerFromTop =
        topPlayers.find(
          (
            player,
          ) =>
            player.userId ===
            uid,
        ) ??
        null;


      let currentPlayer =
        currentPlayerFromTop;


      if (
        !currentPlayer &&
        currentPlayerSnapshot.exists
      ) {

        const data =
          currentPlayerSnapshot.data() ??
          {};


        const diamonds =
          safeInt(
            data.diamonds,
          );


        const aheadSnapshot =
          await playersRef
            .where(
              "diamonds",
              ">",
              diamonds,
            )
            .count()
            .get();


        currentPlayer = {
          userId:
            uid,

          gamerName:
            String(
              data.gamerName ??
              "Player",
            ),

          photoUrl:
            String(
              data.photoUrl ??
              "",
            ),

          diamonds,

          rank:
            aheadSnapshot
              .data()
              .count +
            1,
        };
      }


      return {
        success:
          true,

        period,

        dayKey,

        topPlayers,

        currentPlayer,

        isCurrentPlayerInTop10:
          currentPlayerFromTop !==
          null,

        generatedAt:
          Timestamp
            .now()
            .toDate()
            .toISOString(),
      };
    },
  );

  type RealGoldMinerId =
  1 |
  2;

const normalizeRealGoldMinerId =
  (
    value:
      unknown,
  ):
    RealGoldMinerId => {

    const minerId =
      Number(
        value,
      );

    if (
      minerId !== 1 &&
      minerId !== 2
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Choose a valid Real Gold miner.",
      );
    }

    return minerId;
  };


const getRealGoldConfigRef =
  () =>
    db
      .collection(
        REAL_GOLD_CONFIG_COLLECTION,
      )
      .doc(
        REAL_GOLD_CONFIG_DOCUMENT,
      );


const normalizeGoldRatePaisePerGram =
  (
    value:
      unknown,
  ) => {

    if (
      typeof value !==
        "number" ||
      !Number.isFinite(
        value,
      ) ||
      value <=
        0
    ) {
      return DEFAULT_GOLD_RATE_PAISE_PER_GRAM;
    }

    return Math.max(
      1,
      Math.round(
        value,
      ),
    );
  };


const getCurrentGoldRate =
  async () => {

    const snapshot =
      await getRealGoldConfigRef()
        .get();

    if (
      !snapshot.exists
    ) {
      return {
        goldRatePaisePerGram:
          DEFAULT_GOLD_RATE_PAISE_PER_GRAM,

        updatedAt:
          null as string | null,

        usingDefault:
          true,
      };
    }

    const data =
      snapshot.data() ??
      {};

    return {
      goldRatePaisePerGram:
        normalizeGoldRatePaisePerGram(
          data
            .goldRatePaisePerGram,
        ),

      updatedAt:
        data.updatedAt instanceof
          Timestamp
          ? data.updatedAt
              .toDate()
              .toISOString()
          : null,

      usingDefault:
        false,
    };
  };


const getRealGoldMinerRecord =
  (
    account:
      FirebaseFirestore.DocumentData,

    minerId:
      RealGoldMinerId,
  ) => {

    const miners =
      account.realGoldMiners &&
      typeof account.realGoldMiners ===
        "object"
        ? account.realGoldMiners
        : {};

    const record =
      miners[
        String(
          minerId,
        )
      ];

    if (
      !record ||
      typeof record !==
        "object"
    ) {
      return {
        currentCycleId:
          null,

        startedAt:
          null,

        collectedCycles:
          0,
      };
    }

    return record;
  };


const realGoldMineState =
  (
    account:
      FirebaseFirestore.DocumentData,

    minerId:
      RealGoldMinerId,

    nowMillis =
      Date.now(),
  ) => {

    const record =
      getRealGoldMinerRecord(
        account,
        minerId,
      );

    const cycleId =
      typeof record
        .currentCycleId ===
        "string"
        ? record
            .currentCycleId
        : null;

    const startedAt =
      record.startedAt instanceof
        Timestamp
        ? record.startedAt
        : null;

    const collectedCycles =
      safeInt(
        record
          .collectedCycles,
      );

    if (
      !cycleId ||
      !startedAt
    ) {
      return {
        minerId,

        cycleSeconds:
          REAL_GOLD_MINE_CYCLE_SECONDS,

        capacityOre:
          REAL_GOLD_ORE_CAPACITY,

        orePerMinute:
          REAL_GOLD_ORE_PER_MINUTE,

        diamondsPerCollection:
          REAL_GOLD_DIAMOND_REWARD,

        collectedCycles,

        currentCycleId:
          null,

        startedAt:
          null,

        status:
          "idle" as const,

        elapsedSeconds:
          0,

        remainingSeconds:
          REAL_GOLD_MINE_CYCLE_SECONDS,

        oreCollected:
          0,

        canCollect:
          false,
      };
    }

    const elapsedSeconds =
      Math.min(
        REAL_GOLD_MINE_CYCLE_SECONDS,

        Math.max(
          0,

          Math.floor(
            (
              nowMillis -
              startedAt.toMillis()
            ) /
              1000,
          ),
        ),
      );

    const canCollect =
      elapsedSeconds >=
      REAL_GOLD_MINE_CYCLE_SECONDS;

    const oreCollected =
      canCollect
        ? REAL_GOLD_ORE_CAPACITY
        : Math.min(
            REAL_GOLD_ORE_CAPACITY,

            Math.floor(
              (
                elapsedSeconds *
                REAL_GOLD_ORE_PER_MINUTE
              ) /
                60,
            ),
          );

    return {
      minerId,

      cycleSeconds:
        REAL_GOLD_MINE_CYCLE_SECONDS,

      capacityOre:
        REAL_GOLD_ORE_CAPACITY,

      orePerMinute:
        REAL_GOLD_ORE_PER_MINUTE,

      diamondsPerCollection:
        REAL_GOLD_DIAMOND_REWARD,

      collectedCycles,

      currentCycleId:
        cycleId,

      startedAt:
        startedAt
          .toDate()
          .toISOString(),

      status:
        canCollect
          ? "full" as const
          : "mining" as const,

      elapsedSeconds,

      remainingSeconds:
        Math.max(
          0,

          REAL_GOLD_MINE_CYCLE_SECONDS -
            elapsedSeconds,
        ),

      oreCollected,

      canCollect,
    };
  };


const allRealGoldMineStates =
  (
    account:
      FirebaseFirestore.DocumentData,

    nowMillis =
      Date.now(),
  ) =>
    Array.from(
      {
        length:
          REAL_GOLD_MINER_COUNT,
      },
      (
        _,
        index,
      ) =>
        (
          index +
          1
        ) as RealGoldMinerId,
    ).map(
      (
        minerId,
      ) =>
        realGoldMineState(
          account,
          minerId,
          nowMillis,
        ),
    );
export const getGenZGamesSummary =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to use GenZGames.",
        );
      }


      const uid =
        request.auth.uid;


      const account =
        await getOrCreateAccount(
          uid,
        );


      /*
       * Read the current gold rate only on
       * the trusted backend.
       *
       * The rate itself is NOT returned to
       * the player.
       */
      const realGoldConfig =
        await getCurrentGoldRate();


      const realGoldBalanceNanograms =
        safeInt(
          account
            .realGoldBalanceNanograms,
        );


      const pendingRealGoldRedemptionNanograms =
        safeInt(
          account
            .pendingRealGoldRedemptionNanograms,
        );


      /*
       * Use ceil because the reserved weight
       * must cover the complete ₹5 redemption.
       *
       * Maximum rounding difference is below
       * one nanogram.
       */
      const realGoldRedemptionNanograms =
        Math.max(
          1,

          Math.ceil(
            (
              REAL_GOLD_REDEMPTION_PAISE *
              NANOGRAMS_PER_GRAM
            ) /
              realGoldConfig
                .goldRatePaisePerGram,
          ),
        );


      const realGoldRedemptionEligible =
        pendingRealGoldRedemptionNanograms ===
          0 &&
        realGoldBalanceNanograms >=
          realGoldRedemptionNanograms;


      const dayKey =
        getIstDayKey();

            const streakNow =
        Timestamp.now();


      const dailyStreak =
        getDailyStreakState(
          account,
          dayKey,
          streakNow,
        );


      const [
        payout,
        dailyDiamondSnapshot,
      ] =
        await Promise.all([
          db
            .collection(
              "genzGamePayoutProfiles",
            )
            .doc(
              uid,
            )
            .get(),

          getDailyDiamondPlayerRef(
            dayKey,
            uid,
          ).get(),
        ]);


      const dailyDiamonds =
        dailyDiamondSnapshot.data() ??
        {};


      const completed =
        normalizeCompleted(
          account
            .sudokuCompletedLevelNumbers,
        );


      const highest =
        Math.min(
          SUDOKU_TOTAL_LEVELS,

          Math.max(
            1,

            safeInt(
              account
                .sudokuHighestUnlockedLevel,
            ) ||
            1,
          ),
        );

        const referralEarningsDayKey =
  typeof account
    .referralEarningsDayKey ===
  "string"
    ? account
        .referralEarningsDayKey
    : "";


const referralTodayPaise =
  referralEarningsDayKey ===
  dayKey
    ? safeInt(
        account
          .referralEarningsTodayPaise,
      )
    : 0;

          const candyCascadeLevelStars =
        normalizeCandyCascadeLevelStars(
          account
            .candyCascadeLevelStars,
        );


      const candyCascadeTotalStars =
        getCandyCascadeTotalStars(
          candyCascadeLevelStars,
        );


      return {
        success:
          true,

        currency:
          CURRENCY,

        balancePaise:
          safeInt(
            account.balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            account
              .lifetimeEarningsPaise,
          ),

        redeemedPaise:
          safeInt(
            account.redeemedPaise,
          ),

        pendingRedemptionPaise:
          safeInt(
            account
              .pendingRedemptionPaise,
          ),

                dailyStreak: {
          day:
            dailyStreak.day,

          totalDays:
            DAILY_STREAK_TOTAL_DAYS,

          progress:
            dailyStreak.progress,

          target:
            DAILY_STREAK_LEVEL_TARGET,

          dayKey,

          pendingPaise:
            dailyStreak.pendingPaise,

          dailyBonusPaise:
            DAILY_STREAK_BONUS_PAISE_PER_DAY,

          fullRewardPaise:
            DAILY_STREAK_FULL_REWARD_PAISE,

          todayCompleted:
            dailyStreak.progress >=
            DAILY_STREAK_LEVEL_TARGET,

          cycleCompletedToday:
            dailyStreak.day ===
              DAILY_STREAK_TOTAL_DAYS &&
            dailyStreak.lastCompletedDayKey ===
              dayKey,

          completedCycles:
            dailyStreak.completedCycles,

          lifetimeRewardPaise:
            dailyStreak.lifetimeRewardPaise,
        },

          referralEarnings: {
  todayPaise:
    referralTodayPaise,

  lifetimePaise:
    safeInt(
      account
        .referralEarningsPaise,
    ),

  referredPlayers:
    safeInt(
      account
        .referralUsersCount,
    ),

  qualifiedEvents:
    safeInt(
      account
        .referralQualifiedEvents,
    ),
},

        minimumRedemptionPaise:
          minRedeem(
            account,
          ),

        diamonds: {
          dayKey,

          today:
            safeInt(
              dailyDiamonds
                .diamonds,
            ),

          lifetime:
            safeInt(
              account
                .lifetimeDiamonds,
            ),

          sudokuToday:
            safeInt(
              dailyDiamonds
                .sudokuDiamonds,
            ),

          miningToday:
            safeInt(
              dailyDiamonds
                .miningDiamonds,
            ),

          referralToday:
            safeInt(
              dailyDiamonds
                .referralDiamonds,
            ),

          game2048Today:
            safeInt(
              dailyDiamonds
                .game2048Diamonds,
            ),

          snakeToday:
            safeInt(
              dailyDiamonds
                .snakeDiamonds,
            ),

          flappyRocketToday:
            safeInt(
              dailyDiamonds
                .flappyRocketDiamonds,
            ),

          knifeHitToday:
            safeInt(
              dailyDiamonds
                .knifeHitDiamonds,
            ),

          brickBreakerToday:
            safeInt(
              dailyDiamonds
                .brickBreakerDiamonds,
            ),

          candyCascadeToday:
            safeInt(
              dailyDiamonds
                .candyCascadeDiamonds,
            ),
        },

                payout: {
          configured:
            payout.exists &&
            Boolean(
              String(
                payout
                  .data()
                  ?.upiIdMasked ??
                "",
              ),
            ) &&
            Boolean(
              String(
                payout
                  .data()
                  ?.whatsappNumberMasked ??
                "",
              ),
            ),

          upiIdMasked:
            payout.exists
              ? String(
                  payout
                    .data()
                    ?.upiIdMasked ??
                  "",
                )
              : null,

          whatsappNumberMasked:
            payout.exists
              ? String(
                  payout
                    .data()
                    ?.whatsappNumberMasked ??
                  "",
                )
              : null,
        },

        sudoku: {
          totalLevels:
            SUDOKU_TOTAL_LEVELS,

          completedLevels:
            completed.length,

          completedLevelNumbers:
            completed,

          highestUnlockedLevel:
            highest,
        },

        goldMine:
          mineState(
            account,
            1,
          ),

        goldMiners:
          allMineStates(
            account,
          ),

        realGold: {
          balanceNanograms:
            realGoldBalanceNanograms,

          lifetimeNanograms:
            safeInt(
              account
                .realGoldLifetimeNanograms,
            ),

          pendingRedemptionNanograms:
            pendingRealGoldRedemptionNanograms,

          redeemedNanograms:
            safeInt(
              account
                .redeemedRealGoldNanograms,
            ),

          redemptionMinimumPaise:
            REAL_GOLD_REDEMPTION_PAISE,

          redemptionEligible:
            realGoldRedemptionEligible,

          collectedCycles:
            safeInt(
              account
                .realGoldCollectedCycles,
            ),

          miners:
            allRealGoldMineStates(
              account,
            ),
        },

        game2048: {
          completedRuns:
            safeInt(
              account
                .game2048CompletedRuns,
            ),

          bestTile:
            safeInt(
              account
                .game2048BestTile,
            ),

          highScore:
            safeInt(
              account
                .game2048HighScore,
            ),
        },

        snake: {
  highestUnlockedLevel:
    Math.min(
      SNAKE_MAX_LEVEL,
      Math.max(
        1,
        safeInt(
          account
            .snakeHighestUnlockedLevel,
        ) ||
          1,
      ),
    ),

  completedRuns:
    safeInt(
      account
        .snakeCompletedRuns,
    ),

  bestScore:
    safeInt(
      account
        .snakeBestScore,
    ),

  bestLevel:
    Math.min(
      SNAKE_MAX_LEVEL,
      Math.max(
        1,
        safeInt(
          account
            .snakeBestLevel,
        ) ||
          1,
      ),
    ),
},
        flappyRocket: {
  completedRuns:
    safeInt(
      account
        .flappyRocketCompletedRuns,
    ),
},

        knifeHit: {
          completedRuns:
            safeInt(
              account
                .knifeHitCompletedRuns,
            ),

          bestScore:
            safeInt(
              account
                .knifeHitBestScore,
            ),

          highestLevelCleared:
            safeInt(
              account
                .knifeHitHighestLevelCleared,
            ),

          highestUnlockedBatchStart:
            normalizeKnifeHitBatchStart(
              account
                .knifeHitHighestUnlockedBatchStart,
            ),
        },

        brickBreaker: {
          totalLevels:
            GENZ_BRICK_BREAKER_MAX_LEVEL,

          highestUnlockedLevel:
            Math.min(
              GENZ_BRICK_BREAKER_MAX_LEVEL,

              Math.max(
                1,

                safeInt(
                  account
                    .brickBreakerHighestUnlockedLevel,
                ) ||
                  1,
              ),
            ),

          highestLevelCleared:
            Math.min(
              GENZ_BRICK_BREAKER_MAX_LEVEL,

              safeInt(
                account
                  .brickBreakerHighestLevelCleared,
              ),
            ),

          rewardedRuns:
            safeInt(
              account
                .brickBreakerRewardedRuns,
            ),

          completedRuns:
            safeInt(
              account
                .brickBreakerCompletedRuns,
            ),

          bestScore:
            safeInt(
              account
                .brickBreakerBestScore,
            ),
        },

        candyCascade: {
          totalLevels:
            GENZ_CANDY_CASCADE_MAX_LEVEL,

          highestUnlockedLevel:
            Math.min(
              GENZ_CANDY_CASCADE_MAX_LEVEL,

              Math.max(
                1,

                safeInt(
                  account
                    .candyCascadeHighestUnlockedLevel,
                ) ||
                  1,
              ),
            ),

          highestLevelCleared:
            Math.min(
              GENZ_CANDY_CASCADE_MAX_LEVEL,

              safeInt(
                account
                  .candyCascadeHighestLevelCleared,
              ),
            ),

          completedRuns:
            safeInt(
              account
                .candyCascadeCompletedRuns,
            ),

          bestScore:
            safeInt(
              account
                .candyCascadeBestScore,
            ),

          totalStars:
            candyCascadeTotalStars,

          levelStars:
            candyCascadeLevelStars,
        },
      };
    },
  );

export const startGenZGoldMine =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {
      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to start mining.",
        );
      }


      const minerId =
        normalizeGoldMinerId(
          request
            .data
            ?.minerId,
        );


      const uid =
        request.auth.uid;


      const ref =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const now =
        Timestamp.now();


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {
            const snap =
              await tx.get(
                ref,
              );


            const account =
              snap.exists
                ? (
                    snap.data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const state =
              mineState(
                account,
                minerId,
                now.toMillis(),
              );


            if (
              state.currentCycleId
            ) {
              return {
                startedNew:
                  false,

                account,
              };
            }


            const cycleId =
              crypto.randomUUID();


            const existingMiners =
              account.goldMiners &&
              typeof account.goldMiners ===
                "object"
                ? account.goldMiners
                : {};


            const existingMiner =
              existingMiners[
                String(
                  minerId,
                )
              ] &&
              typeof existingMiners[
                String(
                  minerId,
                )
              ] ===
                "object"
                ? existingMiners[
                    String(
                      minerId,
                    )
                  ]
                : {};


            const next = {
              ...account,

              goldMiners: {
                ...existingMiners,

                [
                  String(
                    minerId,
                  )
                ]: {
                  ...existingMiner,

                  currentCycleId:
                    cycleId,

                  startedAt:
                    now,

                  collectedCycles:
                    safeInt(
                      existingMiner
                        .collectedCycles,
                    ),
                },
              },

              /*
               * Clear old active Miner 1
               * fields after the user starts
               * a new-format Miner 1 cycle.
               */
              ...(
                minerId ===
                  1
                  ? {
                      goldMineCurrentCycleId:
                        null,

                      goldMineStartedAt:
                        null,
                    }
                  : {}
              ),

              updatedAt:
                now,
            };


            tx.set(
              ref,
              next,
              {
                merge:
                  true,
              },
            );


            return {
              startedNew:
                true,

              account:
                next,
            };
          },
        );


      return {
        success:
          true,

        minerId,

        startedNew:
          result.startedNew,

        goldMine:
          mineState(
            result.account,
            minerId,
            now.toMillis(),
          ),

        goldMiners:
          allMineStates(
            result.account,
            now.toMillis(),
          ),
      };
    },
  );

export const collectGenZGoldMine =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {
      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to collect mining rewards.",
        );
      }


      const minerId =
        normalizeGoldMinerId(
          request
            .data
            ?.minerId,
        );


      const uid =
        request.auth.uid;


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {
            const accountSnapshot =
              await tx.get(
                accountRef,
              );


            if (
              !accountSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Start mining first.",
              );
            }


            const account =
              accountSnapshot.data() ??
              {};


            const state =
              mineState(
                account,
                minerId,
                now.toMillis(),
              );


            if (
              !state.currentCycleId ||
              !state.canCollect
            ) {
              throw new HttpsError(
                "failed-precondition",
                `Miner ${minerId} has not completed the 3-minute mining cycle yet.`,
              );
            }


            const transactionRef =
              db
                .collection(
                  "genzGameTransactions",
                )
                .doc(
                  `${uid}_mine_${minerId}_${state.currentCycleId}`,
                );


            const [
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            if (
              transactionSnapshot.exists
            ) {
              throw new HttpsError(
                "already-exists",
                "This mining cycle was already collected.",
              );
            }


            const reward =
              GOLD_MINE_REWARD_PAISE;


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},

                {
                  uid,

                  dayKey,

                  amount:
                    GOLD_MINE_DIAMOND_REWARD,

                  source:
                    "mining",

                  userData,

                  now,
                },
              );


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              GOLD_MINE_DIAMOND_REWARD;


            const existingMiners =
              account.goldMiners &&
              typeof account.goldMiners ===
                "object"
                ? account.goldMiners
                : {};


            const existingMiner =
              existingMiners[
                String(
                  minerId,
                )
              ] &&
              typeof existingMiners[
                String(
                  minerId,
                )
              ] ===
                "object"
                ? existingMiners[
                    String(
                      minerId,
                    )
                  ]
                : {};


            const nextMinerCollectedCycles =
              safeInt(
                existingMiner
                  .collectedCycles,
              ) +
              1;


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                reward,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                reward,

              lifetimeDiamonds,

              goldMineCollectedCycles:
                safeInt(
                  account
                    .goldMineCollectedCycles,
                ) +
                1,

              goldMiners: {
                ...existingMiners,

                [
                  String(
                    minerId,
                  )
                ]: {
                  ...existingMiner,

                  currentCycleId:
                    null,

                  startedAt:
                    null,

                  collectedCycles:
                    nextMinerCollectedCycles,
                },
              },

              ...(
                minerId ===
                  1
                  ? {
                      goldMineCurrentCycleId:
                        null,

                      goldMineStartedAt:
                        null,
                    }
                  : {}
              ),

              updatedAt:
                now,
            };


            await creditReferralGameReward(
              tx,
              {
                referredUserId:
                  uid,

                referredByUserId:
                  userData
                    .referredByUserId,

                referredByReferralId:
                  userData
                    .referredByReferralId,

                source:
                  "mining",

                eventId:
                  `${minerId}_${state.currentCycleId}`,

                now,
              },
            );


            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "gold_mine",

                minerId,

                type:
                  "mining_cycle",

                amountPaise:
                  reward,

                currency:
                  CURRENCY,

                diamonds:
                  GOLD_MINE_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                cycleId:
                  state.currentCycleId,

                createdAt:
                  now,
              },
            );


            return {
              cycleId:
                state.currentCycleId,

              reward,

              account:
                next,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              collectedCycles:
                nextMinerCollectedCycles,
            };
          },
        );


      return {
        success:
          true,

        minerId,

        cycleId:
          result.cycleId,

        rewardGranted:
          true,

        rewardPaise:
          result.reward,

        diamondsGranted:
          GOLD_MINE_DIAMOND_REWARD,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result.todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        collectedCycles:
          result.collectedCycles,

        goldMine:
          mineState(
            result.account,
            minerId,
            now.toMillis(),
          ),

        goldMiners:
          allMineStates(
            result.account,
            now.toMillis(),
          ),
      };
    },
  );

export const startGenZRealGoldMine =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to start Real Gold Mining.",
        );
      }

      const minerId =
        normalizeRealGoldMinerId(
          request
            .data
            ?.minerId,
        );

      const uid =
        request.auth.uid;

      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );

      const now =
        Timestamp.now();

      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const snapshot =
              await tx.get(
                accountRef,
              );

            const account =
              snapshot.exists
                ? (
                    snapshot.data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );

            const state =
              realGoldMineState(
                account,
                minerId,
                now.toMillis(),
              );

            if (
              state.currentCycleId
            ) {
              return {
                startedNew:
                  false,

                account,
              };
            }

            const cycleId =
              crypto.randomUUID();

            const existingMiners =
              account.realGoldMiners &&
              typeof account.realGoldMiners ===
                "object"
                ? account.realGoldMiners
                : {};

            const existingMiner =
              getRealGoldMinerRecord(
                account,
                minerId,
              );

            const next = {
              ...account,

              realGoldMiners: {
                ...existingMiners,

                [
                  String(
                    minerId,
                  )
                ]: {
                  ...existingMiner,

                  currentCycleId:
                    cycleId,

                  startedAt:
                    now,

                  collectedCycles:
                    safeInt(
                      existingMiner
                        .collectedCycles,
                    ),
                },
              },

              updatedAt:
                now,
            };

            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );

            return {
              startedNew:
                true,

              account:
                next,
            };
          },
        );

      return {
        success:
          true,

        minerId,

        startedNew:
          result.startedNew,

        miner:
          realGoldMineState(
            result.account,
            minerId,
            now.toMillis(),
          ),

        miners:
          allRealGoldMineStates(
            result.account,
            now.toMillis(),
          ),
      };
    },
  );


export const collectGenZRealGoldMine =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to collect Real Gold.",
        );
      }

      const minerId =
        normalizeRealGoldMinerId(
          request
            .data
            ?.minerId,
        );

      const uid =
        request.auth.uid;

      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );

      const goldConfigRef =
        getRealGoldConfigRef();

      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();

      const userData =
        userSnapshot.data() ??
        {};

      const now =
        Timestamp.now();

      const dayKey =
        getIstDayKey(
          now.toDate(),
        );

      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );

      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            /*
             * Read account, daily leaderboard and
             * current Admin gold rate inside the
             * same transaction.
             *
             * This makes the collection use the
             * gold rate available when the reward
             * transaction is processed.
             */
            const [
              accountSnapshot,
              dailySnapshot,
              goldConfigSnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  dailyRef,
                ),

                tx.get(
                  goldConfigRef,
                ),
              ]);

            if (
              !accountSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Start Real Gold Mining first.",
              );
            }

            const account =
              accountSnapshot.data() ??
              {};

            const state =
              realGoldMineState(
                account,
                minerId,
                now.toMillis(),
              );

            if (
              !state.currentCycleId ||
              !state.canCollect
            ) {
              throw new HttpsError(
                "failed-precondition",
                `Gold Miner ${minerId} has not completed the 15-minute cycle yet.`,
              );
            }

            /*
             * Use the latest Admin-set gold rate.
             *
             * If no Admin rate exists yet,
             * fallback is ₹12,000 / gram.
             */
            const goldConfigData =
              goldConfigSnapshot.exists
                ? (
                    goldConfigSnapshot.data() ??
                    {}
                  )
                : {};

            const goldRatePaisePerGram =
              goldConfigSnapshot.exists
                ? normalizeGoldRatePaisePerGram(
                    goldConfigData
                      .goldRatePaisePerGram,
                  )
                : DEFAULT_GOLD_RATE_PAISE_PER_GRAM;

            /*
             * ₹0.06 = 6 paise.
             *
             * Store the actual gold reward as
             * integer nanograms.
             *
             * IMPORTANT:
             * Math.floor prevents the awarded
             * gold from exceeding ₹0.06 because
             * of rounding.
             */
            const goldRewardNanograms =
              Math.max(
                1,

                Math.floor(
                  (
                    REAL_GOLD_REWARD_PAISE *
                    NANOGRAMS_PER_GRAM
                  ) /
                    goldRatePaisePerGram,
                ),
              );

            /*
             * Deterministic reward document.
             *
             * Same user + miner + cycle can only
             * be collected once.
             */
            const transactionRef =
              db
                .collection(
                  "genzGameTransactions",
                )
                .doc(
                  `${uid}_real_gold_${minerId}_${state.currentCycleId}`,
                );

            const transactionSnapshot =
              await tx.get(
                transactionRef,
              );

            if (
              transactionSnapshot.exists
            ) {
              throw new HttpsError(
                "already-exists",
                "This Real Gold reward was already collected.",
              );
            }

            const existingMiners =
              account.realGoldMiners &&
              typeof account.realGoldMiners ===
                "object"
                ? account.realGoldMiners
                : {};

            const existingMiner =
              getRealGoldMinerRecord(
                account,
                minerId,
              );

            const nextBalanceNanograms =
              safeInt(
                account
                  .realGoldBalanceNanograms,
              ) +
              goldRewardNanograms;

            const nextLifetimeNanograms =
              safeInt(
                account
                  .realGoldLifetimeNanograms,
              ) +
              goldRewardNanograms;

            const nextCollectedCycles =
              safeInt(
                account
                  .realGoldCollectedCycles,
              ) +
              1;

            const nextMinerCollectedCycles =
              safeInt(
                existingMiner
                  .collectedCycles,
              ) +
              1;

            const dailyData =
              dailySnapshot.exists
                ? (
                    dailySnapshot.data() ??
                    {}
                  )
                : {};

            /*
             * Real Gold uses the existing
             * "mining" diamond leaderboard bucket.
             */
            const nextDailyDiamondData =
              buildDailyDiamondPlayerData(
                dailyData,
                {
                  uid,

                  dayKey,

                  amount:
                    REAL_GOLD_DIAMOND_REWARD,

                  source:
                    "mining",

                  userData,

                  now,
                },
              );

            const todayDiamonds =
              safeInt(
                nextDailyDiamondData
                  .diamonds,
              );

            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              REAL_GOLD_DIAMOND_REWARD;

            const nextAccount = {
              ...account,

              realGoldBalanceNanograms:
                nextBalanceNanograms,

              realGoldLifetimeNanograms:
                nextLifetimeNanograms,

              realGoldCollectedCycles:
                nextCollectedCycles,

              lifetimeDiamonds,

              realGoldMiners: {
                ...existingMiners,

                [
                  String(
                    minerId,
                  )
                ]: {
                  ...existingMiner,

                  currentCycleId:
                    null,

                  startedAt:
                    null,

                  collectedCycles:
                    nextMinerCollectedCycles,
                },
              },

              updatedAt:
                now,
            };

            tx.set(
              accountRef,
              nextAccount,
              {
                merge:
                  true,
              },
            );

            tx.set(
              dailyRef,
              nextDailyDiamondData,
              {
                merge:
                  true,
              },
            );

            /*
             * Permanent collection audit.
             *
             * Keep ₹0.06 and gold rate here for
             * backend/admin auditing only.
             */
            tx.create(
              transactionRef,
              {
                userId:
                  uid,

                type:
                  "real_gold_mining_reward",

                source:
                  "real_gold_mining",

                minerId,

                cycleId:
                  state.currentCycleId,

                rewardValuePaise:
                  REAL_GOLD_REWARD_PAISE,

                goldRatePaisePerGram,

                goldNanograms:
                  goldRewardNanograms,

                diamonds:
                  REAL_GOLD_DIAMOND_REWARD,

                collectedAt:
                  now,

                createdAt:
                  now,
              },
            );

            return {
              account:
                nextAccount,

              cycleId:
                state.currentCycleId,

              goldRewardNanograms,

              nextBalanceNanograms,

              nextLifetimeNanograms,

              nextCollectedCycles,

              nextMinerCollectedCycles,

              todayDiamonds,

              lifetimeDiamonds,
            };
          },
        );

      /*
       * IMPORTANT:
       *
       * Do NOT return ₹0.06 or the Admin gold
       * rate to the normal player application.
       */
      return {
        success:
          true,

        minerId,

        cycleId:
          result.cycleId,

        goldNanogramsGranted:
          result
            .goldRewardNanograms,

        diamondsGranted:
          REAL_GOLD_DIAMOND_REWARD,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result.todayDiamonds,

        lifetimeDiamonds:
          result.lifetimeDiamonds,

        balanceNanograms:
          result
            .nextBalanceNanograms,

        lifetimeNanograms:
          result
            .nextLifetimeNanograms,

        collectedCycles:
          result
            .nextCollectedCycles,

        miner:
          realGoldMineState(
            result.account,
            minerId,
            now.toMillis(),
          ),

        miners:
          allRealGoldMineStates(
            result.account,
            now.toMillis(),
          ),
      };
    },
  );


export const getAdminGenZGamesGoldRate =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }

      await requireAdmin(
        request.auth.uid,
      );

      const config =
        await getCurrentGoldRate();

      return {
        success:
          true,

        goldRatePaisePerGram:
          config
            .goldRatePaisePerGram,

        goldRateRupeesPerGram:
          config
            .goldRatePaisePerGram /
          100,

        updatedAt:
          config.updatedAt,

        usingDefault:
          config.usingDefault,
      };
    },
  );


export const saveAdminGenZGamesGoldRate =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }

      await requireAdmin(
        request.auth.uid,
      );

      const goldRateRupeesPerGram =
        Number(
          request
            .data
            ?.goldRateRupeesPerGram,
        );

      if (
        !Number.isFinite(
          goldRateRupeesPerGram,
        ) ||
        goldRateRupeesPerGram <=
          0 ||
        goldRateRupeesPerGram >
          1_000_000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid gold rate per gram.",
        );
      }

      const goldRatePaisePerGram =
        Math.round(
          goldRateRupeesPerGram *
          100,
        );

      const now =
        Timestamp.now();

      await getRealGoldConfigRef()
        .set(
          {
            goldRatePaisePerGram,

            goldRateRupeesPerGram:
              goldRatePaisePerGram /
              100,

            updatedAt:
              now,

            updatedBy:
              request.auth.uid,
          },
          {
            merge:
              true,
          },
        );

      return {
        success:
          true,

        goldRatePaisePerGram,

        goldRateRupeesPerGram:
          goldRatePaisePerGram /
          100,

        updatedAt:
          now
            .toDate()
            .toISOString(),
      };
    },
  );
function normalizeBoard(value: unknown): number[][] | null { if(!Array.isArray(value)||value.length!==9)return null; const out:number[][]=[]; for(const row of value){if(!Array.isArray(row)||row.length!==9)return null; const r:number[]=[]; for(const cell of row){if(typeof cell!=="number"||!Number.isInteger(cell)||cell<1||cell>9)return null;r.push(cell);}out.push(r);}return out; }

export const completeGenZSudokuLevel =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Sudoku levels.",
        );
      }


      const uid =
        request.auth.uid;


      const attemptId =
        typeof request.data
          ?.attemptId ===
          "string"
          ? request.data
              .attemptId
              .trim()
          : "";


      if (
        !/^[A-Za-z0-9_-]{8,160}$/.test(
          attemptId,
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Sudoku attempt.",
        );
      }


      const level =
        Number(
          request.data
            ?.level,
        );


      const elapsed =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      const board =
        normalizeBoard(
          request.data
            ?.finalBoard,
        );


      if (
        !Number.isInteger(
          level,
        ) ||
        level <
          1 ||
        level >
          SUDOKU_TOTAL_LEVELS
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Sudoku level.",
        );
      }


      if (
        !board
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Sudoku board.",
        );
      }


      const generated =
        generateGenZSudokuLevel(
          level,
        );


      for (
        let row =
          0;

        row <
          9;

        row +=
          1
      ) {

        for (
          let column =
            0;

          column <
            9;

          column +=
            1
        ) {

          if (
            board[
              row
            ][
              column
            ] !==
            generated
              .solution[
                row
              ][
                column
              ]
          ) {
            throw new HttpsError(
              "failed-precondition",
              "This Sudoku level is not complete.",
            );
          }
        }
      }


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const levelRef =
        accountRef
          .collection(
            "sudokuLevels",
          )
          .doc(
            String(
              level,
            ),
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_sudoku_${level}`,
          );

            const attemptTransactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_sudoku_attempt_${attemptId}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              levelSnapshot,
              transactionSnapshot,
              attemptTransactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  levelRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  attemptTransactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const highest =
              Math.max(
                1,

                safeInt(
                  account
                    .sudokuHighestUnlockedLevel,
                ) ||
                1,
              );


            if (
              level >
              highest
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Unlock this level with the rewarded ad first.",
              );
            }


            const completed =
              normalizeCompleted(
                account
                  .sudokuCompletedLevelNumbers,
              );

                        /*
             * Same attemptId = same verified play attempt.
             *
             * A callable/network retry must never:
             *
             * - advance Daily Streak again
             * - pay Sudoku reward again
             * - grant diamonds again
             */
            if (
              attemptTransactionSnapshot
                .exists
            ) {
              return {
                reward:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completed,

                highest,
              };
            }


            /*
 * =====================================================
 * ALREADY COMPLETED / REPLAY CHECK
 * =====================================================
 *
 * IMPORTANT:
 *
 * sudokuLevels/<level> can already exist BEFORE the
 * level is completed because unlocking the next level
 * creates this document with:
 *
 * unlocked: true
 *
 * Therefore:
 *
 * levelSnapshot.exists
 *
 * by itself MUST NOT mean that the level was completed.
 *
 * A level is considered completed only when:
 *
 * 1. the level document explicitly says completed=true
 * 2. OR the completion transaction already exists
 * 3. OR the account completed-level list contains it
 */
const levelAlreadyCompleted =
  levelSnapshot.exists &&
  levelSnapshot
    .data()
    ?.completed ===
    true;


const transactionAlreadyExists =
  transactionSnapshot.exists;


const accountAlreadyCompleted =
  completed.includes(
    level,
  );


if (
  levelAlreadyCompleted ||
  transactionAlreadyExists ||
  accountAlreadyCompleted
) {

  /*
   * This is a genuine verified replay.
   *
   * Normal Sudoku cash/diamond reward remains
   * one-time only, but this unique attempt can
   * contribute one completion to Daily Streak.
   */
  const repairedCompleted =
    accountAlreadyCompleted
      ? completed
      : [
          ...completed,
          level,
        ].sort(
          (
            first,
            second,
          ) =>
            first -
            second,
        );


  const dailyStreak =
    applyDailyStreakLevelCompletion(
      account,
      dayKey,
      now,
      1,
    );


  const repairedAccount = {
    ...account,

    balancePaise:
      safeInt(
        account
          .balancePaise,
      ) +
      dailyStreak
        .walletCreditPaise,

    lifetimeEarningsPaise:
      safeInt(
        account
          .lifetimeEarningsPaise,
      ) +
      dailyStreak
        .walletCreditPaise,

    sudokuCompletedLevelNumbers:
      repairedCompleted,

    ...getDailyStreakAccountUpdate(
      dailyStreak,
    ),

    updatedAt:
      now,
  };


  tx.set(
    accountRef,
    repairedAccount,
    {
      merge:
        true,
    },
  );


  tx.set(
    attemptTransactionRef,
    {
      userId:
        uid,

      gameId:
        "genz_sudoku",

      type:
        "verified_attempt",

      attemptId,

      level,

      firstCompletion:
        false,

      amountPaise:
        0,

      diamonds:
        0,

      streakWalletCreditPaise:
        dailyStreak
          .walletCreditPaise,

      diamondDayKey:
        dayKey,

      createdAt:
        now,
    },
  );


  return {
    reward:
      0,

    diamondsGranted:
      0,

    todayDiamonds:
      safeInt(
        dailySnapshot
          .data()
          ?.diamonds,
      ),

    account:
      repairedAccount,

    completed:
      repairedCompleted,

    highest,
  };
}


            const reward =
              nextReward(
                account,
              );


            const nextCompleted =
              [
                ...completed,
                level,
              ]
                .sort(
                  (
                    first,
                    second,
                  ) =>
                    first -
                    second,
                );


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                {},

                {
                  uid,

                  dayKey,

                  amount:
                    SUDOKU_DIAMOND_REWARD,

                  source:
                    "sudoku",

                  userData,

                  now,
                },
              );


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              SUDOKU_DIAMOND_REWARD;


            const dailyStreak =
              applyDailyStreakLevelCompletion(
                account,
                dayKey,
                now,
                1,
              );


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account.balancePaise,
                ) +
                reward +
                dailyStreak
                  .walletCreditPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                reward +
                dailyStreak
                  .walletCreditPaise,

              lifetimeDiamonds,

              ...getDailyStreakAccountUpdate(
                dailyStreak,
              ),

              firstGameRewardGranted:
                true,

              sudokuCompletedLevelNumbers:
                nextCompleted,

              updatedAt:
                now,
            };

            await creditReferralGameReward(
  tx,
  {
    referredUserId:
      uid,

    referredByUserId:
      userData
        .referredByUserId,

    referredByReferralId:
      userData
        .referredByReferralId,

    source:
      "sudoku",

    eventId:
      `level_${level}`,

    now,
  },
);


            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            tx.set(
  levelRef,
  {
    level,

    completed:
      true,

    elapsedSeconds:
      elapsed,

    completedAt:
      now,

    updatedAt:
      now,
  },
  {
    merge:
      true,
  },
);


            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_sudoku",

                type:
                  "level_completion",

                level,

                amountPaise:
                  reward,

                currency:
                  CURRENCY,

                diamonds:
                  SUDOKU_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );

                        tx.set(
              attemptTransactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_sudoku",

                type:
                  "verified_attempt",

                attemptId,

                level,

                firstCompletion:
                  true,

                amountPaise:
                  reward,

                diamonds:
                  SUDOKU_DIAMOND_REWARD,

                streakWalletCreditPaise:
                  dailyStreak
                    .walletCreditPaise,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              reward,

              diamondsGranted:
                SUDOKU_DIAMOND_REWARD,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              account:
                next,

              completed:
                nextCompleted,

              highest,
            };
          },
        );


      return {
        success:
          true,

        level,

        rewardGranted:
          result.reward >
          0,

        rewardPaise:
          result.reward,

        diamondsGranted:
          result
            .diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result
            .todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            (
              result.account as
                FirebaseFirestore.DocumentData
            ).lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            (
              result.account as
                FirebaseFirestore.DocumentData
            ).balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            (
              result.account as
                FirebaseFirestore.DocumentData
            ).lifetimeEarningsPaise,
          ),

        completedLevels:
          result
            .completed
            .length,

        completedLevelNumbers:
          result
            .completed,

        highestUnlockedLevel:
          result
            .highest,
      };
    },
  );

type GenZ2048Direction =
  | "up"
  | "down"
  | "left"
  | "right";


const GENZ_2048_SIZE =
  4;

const GENZ_2048_MAX_MOVES =
  20000;


function createGenZ2048EmptyBoard():
number[][] {

  return Array.from(
    {
      length:
        GENZ_2048_SIZE,
    },
    () =>
      Array(
        GENZ_2048_SIZE,
      ).fill(0),
  );
}


function cloneGenZ2048Board(
  board:
    number[][],
):
number[][] {

  return board.map(
    (row) => [
      ...row,
    ],
  );
}


function createGenZ2048Random(
  seed:
    number,
) {

  let value =
    seed >>> 0;


  return () => {

    value =
      (
        value +
        0x6d2b79f5
      ) >>> 0;


    let result =
      value;


    result =
      Math.imul(
        result ^
          (
            result >>>
            15
          ),
        result |
          1,
      );


    result ^=
      result +
      Math.imul(
        result ^
          (
            result >>>
            7
          ),
        result |
          61,
      );


    return (
      (
        (
          result ^
          (
            result >>>
            14
          )
        ) >>>
        0
      ) /
      4294967296
    );
  };
}


function genZ2048RandomAtStep(
  seed:
    number,

  step:
    number,
) {

  const random =
    createGenZ2048Random(
      seed,
    );


  let value =
    0;


  for (
    let index = 0;
    index <= step;
    index += 1
  ) {

    value =
      random();
  }


  return value;
}


function getGenZ2048EmptyCells(
  board:
    number[][],
) {

  const cells:
    Array<{
      row: number;
      column: number;
    }> =
    [];


  for (
    let row = 0;
    row <
      GENZ_2048_SIZE;
    row += 1
  ) {

    for (
      let column = 0;
      column <
        GENZ_2048_SIZE;
      column += 1
    ) {

      if (
        board[row][column] ===
        0
      ) {

        cells.push({
          row,
          column,
        });
      }
    }
  }


  return cells;
}


function addGenZ2048SeededTile(
  board:
    number[][],

  seed:
    number,

  randomStep:
    number,
) {

  const next =
    cloneGenZ2048Board(
      board,
    );


  const empty =
    getGenZ2048EmptyCells(
      next,
    );


  if (
    empty.length ===
    0
  ) {

    return {
      board:
        next,

      randomStep,
    };
  }


  const cellRandom =
    genZ2048RandomAtStep(
      seed,
      randomStep,
    );


  const valueRandom =
    genZ2048RandomAtStep(
      seed,
      randomStep + 1,
    );


  const selected =
    empty[
      Math.min(
        empty.length - 1,

        Math.floor(
          cellRandom *
            empty.length,
        ),
      )
    ];


  next[
    selected.row
  ][
    selected.column
  ] =
    valueRandom <
    0.9
      ? 2
      : 4;


  return {
    board:
      next,

    randomStep:
      randomStep +
      2,
  };
}


function createGenZ2048InitialBoard(
  seed:
    number,
) {

  let board =
    createGenZ2048EmptyBoard();


  let randomStep =
    0;


  const first =
    addGenZ2048SeededTile(
      board,
      seed,
      randomStep,
    );


  board =
    first.board;

  randomStep =
    first.randomStep;


  const second =
    addGenZ2048SeededTile(
      board,
      seed,
      randomStep,
    );


  return {
    board:
      second.board,

    randomStep:
      second.randomStep,
  };
}


function reverseGenZ2048Rows(
  board:
    number[][],
):
number[][] {

  return board.map(
    (row) =>
      [
        ...row,
      ].reverse(),
  );
}


function transposeGenZ2048(
  board:
    number[][],
):
number[][] {

  const next =
    createGenZ2048EmptyBoard();


  for (
    let row = 0;
    row <
      GENZ_2048_SIZE;
    row += 1
  ) {

    for (
      let column = 0;
      column <
        GENZ_2048_SIZE;
      column += 1
    ) {

      next[
        column
      ][
        row
      ] =
        board[
          row
        ][
          column
        ];
    }
  }


  return next;
}


function slideGenZ2048RowLeft(
  row:
    number[],
) {

  const filtered =
    row.filter(
      (value) =>
        value !==
        0,
    );


  const merged:
    number[] =
    [];


  let scoreGained =
    0;


  for (
    let index = 0;
    index <
      filtered.length;
    index += 1
  ) {

    if (
      filtered[index] ===
      filtered[
        index + 1
      ]
    ) {

      const value =
        filtered[index] *
        2;


      merged.push(
        value,
      );


      scoreGained +=
        value;


      index +=
        1;
    } else {

      merged.push(
        filtered[index],
      );
    }
  }


  while (
    merged.length <
    GENZ_2048_SIZE
  ) {

    merged.push(
      0,
    );
  }


  return {
    row:
      merged,

    scoreGained,
  };
}


function moveGenZ2048Left(
  board:
    number[][],
) {

  let scoreGained =
    0;


  const next =
    board.map(
      (row) => {

        const result =
          slideGenZ2048RowLeft(
            row,
          );


        scoreGained +=
          result
            .scoreGained;


        return result
          .row;
      },
    );


  return {
    board:
      next,

    scoreGained,
  };
}

function moveGenZ2048Board(
  board: number[][],
  direction: GenZ2048Direction,
) {
  if (direction === "left") {
    return moveGenZ2048Left(board);
  }

  if (direction === "right") {
    const moved =
      moveGenZ2048Left(
        reverseGenZ2048Rows(
          board,
        ),
      );

    return {
      board:
        reverseGenZ2048Rows(
          moved.board,
        ),

      scoreGained:
        moved.scoreGained,
    };
  }

  if (direction === "up") {
    const moved =
      moveGenZ2048Left(
        transposeGenZ2048(
          board,
        ),
      );

    return {
      board:
        transposeGenZ2048(
          moved.board,
        ),

      scoreGained:
        moved.scoreGained,
    };
  }

  const transposed =
    transposeGenZ2048(
      board,
    );

  const moved =
    moveGenZ2048Left(
      reverseGenZ2048Rows(
        transposed,
      ),
    );

  return {
    board:
      transposeGenZ2048(
        reverseGenZ2048Rows(
          moved.board,
        ),
      ),

    scoreGained:
      moved.scoreGained,
  };
}


function genZ2048BoardsEqual(
  first: number[][],
  second: number[][],
) {
  for (
    let row = 0;
    row < GENZ_2048_SIZE;
    row += 1
  ) {
    for (
      let column = 0;
      column < GENZ_2048_SIZE;
      column += 1
    ) {
      if (
        first[row][column] !==
        second[row][column]
      ) {
        return false;
      }
    }
  }

  return true;
}


function canGenZ2048Move(
  board: number[][],
) {
  if (
    getGenZ2048EmptyCells(
      board,
    ).length > 0
  ) {
    return true;
  }

  for (
    let row = 0;
    row < GENZ_2048_SIZE;
    row += 1
  ) {
    for (
      let column = 0;
      column < GENZ_2048_SIZE;
      column += 1
    ) {
      const value =
        board[row][column];

      if (
        row + 1 <
          GENZ_2048_SIZE &&
        board[
          row + 1
        ][column] ===
          value
      ) {
        return true;
      }

      if (
        column + 1 <
          GENZ_2048_SIZE &&
        board[row][
          column + 1
        ] === value
      ) {
        return true;
      }
    }
  }

  return false;
}


function getGenZ2048HighestTile(
  board: number[][],
) {
  return Math.max(
    0,
    ...board.flat(),
  );
}


function getGenZ2048Reward(
  highestTile: number,
) {
  if (
    highestTile >= 2048
  ) {
    return {
      rewardPaise:
        GENZ_2048_MAX_REWARD_PAISE,

      diamonds:
        GENZ_2048_MAX_DIAMOND_REWARD,
    };
  }

  if (
    highestTile >= 1024
  ) {
    return {
      rewardPaise: 4,
      diamonds: 7,
    };
  }

  if (
    highestTile >= 512
  ) {
    return {
      rewardPaise: 3,
      diamonds: 5,
    };
  }

  if (
    highestTile >= 256
  ) {
    return {
      rewardPaise: 2,
      diamonds: 3,
    };
  }

  if (
    highestTile >= 128
  ) {
    return {
      rewardPaise: 1,
      diamonds: 2,
    };
  }

  return {
    rewardPaise: 0,
    diamonds: 0,
  };
}


function normalizeGenZ2048Moves(
  value: unknown,
):
GenZ2048Direction[] | null {
  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_2048_MAX_MOVES
  ) {
    return null;
  }

  const moves:
    GenZ2048Direction[] =
    [];

  for (
    const move of value
  ) {
    if (
      move !== "up" &&
      move !== "down" &&
      move !== "left" &&
      move !== "right"
    ) {
      return null;
    }

    moves.push(
      move,
    );
  }

  return moves;
}


function replayGenZ2048Run(
  seed: number,
  moves:
    GenZ2048Direction[],
) {
  const initial =
    createGenZ2048InitialBoard(
      seed,
    );

  let board =
    initial.board;

  let randomStep =
    initial.randomStep;

  let score =
    0;


  for (
    const direction of moves
  ) {
    const moved =
      moveGenZ2048Board(
        board,
        direction,
      );


    if (
      genZ2048BoardsEqual(
        board,
        moved.board,
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The 2048 move history contains an invalid move.",
      );
    }


    const withTile =
      addGenZ2048SeededTile(
        moved.board,
        seed,
        randomStep,
      );


    board =
      withTile.board;

    randomStep =
      withTile.randomStep;

    score +=
      moved.scoreGained;


    if (
      getGenZ2048HighestTile(
        board,
      ) >= 2048
    ) {
      break;
    }
  }


  return {
    board,

    score,

    highestTile:
      getGenZ2048HighestTile(
        board,
      ),

    canMove:
      canGenZ2048Move(
        board,
      ),
  };
}

function normalizeGenZSnakeDirectionEvents(
  value:
    unknown,

  tickCount:
    number,
):
  GenZSnakeDirectionEvent[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_SNAKE_MAX_DIRECTION_EVENTS
  ) {

    return null;
  }


  const events:
    GenZSnakeDirectionEvent[] =
    [];


  let previousTick =
    0;


  for (
    const item
    of value
  ) {

    if (
      !item ||
      typeof item !==
        "object"
    ) {

      return null;
    }


    const raw =
      item as {
        tick?: unknown;

        direction?: unknown;
      };


    const tick =
      Number(
        raw.tick,
      );


    if (
      !Number.isInteger(
        tick,
      ) ||
      tick <
        1 ||
      tick >
        tickCount ||
      tick <=
        previousTick ||
      !isGenZSnakeDirection(
        raw.direction,
      )
    ) {

      return null;
    }


    events.push({
      tick,

      direction:
        raw.direction,
    });


    previousTick =
      tick;
  }


  return events;
}

function normalizeGenZFlappyRocketFlapEvents(
  value:
    unknown,

  tickCount:
    number,
):
  GenZFlappyRocketFlapEvent[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_FLAPPY_MAX_FLAP_EVENTS
  ) {

    return null;
  }


  const events:
    GenZFlappyRocketFlapEvent[] =
    [];


  let previousTick =
    0;


  for (
    const item of
    value
  ) {

    if (
      !item ||
      typeof item !==
        "object"
    ) {

      return null;
    }


    const raw =
      item as {
        tick?:
          unknown;
      };


    const tick =
      Number(
        raw.tick,
      );


    if (
      !Number.isInteger(
        tick,
      ) ||
      tick <
        1 ||
      tick >
        tickCount ||
      tick <=
        previousTick
    ) {

      return null;
    }


    events.push({
      tick,
    });


    previousTick =
      tick;
  }


  return events;
}

function normalizeGenZBrickBreakerInputEvents(
  value:
    unknown,

  tickCount:
    number,
):
  GenZBrickBreakerInputEvent[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_BRICK_BREAKER_MAX_INPUT_EVENTS
  ) {
    return null;
  }


  const events:
    GenZBrickBreakerInputEvent[] =
    [];


  let previousTick =
    -1;


  for (
    const item of
    value
  ) {

    if (
      !isGenZBrickBreakerInputEvent(
        item,
      )
    ) {
      return null;
    }


    if (
      item.tick <
        previousTick ||
      item.tick >
        tickCount
    ) {
      return null;
    }


    if (
      item.type ===
      "PADDLE"
    ) {

      events.push({
        type:
          "PADDLE",

        tick:
          item.tick,

        centerX:
          item.centerX,
      });

    } else {

      events.push({
        type:
          "LAUNCH",

        tick:
          item.tick,
      });
    }


    previousTick =
      item.tick;
  }


  return events;
}


function normalizeGenZBrickBreakerReviveEvents(
  value:
    unknown,

  tickCount:
    number,
):
  GenZBrickBreakerReviveEvent[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      GENZ_BRICK_BREAKER_MAX_REVIVES
  ) {
    return null;
  }


  const events:
    GenZBrickBreakerReviveEvent[] =
    [];


  let previousTick =
    -1;


  let expectedReviveNumber =
    1;


  for (
    const item of
    value
  ) {

    if (
      !isGenZBrickBreakerReviveEvent(
        item,
      )
    ) {
      return null;
    }


    if (
      item.afterTick <
        previousTick ||
      item.afterTick >
        tickCount ||
      item.reviveNumber !==
        expectedReviveNumber
    ) {
      return null;
    }


    events.push({
      afterTick:
        item.afterTick,

      reviveNumber:
        item.reviveNumber,
    });


    previousTick =
      item.afterTick;


    expectedReviveNumber +=
      1;
  }


  return events;
}
function normalizeGenZKnifeHitEndReason(
  value:
    unknown,
):
  KnifeHitReplayEndReason |
  null {

  if (
    value ===
      "BATCH_COMPLETE" ||
    value ===
      "OUT_OF_REVIVES" ||
    value ===
      "USER_END"
  ) {
    return value;
  }


  return null;
}


function normalizeGenZKnifeHitAttempts(
  value:
    unknown,

  batchStartLevel:
    number,
):
  KnifeHitReplayAttemptInput[] |
  null {

  if (
    !Array.isArray(
      value,
    ) ||
    value.length <
      1 ||
    value.length >
      16
  ) {
    return null;
  }


  const batchEndLevel =
    batchStartLevel +
    KNIFE_HIT_LEVELS_PER_BATCH -
    1;


  const attempts:
    KnifeHitReplayAttemptInput[] =
    [];


  for (
    const item of
    value
  ) {

    if (
      !item ||
      typeof item !==
        "object"
    ) {
      return null;
    }


    const raw =
      item as {
        level?:
          unknown;

        attemptNumber?:
          unknown;

        throwEvents?:
          unknown;
      };


    const level =
      Number(
        raw.level,
      );


    const attemptNumber =
      Number(
        raw.attemptNumber,
      );


    if (
      !Number.isInteger(
        level,
      ) ||
      level <
        batchStartLevel ||
      level >
        batchEndLevel ||
      !Number.isInteger(
        attemptNumber,
      ) ||
      attemptNumber <
        1 ||
      attemptNumber >
        3 ||
      !Array.isArray(
        raw.throwEvents,
      ) ||
      raw.throwEvents.length <
        1 ||
      raw.throwEvents.length >
        64
    ) {
      return null;
    }


    const throwEvents:
      {
        tick:
          number;
      }[] =
      [];


    let previousTick =
      -1;


    for (
      const throwItem of
      raw.throwEvents
    ) {

      if (
        !throwItem ||
        typeof throwItem !==
          "object"
      ) {
        return null;
      }


      const throwRaw =
        throwItem as {
          tick?:
            unknown;
        };


      const tick =
        Number(
          throwRaw.tick,
        );


      if (
        !Number.isInteger(
          tick,
        ) ||
        tick <
          0 ||
        tick >
          10800 ||
        tick <=
          previousTick
      ) {
        return null;
      }


      throwEvents.push({
        tick,
      });


      previousTick =
        tick;
    }


    attempts.push({
      level,

      attemptNumber,

      throwEvents,
    });
  }


  return attempts;
}

export const completeGenZ2048Run =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete 2048 runs.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const seed =
        Number(
          request.data
            ?.seed,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      const moves =
        normalizeGenZ2048Moves(
          request.data
            ?.moves,
        );


      if (
        !/^[A-Za-z0-9-]{12,80}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          seed,
        ) ||
        seed <
          0 ||
        seed >
          4294967295 ||
        !moves
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid 2048 run data.",
        );
      }


      /*
       * Rebuild the entire game
       * on the backend.
       *
       * The client does NOT tell us
       * what reward it earned.
       */
      const replay =
        replayGenZ2048Run(
          seed >>> 0,
          moves,
        );


      /*
       * No reward before 128.
       */
      if (
        replay.highestTile <
        128
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Reach at least the 128 tile before claiming a reward.",
        );
      }


      /*
       * Below 2048, reward can only
       * be claimed when the board
       * genuinely has no more moves.
       *
       * Reaching 2048 itself is a
       * valid completion point.
       */
      if (
        replay.highestTile <
          2048 &&
        replay.canMove
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This 2048 run is still active.",
        );
      }


      const rewardTier =
        getGenZ2048Reward(
          replay.highestTile,
        );


      /*
       * Important:
       *
       * We intentionally do NOT trust
       * runId alone for duplicate
       * protection because runId is
       * generated by the client.
       *
       * Fingerprint the verified run
       * itself so changing runId cannot
       * replay the exact same game for
       * another reward.
       */
      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              String(
                seed >>> 0,
              ),
              moves.join(
                ",",
              ),
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_2048_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            /*
             * Same verified run has
             * already been rewarded.
             *
             * Return safely with
             * zero new reward.
             */
            if (
              transactionSnapshot
                .exists
            ) {

              const previous =
                transactionSnapshot
                  .data() ??
                {};


              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completedRuns:
                  safeInt(
                    account
                      .game2048CompletedRuns,
                  ),

                bestTile:
                  safeInt(
                    account
                      .game2048BestTile,
                  ),

                highScore:
                  safeInt(
                    account
                      .game2048HighScore,
                  ),

                replayHighestTile:
                  safeInt(
                    previous
                      .highestTile,
                  ) ||
                  replay
                    .highestTile,

                replayScore:
                  safeInt(
                    previous
                      .score,
                  ) ||
                  replay
                    .score,
              };
            }
                        const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},
                {
                  uid,

                  dayKey,

                  amount:
                    rewardTier
                      .diamonds,

                  source:
                    "2048",

                  userData,

                  now,
                },
              );


            const completedRuns =
              safeInt(
                account
                  .game2048CompletedRuns,
              ) +
              1;


            const bestTile =
              Math.max(
                safeInt(
                  account
                    .game2048BestTile,
                ),

                replay
                  .highestTile,
              );


            const highScore =
              Math.max(
                safeInt(
                  account
                    .game2048HighScore,
                ),

                replay
                  .score,
              );


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              rewardTier
                .diamonds;


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                rewardTier
                  .rewardPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                rewardTier
                  .rewardPaise,

              lifetimeDiamonds,

              game2048CompletedRuns:
                completedRuns,

              game2048BestTile:
                bestTile,

              game2048HighScore:
                highScore,

              updatedAt:
                now,
            };

            if (
  rewardTier
    .rewardPaise >
  0
) {

  await creditReferralGameReward(
    tx,
    {
      referredUserId:
        uid,

      referredByUserId:
        userData
          .referredByUserId,

      referredByReferralId:
        userData
          .referredByReferralId,

      source:
        "2048",

      eventId:
        runFingerprint,

      now,
    },
  );
}


            /*
             * Existing GenZGames
             * wallet/account document.
             */
            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            /*
             * Existing daily diamond
             * leaderboard document.
             */
            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            /*
             * One transaction record
             * prevents this verified
             * run being paid twice.
             */
            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_2048",

                type:
                  "run_completion",

                runId,

                runFingerprint,

                seed:
                  seed >>>
                  0,

                moveCount:
                  moves.length,

                elapsedSeconds,

                highestTile:
                  replay
                    .highestTile,

                score:
                  replay
                    .score,

                amountPaise:
                  rewardTier
                    .rewardPaise,

                currency:
                  CURRENCY,

                diamonds:
                  rewardTier
                    .diamonds,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                rewardTier
                  .rewardPaise >
                0,

              rewardPaise:
                rewardTier
                  .rewardPaise,

              diamondsGranted:
                rewardTier
                  .diamonds,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              account:
                next,

              completedRuns,

              bestTile,

              highScore,

              replayHighestTile:
                replay
                  .highestTile,

              replayScore:
                replay
                  .score,
            };
          },
        );


      return {
        success:
          true,

        runId,

        rewardGranted:
          result
            .rewardGranted,

        rewardPaise:
          result
            .rewardPaise,

        diamondsGranted:
          result
            .diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result
            .todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        highestTile:
          result
            .replayHighestTile,

        score:
          result
            .replayScore,

        completedRuns:
          result
            .completedRuns,

        bestTile:
          result
            .bestTile,

        highScore:
          result
            .highScore,
      };
    },
  );

export const completeGenZSnakeRun =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {

        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Snake runs.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const seed =
        Number(
          request.data
            ?.seed,
        );


      const level =
        Number(
          request.data
            ?.level,
        );


      const tickCount =
        Number(
          request.data
            ?.tickCount,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      if (
        !/^[A-Za-z0-9-]{12,80}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          seed,
        ) ||
        seed <
          0 ||
        seed >
          4294967295 ||
        !Number.isInteger(
          level,
        ) ||
        level <
          1 ||
        level >
          SNAKE_MAX_LEVEL ||
        !Number.isInteger(
          tickCount,
        ) ||
        tickCount <
          1 ||
        tickCount >
          GENZ_SNAKE_MAX_REPLAY_TICKS ||
        elapsedSeconds <
          1
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Snake run data.",
        );
      }


      const directionEvents =
        normalizeGenZSnakeDirectionEvents(
          request.data
            ?.directionEvents,

          tickCount,
        );


      if (
        !directionEvents
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Snake direction history.",
        );
      }


      /*
       * Rebuild the entire Snake run
       * on the backend.
       *
       * Client score/progress is NEVER
       * used for rewards.
       */
      let replay;


      try {

        replay =
          replayGenZSnakeRun({
            seed:
              seed >>>
              0,

            level,

            tickCount,

            directionEvents,
          });

      } catch (
        error
      ) {

        console.error(
          "Unable to replay GenZSnake run:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Snake run.",
        );
      }


      /*
       * The exact final submitted tick
       * must be the tick where 50%
       * was genuinely reached.
       */
      if (
        !replay.completed ||
        replay.gameOver ||
        replay.completionTick ===
          null ||
        replay.completionTick !==
          tickCount ||
        replay.growthPercent <
          50
      ) {

        throw new HttpsError(
          "failed-precondition",
          "Reach 50% growth in a valid Snake run before claiming the reward.",
        );
      }


      /*
       * Duplicate protection.
       *
       * We intentionally fingerprint
       * seed + level, NOT the raw
       * direction-event array.
       *
       * Otherwise someone could add an
       * ignored/redundant direction event
       * and make the same run appear new.
       *
       * Every legitimate new run already
       * receives a new random seed.
       */
      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "snake",
              String(
                seed >>>
                0,
              ),
              String(
                level,
              ),
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_snake_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      /*
       * Same approach already used by
       * existing earning games.
       *
       * Needed for daily leaderboard
       * name/photo and referral data.
       */
      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const highestUnlockedLevel =
              Math.min(
                SNAKE_MAX_LEVEL,

                Math.max(
                  1,

                  safeInt(
                    account
                      .snakeHighestUnlockedLevel,
                  ) ||
                    1,
                ),
              );


            /*
             * User can replay any
             * previously unlocked level,
             * but cannot skip forward.
             */
            if (
              level >
              highestUnlockedLevel
            ) {

              throw new HttpsError(
                "failed-precondition",
                "Complete Snake levels in order.",
              );
            }


            /*
             * Same seed + level was already
             * verified and paid.
             */
            if (
              transactionSnapshot
                .exists
            ) {

              const previous =
                transactionSnapshot
                  .data() ??
                {};


              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completedRuns:
                  safeInt(
                    account
                      .snakeCompletedRuns,
                  ),

                highestUnlockedLevel,

                bestScore:
                  safeInt(
                    account
                      .snakeBestScore,
                  ),

                bestLevel:
                  Math.max(
                    1,

                    safeInt(
                      account
                        .snakeBestLevel,
                    ) ||
                      1,
                  ),

                replayScore:
                  safeInt(
                    previous
                      .score,
                  ) ||
                  replay.score,

                replayGrowthPercent:
                  safeInt(
                    previous
                      .growthPercent,
                  ) ||
                  replay
                    .growthPercent,
              };
            }


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},

                {
                  uid,

                  dayKey,

                  amount:
                    SNAKE_DIAMOND_REWARD,

                  source:
                    "snake",

                  userData,

                  now,
                },
              );


            const completedRuns =
              safeInt(
                account
                  .snakeCompletedRuns,
              ) +
              1;


            const bestScore =
              Math.max(
                safeInt(
                  account
                    .snakeBestScore,
                ),

                replay.score,
              );


            const bestLevel =
              Math.max(
                1,

                Math.min(
                  SNAKE_MAX_LEVEL,

                  Math.max(
                    safeInt(
                      account
                        .snakeBestLevel,
                    ) ||
                      1,

                    level,
                  ),
                ),
              );


            /*
             * Completing the current
             * highest level unlocks
             * exactly the next one.
             *
             * Replaying an older level
             * does not change progression.
             */
            const nextHighestUnlockedLevel =
              level ===
                highestUnlockedLevel &&
              level <
                SNAKE_MAX_LEVEL
                ? level +
                  1
                : highestUnlockedLevel;


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              SNAKE_DIAMOND_REWARD;


            const dailyStreak =
              applyDailyStreakLevelCompletion(
                account,
                dayKey,
                now,
                1,
              );


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                SNAKE_REWARD_PAISE +
                dailyStreak.walletCreditPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                SNAKE_REWARD_PAISE +
                dailyStreak.walletCreditPaise,

              lifetimeDiamonds,

              ...getDailyStreakAccountUpdate(
                dailyStreak,
              ),

              snakeCompletedRuns:
                completedRuns,

              snakeHighestUnlockedLevel:
                nextHighestUnlockedLevel,

              snakeBestScore:
                bestScore,

              snakeBestLevel:
                bestLevel,

              updatedAt:
                now,
            };


            /*
             * Referrer receives ₹0.01
             * for this verified earning
             * event when applicable.
             */
            await creditReferralGameReward(
              tx,
              {
                referredUserId:
                  uid,

                referredByUserId:
                  userData
                    .referredByUserId,

                referredByReferralId:
                  userData
                    .referredByReferralId,

                source:
                  "snake",

                eventId:
                  runFingerprint,

                now,
              },
            );


            /*
             * Wallet + Snake progression.
             */
            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            /*
             * Same daily leaderboard
             * document already used by
             * the other games.
             */
            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            /*
             * One lightweight audit /
             * duplicate-protection record.
             */
            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_snake",

                type:
                  "run_completion",

                runId,

                runFingerprint,

                seed:
                  seed >>>
                  0,

                level,

                tickCount,

                directionEventCount:
                  directionEvents.length,

                elapsedSeconds,

                score:
                  replay.score,

                growthPercent:
                  replay
                    .growthPercent,

                foodCount:
                  replay
                    .foodCount,

                snakeLength:
                  replay
                    .snakeLength,

                amountPaise:
                  SNAKE_REWARD_PAISE,

                currency:
                  CURRENCY,

                diamonds:
                  SNAKE_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                true,

              rewardPaise:
                SNAKE_REWARD_PAISE,

              diamondsGranted:
                SNAKE_DIAMOND_REWARD,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              account:
                next,

              completedRuns,

              highestUnlockedLevel:
                nextHighestUnlockedLevel,

              bestScore,

              bestLevel,

              replayScore:
                replay.score,

              replayGrowthPercent:
                replay
                  .growthPercent,
            };
          },
        );


      return {
        success:
          true,

        runId,

        level,

        rewardGranted:
          result
            .rewardGranted,

        rewardPaise:
          result
            .rewardPaise,

        diamondsGranted:
          result
            .diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result
            .todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        score:
          result
            .replayScore,

        growthPercent:
          result
            .replayGrowthPercent,

        completedRuns:
          result
            .completedRuns,

        highestUnlockedLevel:
          result
            .highestUnlockedLevel,

        bestScore:
          result
            .bestScore,

        bestLevel:
          result
            .bestLevel,
      };
    },
  );

export const completeFlappyRocketRun =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {

        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Flappy Rocket runs.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const seed =
        Number(
          request.data
            ?.seed,
        );


      const tickCount =
        Number(
          request.data
            ?.tickCount,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      const rawReviveTick =
        request.data
          ?.reviveTick;


      const reviveTick =
        rawReviveTick ===
          null ||
        rawReviveTick ===
          undefined
          ? null
          : Number(
              rawReviveTick,
            );


      if (
        !/^[A-Za-z0-9-]{12,80}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          seed,
        ) ||
        seed <
          0 ||
        seed >
          4294967295 ||
        !Number.isInteger(
          tickCount,
        ) ||
        tickCount <
          1 ||
        tickCount >
          GENZ_FLAPPY_MAX_REPLAY_TICKS ||
        (
          reviveTick !==
            null &&
          (
            !Number.isInteger(
              reviveTick,
            ) ||
            reviveTick <
              1 ||
            reviveTick >
              tickCount
          )
        ) ||
        elapsedSeconds <
          1
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Flappy Rocket run data.",
        );
      }


      const flapEvents =
        normalizeGenZFlappyRocketFlapEvents(
          request.data
            ?.flapEvents,

          tickCount,
        );


      if (
        !flapEvents
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Flappy Rocket flap history.",
        );
      }


      /*
       * Rebuild the entire run on the backend.
       *
       * Client score is NEVER trusted.
       */
      let replay;


      try {

        replay =
          replayGenZFlappyRocketRun({
            seed:
              seed >>>
              0,

            tickCount,

            flapEvents,

            reviveTick,
          });

      } catch (
        error
      ) {

        console.error(
          "Unable to replay Flappy Rocket run:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Flappy Rocket run.",
        );
      }


      /*
       * Submitted tick must be the exact
       * first score-50 milestone tick.
       *
       * A collision on the SAME tick as
       * reaching 50 does not cancel the reward.
       */
      if (
        !replay
          .rewardMilestoneReached ||
        replay
          .rewardMilestoneTick ===
          null ||
        replay
          .rewardMilestoneTick !==
          tickCount ||
        replay.score <
          GENZ_FLAPPY_REWARD_SCORE
      ) {

        throw new HttpsError(
          "failed-precondition",
          `Reach ${GENZ_FLAPPY_REWARD_SCORE} points in a valid Flappy Rocket run before claiming the reward.`,
        );
      }


      /*
       * A seed identifies one legitimate run.
       *
       * Changing flap history cannot turn the
       * same seed into another payable run.
       */
      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "flappy_rocket",
              String(
                seed >>>
                0,
              ),
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_flappy_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            /*
             * Same run already verified.
             *
             * Return safely without paying twice.
             */
            if (
              transactionSnapshot
                .exists
            ) {

              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completedRuns:
                  safeInt(
                    account
                      .flappyRocketCompletedRuns,
                  ),

                replayScore:
                  replay.score,
              };
            }


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},

                {
                  uid,

                  dayKey,

                  amount:
                    FLAPPY_ROCKET_DIAMOND_REWARD,

                  source:
                    "flappyRocket",

                  userData,

                  now,
                },
              );


            const completedRuns =
              safeInt(
                account
                  .flappyRocketCompletedRuns,
              ) +
              1;


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              FLAPPY_ROCKET_DIAMOND_REWARD;


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                FLAPPY_ROCKET_REWARD_PAISE,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                FLAPPY_ROCKET_REWARD_PAISE,

              lifetimeDiamonds,

              flappyRocketCompletedRuns:
                completedRuns,

              updatedAt:
                now,
            };


            /*
             * Referral reward:
             *
             * Referrer receives ₹0.01 for this
             * verified earning event.
             */
            await creditReferralGameReward(
              tx,
              {
                referredUserId:
                  uid,

                referredByUserId:
                  userData
                    .referredByUserId,

                referredByReferralId:
                  userData
                    .referredByReferralId,

                source:
                  "flappyRocket",

                eventId:
                  runFingerprint,

                now,
              },
            );


            /*
             * Wallet + Flappy progression.
             */
            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            /*
             * Daily diamonds.
             */
            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            /*
             * Duplicate-protection /
             * earning audit document.
             */
            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_flappy_rocket",

                type:
                  "reward_milestone",

                runId,

                runFingerprint,

                seed:
                  seed >>>
                  0,

                tickCount,

                flapEventCount:
                  flapEvents.length,

                reviveUsed:
                  replay.reviveUsed,

                reviveTick,

                elapsedSeconds,

                score:
                  replay.score,

                amountPaise:
                  FLAPPY_ROCKET_REWARD_PAISE,

                currency:
                  CURRENCY,

                diamonds:
                  FLAPPY_ROCKET_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                true,

              rewardPaise:
                FLAPPY_ROCKET_REWARD_PAISE,

              diamondsGranted:
                FLAPPY_ROCKET_DIAMOND_REWARD,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              account:
                next,

              completedRuns,

              replayScore:
                replay.score,
            };
          },
        );


      return {
        success:
          true,

        runId,

        rewardGranted:
          result
            .rewardGranted,

        rewardPaise:
          result
            .rewardPaise,

        diamondsGranted:
          result
            .diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result
            .todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        score:
          result
            .replayScore,

        completedRuns:
          result
            .completedRuns,

        reviveUsed:
          replay.reviveUsed,
      };
    },
  );

export const completeKnifeHitRun =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Knife Hit runs.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const seed =
        Number(
          request.data
            ?.seed,
        );


      const batchStartLevel =
        Number(
          request.data
            ?.batchStartLevel,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      const endReason =
        normalizeGenZKnifeHitEndReason(
          request.data
            ?.endReason,
        );


      if (
        !/^[A-Za-z0-9_-]{12,100}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          seed,
        ) ||
        seed <
          0 ||
        seed >
          4294967295 ||
        !Number.isInteger(
          batchStartLevel,
        ) ||
        batchStartLevel <
          1 ||
        (
          batchStartLevel -
          1
        ) %
          KNIFE_HIT_LEVELS_PER_BATCH !==
          0 ||
        !endReason ||
        elapsedSeconds <
          1
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Knife Hit run data.",
        );
      }


      const attempts =
        normalizeGenZKnifeHitAttempts(
          request.data
            ?.attempts,

          batchStartLevel,
        );


      if (
        !attempts
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Knife Hit attempt history.",
        );
      }


      let replay;


      try {

        replay =
          replayKnifeHitRun({
            seed:
              seed >>>
              0,

            batchStartLevel,

            attempts,

            endReason,
          });

      } catch (
        error
      ) {

        console.error(
          "Unable to replay Knife Hit run:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Knife Hit run.",
        );
      }


      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "knife_hit",
              String(
                seed >>>
                0,
              ),
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_knife_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const highestUnlockedBatchStart =
              normalizeKnifeHitBatchStart(
                account
                  .knifeHitHighestUnlockedBatchStart,
              );


            if (
              batchStartLevel >
              highestUnlockedBatchStart
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Complete the previous Knife Hit batch before playing this one.",
              );
            }


            if (
              transactionSnapshot
                .exists
            ) {

              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completedRuns:
                  safeInt(
                    account
                      .knifeHitCompletedRuns,
                  ),

                bestScore:
                  safeInt(
                    account
                      .knifeHitBestScore,
                  ),

                highestLevelCleared:
                  safeInt(
                    account
                      .knifeHitHighestLevelCleared,
                  ),

                highestUnlockedBatchStart,
              };
            }


            const rewardPaise =
              safeInt(
                replay.rewardPaise,
              );


            const diamondsGranted =
              safeInt(
                replay.diamondsGranted,
              );


            const dailyData =
              diamondsGranted >
              0
                ? buildDailyDiamondPlayerData(
                    dailySnapshot.data() ??
                      {},

                    {
                      uid,

                      dayKey,

                      amount:
                        diamondsGranted,

                      source:
                        "knifeHit",

                      userData,

                      now,
                    },
                  )
                : (
                    dailySnapshot.data() ??
                    {}
                  );


            const completedRuns =
              safeInt(
                account
                  .knifeHitCompletedRuns,
              ) +
              1;


            const highestCompletedThisRun =
              replay.completedLevels.length >
              0
                ? Math.max(
                    ...replay.completedLevels,
                  )
                : 0;


            const highestLevelCleared =
              Math.max(
                safeInt(
                  account
                    .knifeHitHighestLevelCleared,
                ),

                highestCompletedThisRun,
              );


            const bestScore =
              Math.max(
                safeInt(
                  account
                    .knifeHitBestScore,
                ),

                safeInt(
                  replay.verifiedScore,
                ),
              );


            const nextHighestUnlockedBatchStart =
              replay.endReason ===
                "BATCH_COMPLETE" &&
              replay.nextBatchStartLevel !==
                null
                ? Math.max(
                    highestUnlockedBatchStart,
                    replay.nextBatchStartLevel,
                  )
                : highestUnlockedBatchStart;


            const lifetimeDiamonds =
              safeInt(
                account
                  .lifetimeDiamonds,
              ) +
              diamondsGranted;


            const dailyStreak =
              replay.completedLevels.length >
              0
                ? applyDailyStreakLevelCompletion(
                    account,
                    dayKey,
                    now,
                    replay.completedLevels.length,
                  )
                : getDailyStreakState(
                    account,
                    dayKey,
                    now,
                  );


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                rewardPaise +
                dailyStreak.walletCreditPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                rewardPaise +
                dailyStreak.walletCreditPaise,

              lifetimeDiamonds,

              ...getDailyStreakAccountUpdate(
                dailyStreak,
              ),

              knifeHitCompletedRuns:
                completedRuns,

              knifeHitBestScore:
                bestScore,

              knifeHitHighestLevelCleared:
                highestLevelCleared,

              knifeHitHighestUnlockedBatchStart:
                nextHighestUnlockedBatchStart,

              updatedAt:
                now,
            };


            if (
              rewardPaise >
              0
            ) {
              await creditReferralGameReward(
                tx,
                {
                  referredUserId:
                    uid,

                  referredByUserId:
                    userData
                      .referredByUserId,

                  referredByReferralId:
                    userData
                      .referredByReferralId,

                  source:
                    "knifeHit",

                  eventId:
                    runFingerprint,

                  now,
                },
              );
            }


            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            if (
              diamondsGranted >
              0
            ) {
              tx.set(
                dailyRef,
                dailyData,
                {
                  merge:
                    true,
                },
              );
            }


            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_knife_hit",

                type:
                  "batch_settlement",

                runId,

                runFingerprint,

                seed:
                  seed >>>
                  0,

                batchStartLevel,

                batchEndLevel:
                  replay.batchEndLevel,

                completedLevels:
                  replay.completedLevels,

                completedLevelCount:
                  replay.completedLevelCount,

                attemptCount:
                  replay.attempts.length,

                revivesUsed:
                  replay.revivesUsed,

                endReason:
                  replay.endReason,

                verifiedScore:
                  replay.verifiedScore,

                elapsedSeconds,

                amountPaise:
                  rewardPaise,

                currency:
                  CURRENCY,

                diamonds:
                  diamondsGranted,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                rewardPaise >
                  0 ||
                diamondsGranted >
                  0,

              rewardPaise,

              diamondsGranted,

              todayDiamonds:
                diamondsGranted >
                0
                  ? safeInt(
                      dailyData
                        .diamonds,
                    )
                  : safeInt(
                      dailySnapshot
                        .data()
                        ?.diamonds,
                    ),

              account:
                next,

              completedRuns,

              bestScore,

              highestLevelCleared,

              highestUnlockedBatchStart:
                nextHighestUnlockedBatchStart,
            };
          },
        );


      return {
        success:
          true,

        runId,

        rewardGranted:
          result
            .rewardGranted,

        rewardPaise:
          result
            .rewardPaise,

        diamondsGranted:
          result
            .diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result
            .todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        batchStartLevel:
          replay
            .batchStartLevel,

        batchEndLevel:
          replay
            .batchEndLevel,

        completedLevels:
          replay
            .completedLevels,

        completedLevelCount:
          replay
            .completedLevelCount,

        revivesUsed:
          replay
            .revivesUsed,

        endReason:
          replay
            .endReason,

        score:
          replay
            .verifiedScore,

        completedRuns:
          result
            .completedRuns,

        bestScore:
          result
            .bestScore,

        highestLevelCleared:
          result
            .highestLevelCleared,

        highestUnlockedBatchStart:
          result
            .highestUnlockedBatchStart,

        nextBatchStartLevel:
          replay
            .nextBatchStartLevel,
      };
    },
  );


/*
 * =========================================================
 * BRICK BREAKER - 50% REWARD
 * =========================================================
 */

export const claimBrickBreakerReward =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to claim Brick Breaker rewards.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const level =
        Number(
          request.data
            ?.level,
        );


      const milestoneTick =
        Number(
          request.data
            ?.milestoneTick,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      if (
        !/^[A-Za-z0-9_-]{12,120}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          level,
        ) ||
        level <
          1 ||
        level >
          GENZ_BRICK_BREAKER_MAX_LEVEL ||
        !Number.isInteger(
          milestoneTick,
        ) ||
        milestoneTick <
          1 ||
        milestoneTick >
          GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS ||
        elapsedSeconds <
          1
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Brick Breaker reward data.",
        );
      }


      const inputEvents =
        normalizeGenZBrickBreakerInputEvents(
          request.data
            ?.inputEvents,

          milestoneTick,
        );


      const reviveEvents =
        normalizeGenZBrickBreakerReviveEvents(
          request.data
            ?.reviveEvents,

          milestoneTick,
        );


      if (
        !inputEvents ||
        !reviveEvents
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Brick Breaker gameplay history.",
        );
      }


      let replay;


      try {

        replay =
          replayGenZBrickBreakerRun({
            level,

            tickCount:
              milestoneTick,

            inputEvents,

            reviveEvents,
          });

      } catch (
        error
      ) {

        console.error(
          "Unable to replay Brick Breaker reward run:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Brick Breaker reward.",
        );
      }


      /*
       * Submitted tick must be the EXACT first
       * deterministic 50% milestone tick.
       */
      if (
        replay.rewardMilestoneTick ===
          null ||
        replay.rewardMilestoneTick !==
          milestoneTick ||
        replay.destroyedBrickHp <
          replay.rewardTargetHp ||
        replay.progressPercent <
          50
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Reach 50% brick destruction in a valid Brick Breaker run before claiming the reward.",
        );
      }


      /*
       * One run ID = one payable reward.
       *
       * Replaying the same level later is allowed,
       * but it receives a NEW run ID after another
       * rewarded-ad start.
       */
      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "brick_breaker",
              runId,
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_brick_reward_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const highestUnlockedLevel =
              Math.min(
                GENZ_BRICK_BREAKER_MAX_LEVEL,

                Math.max(
                  1,

                  safeInt(
                    account
                      .brickBreakerHighestUnlockedLevel,
                  ) ||
                    1,
                ),
              );


            /*
             * Any previously unlocked level may
             * be replayed and rewarded again.
             */
            if (
              level >
              highestUnlockedLevel
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Complete the previous Brick Breaker level first.",
              );
            }


            /*
             * Same run was already rewarded.
             */
            if (
              transactionSnapshot.exists
            ) {

              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                rewardedRuns:
                  safeInt(
                    account
                      .brickBreakerRewardedRuns,
                  ),
              };
            }


            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},

                {
                  uid,

                  dayKey,

                  amount:
                    BRICK_BREAKER_DIAMOND_REWARD,

                  source:
                    "brickBreaker",

                  userData,

                  now,
                },
              );


            const rewardedRuns =
              safeInt(
                account
                  .brickBreakerRewardedRuns,
              ) +
              1;


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account.balancePaise,
                ) +
                BRICK_BREAKER_REWARD_PAISE,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                BRICK_BREAKER_REWARD_PAISE,

              lifetimeDiamonds:
                safeInt(
                  account
                    .lifetimeDiamonds,
                ) +
                BRICK_BREAKER_DIAMOND_REWARD,

              brickBreakerRewardedRuns:
                rewardedRuns,

              updatedAt:
                now,
            };


            /*
             * Same referral rule as the other
             * verified earning games.
             */
            await creditReferralGameReward(
              tx,
              {
                referredUserId:
                  uid,

                referredByUserId:
                  userData
                    .referredByUserId,

                referredByReferralId:
                  userData
                    .referredByReferralId,

                source:
                  "brickBreaker",

                eventId:
                  `${runFingerprint}:reward`,

                now,
              },
            );


            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            /*
             * Idempotent reward audit.
             */
            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_brick_breaker",

                type:
                  "reward_milestone",

                runId,

                runFingerprint,

                level,

                milestoneTick,

                inputEventCount:
                  inputEvents.length,

                reviveEventCount:
                  reviveEvents.length,

                revivesUsed:
                  replay.revivesUsed,

                elapsedSeconds,

                score:
                  replay.score,

                destroyedBrickHp:
                  replay.destroyedBrickHp,

                totalBrickHp:
                  replay.totalBrickHp,

                progressPercent:
                  replay.progressPercent,

                amountPaise:
                  BRICK_BREAKER_REWARD_PAISE,

                currency:
                  CURRENCY,

                diamonds:
                  BRICK_BREAKER_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                true,

              rewardPaise:
                BRICK_BREAKER_REWARD_PAISE,

              diamondsGranted:
                BRICK_BREAKER_DIAMOND_REWARD,

              todayDiamonds:
                safeInt(
                  dailyData.diamonds,
                ),

              account:
                next,

              rewardedRuns,
            };
          },
        );


      return {
        success:
          true,

        runId,

        level,

        rewardGranted:
          result.rewardGranted,

        rewardPaise:
          result.rewardPaise,

        diamondsGranted:
          result.diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result.todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        destroyedBrickHp:
          replay.destroyedBrickHp,

        totalBrickHp:
          replay.totalBrickHp,

        progressPercent:
          replay.progressPercent,

        rewardedRuns:
          result.rewardedRuns,
      };
    },
  );


/*
 * =========================================================
 * BRICK BREAKER - 100% LEVEL CLEAR
 * =========================================================
 */

export const completeBrickBreakerLevel =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Brick Breaker levels.",
        );
      }


      const uid =
        request.auth.uid;


      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const level =
        Number(
          request.data
            ?.level,
        );


      const tickCount =
        Number(
          request.data
            ?.tickCount,
        );


      const elapsedSeconds =
        Math.min(
          86400,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      if (
        !/^[A-Za-z0-9_-]{12,120}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          level,
        ) ||
        level <
          1 ||
        level >
          GENZ_BRICK_BREAKER_MAX_LEVEL ||
        !Number.isInteger(
          tickCount,
        ) ||
        tickCount <
          1 ||
        tickCount >
          GENZ_BRICK_BREAKER_MAX_REPLAY_TICKS ||
        elapsedSeconds <
          1
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Brick Breaker completion data.",
        );
      }


      const inputEvents =
        normalizeGenZBrickBreakerInputEvents(
          request.data
            ?.inputEvents,

          tickCount,
        );


      const reviveEvents =
        normalizeGenZBrickBreakerReviveEvents(
          request.data
            ?.reviveEvents,

          tickCount,
        );


      if (
        !inputEvents ||
        !reviveEvents
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid Brick Breaker gameplay history.",
        );
      }


      let replay;


      try {

        replay =
          replayGenZBrickBreakerRun({
            level,

            tickCount,

            inputEvents,

            reviveEvents,
          });

      } catch (
        error
      ) {

        console.error(
          "Unable to replay Brick Breaker level clear:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Brick Breaker level.",
        );
      }


      /*
       * Backend requires a genuine 100% clear.
       */
      if (
        !replay.levelCleared ||
        replay.destroyedBrickHp !==
          replay.totalBrickHp ||
        replay.progressPercent !==
          100
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Clear all bricks before completing this level.",
        );
      }


      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "brick_breaker",
              runId,
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      /*
       * Separate from the 50% reward document.
       *
       * Same run therefore has:
       *
       * reward transaction
       * +
       * level-clear transaction
       */
      const completionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_brick_clear_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const now =
        Timestamp.now();

            const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              completionSnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  completionRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            const highestUnlockedLevel =
              Math.min(
                GENZ_BRICK_BREAKER_MAX_LEVEL,

                Math.max(
                  1,

                  safeInt(
                    account
                      .brickBreakerHighestUnlockedLevel,
                  ) ||
                    1,
                ),
              );


            if (
              level >
              highestUnlockedLevel
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Complete Brick Breaker levels in order.",
              );
            }


            /*
             * Same run clear already verified.
             */
            if (
              completionSnapshot.exists
            ) {

              return {
                completedRuns:
                  safeInt(
                    account
                      .brickBreakerCompletedRuns,
                  ),

                bestScore:
                  safeInt(
                    account
                      .brickBreakerBestScore,
                  ),

                highestLevelCleared:
                  safeInt(
                    account
                      .brickBreakerHighestLevelCleared,
                  ),

                highestUnlockedLevel,

                nextUnlockedLevel:
                  null as number | null,
              };
            }


            const completedRuns =
              safeInt(
                account
                  .brickBreakerCompletedRuns,
              ) +
              1;


            const bestScore =
              Math.max(
                safeInt(
                  account
                    .brickBreakerBestScore,
                ),

                replay.score,
              );


            const highestLevelCleared =
              Math.max(
                safeInt(
                  account
                    .brickBreakerHighestLevelCleared,
                ),

                level,
              );


            /*
             * Replaying old levels remains valid,
             * but only clearing the current frontier
             * unlocks another level.
             */
            const nextUnlockedLevel =
              level ===
                  highestUnlockedLevel &&
              level <
                  GENZ_BRICK_BREAKER_MAX_LEVEL
                ? level +
                    1
                : null;


            const nextHighestUnlockedLevel =
              nextUnlockedLevel !==
                null
                ? Math.max(
                    highestUnlockedLevel,
                    nextUnlockedLevel,
                  )
                : highestUnlockedLevel;


            const dailyStreak =
              applyDailyStreakLevelCompletion(
                account,
                dayKey,
                now,
                1,
              );


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                dailyStreak.walletCreditPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                dailyStreak.walletCreditPaise,

              brickBreakerCompletedRuns:
                completedRuns,

              brickBreakerBestScore:
                bestScore,

              brickBreakerHighestLevelCleared:
                highestLevelCleared,

              brickBreakerHighestUnlockedLevel:
                nextHighestUnlockedLevel,

              ...getDailyStreakAccountUpdate(
                dailyStreak,
              ),

              updatedAt:
                now,
            };


            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            tx.set(
              completionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_brick_breaker",

                type:
                  "level_clear",

                runId,

                runFingerprint,

                level,

                tickCount,

                inputEventCount:
                  inputEvents.length,

                reviveEventCount:
                  reviveEvents.length,

                revivesUsed:
                  replay.revivesUsed,

                elapsedSeconds,

                score:
                  replay.score,

                destroyedBrickHp:
                  replay.destroyedBrickHp,

                totalBrickHp:
                  replay.totalBrickHp,

                progressPercent:
                  replay.progressPercent,

                nextUnlockedLevel,

                highestUnlockedLevel:
                  nextHighestUnlockedLevel,

                createdAt:
                  now,
              },
            );


            return {
              completedRuns,

              bestScore,

              highestLevelCleared,

              highestUnlockedLevel:
                nextHighestUnlockedLevel,

              nextUnlockedLevel,
            };
          },
        );


      return {
        success:
          true,

        runId,

        level,

        levelClearVerified:
          true,

        score:
          replay.score,

        completedRuns:
          result.completedRuns,

        bestScore:
          result.bestScore,

        highestLevelCleared:
          result.highestLevelCleared,

        highestUnlockedLevel:
          result.highestUnlockedLevel,

        nextUnlockedLevel:
          result.nextUnlockedLevel,
      };
    },
  );


/*
 * =========================================================
 * CANDY CASCADE - VERIFIED LEVEL COMPLETION + REWARD
 * =========================================================
 *
 * One successful verified run:
 *
 * ₹0.05
 * +
 * 10 diamonds
 *
 * The backend independently rebuilds:
 *
 * level
 * + seed
 * + SWAP / CONTINUE events
 *
 * Client-reported score, stars, board state and objective
 * completion are never trusted.
 */

export const completeCandyCascadeRun =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      /*
       * =====================================================
       * AUTH
       * =====================================================
       */

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in to complete Candy Cascade levels.",
        );
      }


      const uid =
        request.auth.uid;


      /*
       * =====================================================
       * REQUEST NORMALIZATION
       * =====================================================
       */

      const runId =
        typeof request.data
          ?.runId ===
        "string"
          ? request.data
              .runId
              .trim()
          : "";


      const level =
        Number(
          request.data
            ?.level,
        );


      const seed =
        Number(
          request.data
            ?.seed,
        );


      const elapsedSeconds =
        Math.min(
          GENZ_CANDY_CASCADE_MAX_ELAPSED_SECONDS,

          safeInt(
            request.data
              ?.elapsedSeconds,
          ),
        );


      /*
       * =====================================================
       * BASIC VALIDATION
       * =====================================================
       */

      if (
        !/^[A-Za-z0-9_-]{12,120}$/
          .test(
            runId,
          ) ||
        !Number.isInteger(
          level,
        ) ||
        level <
          1 ||
        level >
          GENZ_CANDY_CASCADE_MAX_LEVEL ||
        !Number.isInteger(
          seed,
        ) ||
        seed <
          1 ||
        seed >
          0xffffffff ||
        elapsedSeconds <
          1
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Candy Cascade completion data.",
        );
      }


      /*
       * =====================================================
       * EVENT SANITIZATION
       * =====================================================
       */

      const events =
        normalizeGenZCandyCascadeEvents(
          request.data
            ?.events,
        );


      if (
        !events
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Invalid Candy Cascade gameplay history.",
        );
      }


      /*
       * =====================================================
       * SERVER DETERMINISTIC REPLAY
       * =====================================================
       */

      let replay;


      try {

        replay =
          replayGenZCandyCascadeRun(
            level,
            seed,
            events,
          );

      } catch (
        error
      ) {

        console.error(
          "Unable to replay Candy Cascade run:",
          error,
        );


        throw new HttpsError(
          "failed-precondition",
          "Unable to verify this Candy Cascade run.",
        );
      }


      /*
       * Replay must be structurally valid.
       */
      if (
        !replay.valid
      ) {

        console.warn(
          "Candy Cascade replay rejected:",
          {
            uid,

            runId,

            level,

            invalidEventIndex:
              replay
                .invalidEventIndex,

            reason:
              replay.reason,
          },
        );


        throw new HttpsError(
          "failed-precondition",
          replay.reason ??
            "Invalid Candy Cascade gameplay history.",
        );
      }


      /*
       * Backend requires a genuine objective completion.
       */
      if (
        !isGenZCandyCascadeCompletedReplay(
          replay,
        )
      ) {

        throw new HttpsError(
          "failed-precondition",
          "Complete all Candy Cascade objectives before claiming the reward.",
        );
      }


      const finalState =
        replay.state;


      const stars =
        getGenZCandyCascadeStarCount(
          level,
          finalState.score,
        );


      /*
       * =====================================================
       * RUN FINGERPRINT
       * =====================================================
       *
       * One run ID may settle only once.
       *
       * A replay after a new rewarded-ad start receives
       * another locally-created run ID and seed.
       */

      const runFingerprint =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            [
              uid,
              "candy_cascade",
              runId,
            ].join(
              "|",
            ),
          )
          .digest(
            "hex",
          );


      /*
       * =====================================================
       * FIRESTORE REFERENCES
       * =====================================================
       */

      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const transactionRef =
        db
          .collection(
            "genzGameTransactions",
          )
          .doc(
            `${uid}_candy_${runFingerprint.slice(
              0,
              40,
            )}`,
          );


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const now =
        Timestamp.now();


      const dayKey =
        getIstDayKey(
          now.toDate(),
        );


      const dailyRef =
        getDailyDiamondPlayerRef(
          dayKey,
          uid,
        );


      /*
       * =====================================================
       * SINGLE SETTLEMENT TRANSACTION
       * =====================================================
       */

      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            /*
             * IMPORTANT:
             *
             * Complete normal transaction reads before
             * creditReferralGameReward(), because that helper
             * performs its own transaction read.
             */

            const [
              accountSnapshot,
              transactionSnapshot,
              dailySnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  transactionRef,
                ),

                tx.get(
                  dailyRef,
                ),
              ]);


            const account =
              accountSnapshot.exists
                ? (
                    accountSnapshot
                      .data() ??
                    {}
                  )
                : accountDefaults(
                    uid,
                  );


            /*
             * =================================================
             * CURRENT UNLOCKED FRONTIER
             * =================================================
             */

            const highestUnlockedLevel =
              Math.min(
                GENZ_CANDY_CASCADE_MAX_LEVEL,

                Math.max(
                  1,

                  safeInt(
                    account
                      .candyCascadeHighestUnlockedLevel,
                  ) ||
                    1,
                ),
              );


            /*
             * Previously unlocked levels may be replayed.
             *
             * Locked future levels may not be submitted.
             */
            if (
              level >
              highestUnlockedLevel
            ) {

              throw new HttpsError(
                "failed-precondition",
                "Complete the previous Candy Cascade level first.",
              );
            }


            /*
             * =================================================
             * EXISTING STAR MAP
             * =================================================
             */

            const previousLevelStars =
              normalizeCandyCascadeLevelStars(
                account
                  .candyCascadeLevelStars,
              );


            /*
             * =================================================
             * DUPLICATE SETTLEMENT
             * =================================================
             *
             * Return safely.
             *
             * No second cash reward.
             * No second diamond reward.
             */

            if (
              transactionSnapshot.exists
            ) {

              const previous =
                transactionSnapshot
                  .data() ??
                {};


              return {
                rewardGranted:
                  false,

                rewardPaise:
                  0,

                diamondsGranted:
                  0,

                todayDiamonds:
                  safeInt(
                    dailySnapshot
                      .data()
                      ?.diamonds,
                  ),

                account,

                completedRuns:
                  safeInt(
                    account
                      .candyCascadeCompletedRuns,
                  ),

                bestScore:
                  safeInt(
                    account
                      .candyCascadeBestScore,
                  ),

                highestLevelCleared:
                  Math.min(
                    GENZ_CANDY_CASCADE_MAX_LEVEL,

                    safeInt(
                      account
                        .candyCascadeHighestLevelCleared,
                    ),
                  ),

                highestUnlockedLevel,

                nextUnlockedLevel:
                  null as
                    number |
                    null,

                stars:
                  Math.min(
                    3,

                    safeInt(
                      previous.stars,
                    ),
                  ),

                levelStars:
                  previousLevelStars,

                totalStars:
                  getCandyCascadeTotalStars(
                    previousLevelStars,
                  ),
              };
            }


            /*
             * =================================================
             * STAR PROGRESSION
             * =================================================
             *
             * Replay can improve stars.
             *
             * A worse replay never lowers an existing result.
             */

            const previousStars =
              safeInt(
                previousLevelStars[
                  String(
                    level,
                  )
                ],
              );


            const bestLevelStars =
              Math.min(
                3,

                Math.max(
                  previousStars,
                  stars,
                ),
              );


            const nextLevelStars = {
              ...previousLevelStars,

              [String(
                level,
              )]:
                bestLevelStars,
            };


            const totalStars =
              getCandyCascadeTotalStars(
                nextLevelStars,
              );


            /*
             * =================================================
             * LEVEL PROGRESSION
             * =================================================
             */

            const completedRuns =
              safeInt(
                account
                  .candyCascadeCompletedRuns,
              ) +
              1;


            const bestScore =
              Math.max(
                safeInt(
                  account
                    .candyCascadeBestScore,
                ),

                finalState.score,
              );


            const highestLevelCleared =
              Math.min(
                GENZ_CANDY_CASCADE_MAX_LEVEL,

                Math.max(
                  safeInt(
                    account
                      .candyCascadeHighestLevelCleared,
                  ),

                  level,
                ),
              );


            /*
             * Only clearing the current frontier unlocks
             * another level.
             *
             * Replaying an old level changes no frontier.
             */
            const nextUnlockedLevel =
              level ===
                  highestUnlockedLevel &&
              level <
                  GENZ_CANDY_CASCADE_MAX_LEVEL
                ? level +
                    1
                : null;


            const nextHighestUnlockedLevel =
              nextUnlockedLevel !==
                null
                ? Math.max(
                    highestUnlockedLevel,
                    nextUnlockedLevel,
                  )
                : highestUnlockedLevel;


            /*
             * =================================================
             * DAILY DIAMONDS
             * =================================================
             */

            const dailyData =
              buildDailyDiamondPlayerData(
                dailySnapshot.data() ??
                  {},

                {
                  uid,

                  dayKey,

                  amount:
                    GENZ_CANDY_CASCADE_DIAMOND_REWARD,

                  source:
                    "candyCascade",

                  userData,

                  now,
                },
              );


            /*
             * =================================================
             * ACCOUNT UPDATE
             * =================================================
             */

            const dailyStreak =
              applyDailyStreakLevelCompletion(
                account,
                dayKey,
                now,
                1,
              );


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account
                    .balancePaise,
                ) +
                GENZ_CANDY_CASCADE_REWARD_PAISE +
                dailyStreak.walletCreditPaise,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                GENZ_CANDY_CASCADE_REWARD_PAISE +
                dailyStreak.walletCreditPaise,

              lifetimeDiamonds:
                safeInt(
                  account
                    .lifetimeDiamonds,
                ) +
                GENZ_CANDY_CASCADE_DIAMOND_REWARD,

              ...getDailyStreakAccountUpdate(
                dailyStreak,
              ),

              candyCascadeCompletedRuns:
                completedRuns,

              candyCascadeBestScore:
                bestScore,

              candyCascadeHighestLevelCleared:
                highestLevelCleared,

              candyCascadeHighestUnlockedLevel:
                nextHighestUnlockedLevel,

              candyCascadeLevelStars:
                nextLevelStars,

              updatedAt:
                now,
            };


            /*
             * =================================================
             * REFERRAL CASH REWARD
             * =================================================
             *
             * Same ₹0.01 referral earning rule used by the
             * other verified GenZGames earning events.
             */

            await creditReferralGameReward(
              tx,
              {
                referredUserId:
                  uid,

                referredByUserId:
                  userData
                    .referredByUserId,

                referredByReferralId:
                  userData
                    .referredByReferralId,

                source:
                  "candyCascade",

                eventId:
                  `${runFingerprint}:complete`,

                now,
              },
            );


            /*
             * =================================================
             * WRITES
             * =================================================
             */

            tx.set(
              accountRef,
              next,
              {
                merge:
                  true,
              },
            );


            tx.set(
              dailyRef,
              dailyData,
              {
                merge:
                  true,
              },
            );


            /*
             * Idempotent settlement/audit record.
             */
            tx.set(
              transactionRef,
              {
                userId:
                  uid,

                gameId:
                  "genz_candy_cascade",

                type:
                  "level_complete_reward",

                runId,

                runFingerprint,

                level,

                seed,

                elapsedSeconds,

                eventCount:
                  events.length,

                swapEventCount:
                  events.filter(
                    event =>
                      event.type ===
                      "SWAP",
                  ).length,

                continueUsed:
                  finalState
                    .extraMovesUsed,

                extraMovesGranted:
                  finalState
                    .extraMovesGranted,

                movesUsed:
                  finalState
                    .movesUsed,

                movesRemaining:
                  finalState
                    .movesRemaining,

                score:
                  finalState
                    .score,

                stars,

                bestLevelStars,

                cascadeBest:
                  finalState
                    .bestCascade,

                shuffleCount:
                  finalState
                    .shuffleCount,

                amountPaise:
                  GENZ_CANDY_CASCADE_REWARD_PAISE,

                currency:
                  CURRENCY,

                diamonds:
                  GENZ_CANDY_CASCADE_DIAMOND_REWARD,

                diamondDayKey:
                  dayKey,

                nextUnlockedLevel,

                highestUnlockedLevel:
                  nextHighestUnlockedLevel,

                createdAt:
                  now,
              },
            );


            return {
              rewardGranted:
                true,

              rewardPaise:
                GENZ_CANDY_CASCADE_REWARD_PAISE,

              diamondsGranted:
                GENZ_CANDY_CASCADE_DIAMOND_REWARD,

              todayDiamonds:
                safeInt(
                  dailyData
                    .diamonds,
                ),

              account:
                next,

              completedRuns,

              bestScore,

              highestLevelCleared,

              highestUnlockedLevel:
                nextHighestUnlockedLevel,

              nextUnlockedLevel,

              stars,

              levelStars:
                nextLevelStars,

              totalStars,
            };
          },
        );


      /*
       * =====================================================
       * CALLABLE RESPONSE
       * =====================================================
       */

      return {
        success:
          true,

        runId,

        level,

        levelClearVerified:
          true,

        rewardGranted:
          result.rewardGranted,

        rewardPaise:
          result.rewardPaise,

        diamondsGranted:
          result.diamondsGranted,

        diamondDayKey:
          dayKey,

        todayDiamonds:
          result.todayDiamonds,

        lifetimeDiamonds:
          safeInt(
            result
              .account
              .lifetimeDiamonds,
          ),

        balancePaise:
          safeInt(
            result
              .account
              .balancePaise,
          ),

        lifetimeEarningsPaise:
          safeInt(
            result
              .account
              .lifetimeEarningsPaise,
          ),

        score:
          finalState
            .score,

        movesUsed:
          finalState
            .movesUsed,

        stars:
          result.stars,

        completedRuns:
          result.completedRuns,

        bestScore:
          result.bestScore,

        highestLevelCleared:
          result.highestLevelCleared,

        highestUnlockedLevel:
          result.highestUnlockedLevel,

        nextUnlockedLevel:
          result.nextUnlockedLevel,

        totalStars:
          result.totalStars,

        levelStars:
          result.levelStars,
      };
    },
  );


export const unlockGenZSudokuLevel = onCall({ invoker:"public", cors:true }, async (request) => {
  if(!request.auth) throw new HttpsError("unauthenticated","Sign in to unlock Sudoku levels."); const uid=request.auth.uid; const level=Number(request.data?.level); if(!Number.isInteger(level)||level<2||level>SUDOKU_TOTAL_LEVELS)throw new HttpsError("invalid-argument","Invalid Sudoku level."); const ref=db.collection("genzGameAccounts").doc(uid); const now=Timestamp.now();
  const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref); const account=snap.exists?(snap.data()??{}):accountDefaults(uid); const highest=Math.max(1,safeInt(account.sudokuHighestUnlockedLevel)||1); if(level<=highest)return {already:true,highest}; if(level!==highest+1)throw new HttpsError("failed-precondition","Unlock levels in order."); const completed=normalizeCompleted(account.sudokuCompletedLevelNumbers); if(!completed.includes(level-1))throw new HttpsError("failed-precondition","Complete the previous level first."); tx.set(ref,{...account,sudokuHighestUnlockedLevel:level,updatedAt:now},{merge:true}); tx.set(ref.collection("sudokuLevels").doc(String(level)),{level,unlocked:true,unlockedWithRewardedAd:true,unlockedAt:now,updatedAt:now},{merge:true}); return {already:false,highest:level};}); return {success:true,level,alreadyUnlocked:result.already,highestUnlockedLevel:result.highest};
});



export const saveGenZGamesUpiId =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      secrets: [
        PAYOUT_ENCRYPTION_KEY,
      ],
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before saving payout details.",
        );
      }


      const uid =
        request.auth.uid;


      const upi =
        normalizeUpi(
          request.data
            ?.upiId,
        );


      if (
        !upi
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid UPI ID.",
        );
      }


      const whatsappNumber =
        normalizePhoneNumber(
          request.data
            ?.whatsappNumber,
        );


      if (
        !whatsappNumber
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid WhatsApp number including country code.",
        );
      }


      const hash =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            upi,
          )
          .digest(
            "hex",
          );


      const payoutRef =
        db
          .collection(
            "genzGamePayoutProfiles",
          )
          .doc(
            uid,
          );


      const claimRef =
        db
          .collection(
            "genzGameUpiClaims",
          )
          .doc(
            hash,
          );


      const encryptedUpi =
        encrypt(
          upi,
        );


      const encryptedWhatsApp =
        encrypt(
          whatsappNumber,
        );


      const maskedUpi =
        maskUpi(
          upi,
        );


      const maskedWhatsApp =
        maskWhatsAppNumber(
          whatsappNumber,
        );


      const now =
        Timestamp.now();


      await db.runTransaction(
        async (
          tx,
        ) => {

          const [
            payoutSnap,
            claimSnap,
          ] =
            await Promise.all([
              tx.get(
                payoutRef,
              ),

              tx.get(
                claimRef,
              ),
            ]);


          if (
            claimSnap.exists &&
            claimSnap
              .data()
              ?.userId !==
              uid
          ) {
            throw new HttpsError(
              "already-exists",
              "This UPI ID is already linked to another GenZGames account.",
            );
          }


          const oldHash =
            String(
              payoutSnap
                .data()
                ?.upiHash ??
              "",
            );


          if (
            oldHash &&
            oldHash !==
              hash
          ) {
            tx.delete(
              db
                .collection(
                  "genzGameUpiClaims",
                )
                .doc(
                  oldHash,
                ),
            );
          }


          tx.set(
            claimRef,
            {
              userId:
                uid,

              upiHash:
                hash,

              createdAt:
                claimSnap.exists
                  ? claimSnap
                      .data()
                      ?.createdAt ??
                    now
                  : now,

              updatedAt:
                now,
            },
          );


          tx.set(
            payoutRef,
            {
              userId:
                uid,

              upiIdMasked:
                maskedUpi,

              upiHash:
                hash,

              ...encryptedUpi,

              whatsappNumberMasked:
                maskedWhatsApp,

              whatsappCiphertext:
                encryptedWhatsApp
                  .ciphertext,

              whatsappIv:
                encryptedWhatsApp
                  .iv,

              whatsappAuthTag:
                encryptedWhatsApp
                  .authTag,

              whatsappAlgorithm:
                encryptedWhatsApp
                  .algorithm,

              updatedAt:
                now,

              createdAt:
                payoutSnap.exists
                  ? payoutSnap
                      .data()
                      ?.createdAt ??
                    now
                  : now,
            },
            {
              merge:
                true,
            },
          );
        },
      );


      return {
        success:
          true,

        upiIdMasked:
          maskedUpi,

        whatsappNumberMasked:
          maskedWhatsApp,
      };
    },
  );

export const requestGenZGamesRedemption =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before redeeming.",
        );
      }


      const uid =
        request.auth.uid;

      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );

      const payoutRef =
        db
          .collection(
            "genzGamePayoutProfiles",
          )
          .doc(
            uid,
          );

      const redemptionRef =
        db
          .collection(
            "genzGameRedemptions",
          )
          .doc();

      const userSnap =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();

      const userData =
        userSnap.data() ??
        {};

      const userName =
        String(
          userData.displayName ??
          "Player",
        );

      const now =
        Timestamp.now();


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const [
              accountSnapshot,
              payoutSnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  payoutRef,
                ),
              ]);


            if (
              !accountSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Game wallet not found.",
              );
            }


                        if (
              !payoutSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Add your payout details before redeeming.",
              );
            }


            const payoutData =
              payoutSnapshot.data() ??
              {};


            const payoutUpiMasked =
              String(
                payoutData
                  .upiIdMasked ??
                "",
              ).trim();


            const payoutWhatsAppMasked =
              String(
                payoutData
                  .whatsappNumberMasked ??
                "",
              ).trim();


            if (
              !payoutUpiMasked ||
              !payoutWhatsAppMasked
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Add both your UPI ID and WhatsApp number before redeeming.",
              );
            }


            const account =
              accountSnapshot.data() ??
              {};

            const balance =
              safeInt(
                account.balancePaise,
              );

            const minimum =
              minRedeem(
                account,
              );


            if (
              safeInt(
                account.pendingRedemptionPaise,
              ) >
              0
            ) {
              throw new HttpsError(
                "failed-precondition",
                "A GenZGames redemption is already pending.",
              );
            }


            if (
              balance <
              minimum
            ) {
              throw new HttpsError(
                "failed-precondition",
                `Minimum redemption is ₹${(
                  minimum /
                  100
                ).toFixed(
                  2,
                )}.`,
              );
            }


            tx.update(
              accountRef,
              {
                balancePaise:
                  0,

                pendingRedemptionPaise:
                  balance,

                updatedAt:
                  now,
              },
            );


            tx.set(
              redemptionRef,
              {
                userId:
                  uid,

                userName,

                username:
                  "",

                email:
                  String(
                    userData.email ??
                    "",
                  ),

                amountPaise:
                  balance,

                currency:
                  CURRENCY,

                status:
                  "pending",

                               upiIdMasked:
                  payoutUpiMasked,

                whatsappNumberMasked:
                  payoutWhatsAppMasked,

                requestedAt:
                  now,

                updatedAt:
                  now,
              },
            );


            return {
              amount:
                balance,
            };
          },
        );


      const admins =
        await db
          .collection(
            "users",
          )
          .where(
            "role",
            "in",
            [
              "admin",
              "super_admin",
            ],
          )
          .get();


      const batch =
        db.batch();


      const activeAdmins =
        admins.docs
          .filter(
            (
              document,
            ) =>
              document
                .data()
                .accountStatus !==
              "suspended",
          );


      activeAdmins.forEach(
        (
          document,
        ) => {

          const notification =
            document.ref
              .collection(
                "notifications",
              )
              .doc();


          batch.set(
            notification,
            {
              userId:
                document.id,

              title:
                "New Game Redemption Request",

              message:
                `₹${(
                  result.amount /
                  100
                ).toFixed(
                  2,
                )} redemption requested by ${userName}.`,

              type:
                "admin_redemption",

              isRead:
                false,

              createdAt:
                now,

              linkUrl:
                null,
            },
          );
        },
      );


      if (
        activeAdmins.length >
        0
      ) {
        await batch.commit();
      }


      await Promise.all(
        activeAdmins.map(
          (
            document,
          ) =>
            sendMiniGamesPushNotification({
              userId:
                document.id,

              title:
                "New Game Redemption Request",

              body:
                `₹${(
                  result.amount /
                  100
                ).toFixed(
                  2,
                )} redemption requested by ${userName}.`,

              type:
                "admin_redemption",

              data: {
                redemptionId:
                  redemptionRef.id,

                status:
                  "pending",
              },
            }),
        ),
      );


      return {
        success:
          true,

        redemptionId:
          redemptionRef.id,

        amountPaise:
          result.amount,

        balancePaise:
          0,

        pendingRedemptionPaise:
          result.amount,
      };
    },
  );

  export const requestGenZRealGoldRedemption =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before redeeming Real Gold.",
        );
      }


      const uid =
        request.auth.uid;


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            uid,
          );


      const payoutRef =
        db
          .collection(
            "genzGamePayoutProfiles",
          )
          .doc(
            uid,
          );


      const goldConfigRef =
        getRealGoldConfigRef();


      const redemptionRef =
        db
          .collection(
            "genzGameRedemptions",
          )
          .doc();


      const userSnapshot =
        await db
          .collection(
            "users",
          )
          .doc(
            uid,
          )
          .get();


      const userData =
        userSnapshot.data() ??
        {};


      const userName =
        String(
          userData.displayName ??
          userData.gamerName ??
          "Player",
        );


      const now =
        Timestamp.now();


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            /*
             * All transaction reads happen first.
             */
            const [
              accountSnapshot,
              payoutSnapshot,
              goldConfigSnapshot,
            ] =
              await Promise.all([
                tx.get(
                  accountRef,
                ),

                tx.get(
                  payoutRef,
                ),

                tx.get(
                  goldConfigRef,
                ),
              ]);


            if (
              !accountSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Real Gold wallet not found.",
              );
            }


            if (
              !payoutSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Add your payout details before redeeming.",
              );
            }


            const payoutData =
              payoutSnapshot.data() ??
              {};


            const payoutUpiMasked =
              String(
                payoutData
                  .upiIdMasked ??
                "",
              ).trim();


            const payoutWhatsAppMasked =
              String(
                payoutData
                  .whatsappNumberMasked ??
                "",
              ).trim();


            if (
              !payoutUpiMasked ||
              !payoutWhatsAppMasked
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Add both your UPI ID and WhatsApp number before redeeming.",
              );
            }


            const account =
              accountSnapshot.data() ??
              {};


            const goldConfigData =
              goldConfigSnapshot.exists
                ? (
                    goldConfigSnapshot.data() ??
                    {}
                  )
                : {};


            /*
             * Gold rate is locked for this
             * redemption at request time.
             *
             * If Admin has never saved a rate,
             * use the ₹12,000/g fallback.
             */
            const goldRatePaisePerGram =
              goldConfigSnapshot.exists
                ? normalizeGoldRatePaisePerGram(
                    goldConfigData
                      .goldRatePaisePerGram,
                  )
                : DEFAULT_GOLD_RATE_PAISE_PER_GRAM;


            const goldBalanceNanograms =
              safeInt(
                account
                  .realGoldBalanceNanograms,
              );


            const pendingGoldNanograms =
              safeInt(
                account
                  .pendingRealGoldRedemptionNanograms,
              );


            if (
              pendingGoldNanograms >
              0
            ) {
              throw new HttpsError(
                "failed-precondition",
                "A Real Gold redemption is already pending.",
              );
            }


            /*
             * Calculate the nanograms representing
             * ₹5 at the current Admin gold rate.
             *
             * ceil guarantees that the reserved
             * weight fully covers ₹5.
             */
            const goldNanograms =
              Math.max(
                1,

                Math.ceil(
                  (
                    REAL_GOLD_REDEMPTION_PAISE *
                    NANOGRAMS_PER_GRAM
                  ) /
                    goldRatePaisePerGram,
                ),
              );


            if (
              goldBalanceNanograms <
              goldNanograms
            ) {
              throw new HttpsError(
                "failed-precondition",
                "You need at least ₹5 worth of Real Gold before redeeming.",
              );
            }


            const nextGoldBalanceNanograms =
              goldBalanceNanograms -
              goldNanograms;


            /*
             * Reserve only the Real Gold required
             * for this ₹5 redemption.
             *
             * Any remaining Real Gold stays in
             * the user's balance.
             */
            tx.update(
              accountRef,
              {
                realGoldBalanceNanograms:
                  nextGoldBalanceNanograms,

                pendingRealGoldRedemptionNanograms:
                  goldNanograms,

                updatedAt:
                  now,
              },
            );


            tx.set(
              redemptionRef,
              {
                userId:
                  uid,

                userName,

                username:
                  "",

                email:
                  String(
                    userData.email ??
                    "",
                  ),

                /*
                 * Admin pays exactly ₹5.
                 */
                amountPaise:
                  REAL_GOLD_REDEMPTION_PAISE,

                currency:
                  CURRENCY,

                redemptionType:
                  "real_gold",

                goldNanograms,

                /*
                 * Audit-only rate snapshot.
                 *
                 * Admin/backend may use this.
                 * It is not exposed in the
                 * player summary API.
                 */
                goldRatePaisePerGram,

                status:
                  "pending",

                upiIdMasked:
                  payoutUpiMasked,

                whatsappNumberMasked:
                  payoutWhatsAppMasked,

                requestedAt:
                  now,

                updatedAt:
                  now,
              },
            );


            return {
              amountPaise:
                REAL_GOLD_REDEMPTION_PAISE,

              goldNanograms,

              nextGoldBalanceNanograms,
            };
          },
        );


      const admins =
        await db
          .collection(
            "users",
          )
          .where(
            "role",
            "in",
            [
              "admin",
              "super_admin",
            ],
          )
          .get();


      const activeAdmins =
        admins.docs
          .filter(
            (
              document,
            ) =>
              document
                .data()
                .accountStatus !==
              "suspended",
          );


      const batch =
        db.batch();


      activeAdmins.forEach(
        (
          document,
        ) => {

          const notification =
            document.ref
              .collection(
                "notifications",
              )
              .doc();


          batch.set(
            notification,
            {
              userId:
                document.id,

              title:
                "New Real Gold Redemption",

              message:
                `₹5.00 Real Gold redemption requested by ${userName}.`,

              type:
                "admin_redemption",

              isRead:
                false,

              createdAt:
                now,

              linkUrl:
                null,
            },
          );
        },
      );


      if (
        activeAdmins.length >
        0
      ) {
        await batch.commit();
      }


      await Promise.all(
        activeAdmins.map(
          (
            document,
          ) =>
            sendMiniGamesPushNotification({
              userId:
                document.id,

              title:
                "New Real Gold Redemption",

              body:
                `₹5.00 Real Gold redemption requested by ${userName}.`,

              type:
                "admin_redemption",

              data: {
                redemptionId:
                  redemptionRef.id,

                redemptionType:
                  "real_gold",

                status:
                  "pending",
              },
            }),
        ),
      );


      return {
        success:
          true,

        redemptionId:
          redemptionRef.id,

        redemptionType:
          "real_gold",

        amountPaise:
          result.amountPaise,

        goldNanograms:
          result.goldNanograms,

        balanceNanograms:
          result.nextGoldBalanceNanograms,

        pendingRedemptionNanograms:
          result.goldNanograms,
      };
    },
  );



export const getAdminGenZGameRedemptions =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      /*
       * Admin-only, low-frequency listing function.
       *
       * Keep its Cloud Run resource reservation small
       * so it does not consume a full 2nd-gen CPU.
       */
      memory:
        "256MiB",

      cpu:
        "gcf_gen1",

      concurrency:
        1,

      maxInstances:
        1,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      await requireAdmin(
        request.auth.uid,
      );


      const snapshot =
        await db
          .collection(
            "genzGameRedemptions",
          )
          .orderBy(
            "requestedAt",
            "desc",
          )
          .limit(
            200,
          )
          .get();


      return {
        redemptions:
          snapshot.docs.map(
            (
              document,
            ) => {

              const data =
                document.data();


              const redemptionType =
                data.redemptionType ===
                "real_gold"
                  ? "real_gold"
                  : "cash";


              return {
                id:
                  document.id,

                userId:
                  String(
                    data.userId ??
                    "",
                  ),

                userName:
                  String(
                    data.userName ??
                    "Player",
                  ),

                username:
                  String(
                    data.username ??
                    "",
                  ),

                email:
                  String(
                    data.email ??
                    "",
                  ),

                redemptionType,

                amountPaise:
                  safeInt(
                    data.amountPaise,
                  ),

                goldNanograms:
                  redemptionType ===
                    "real_gold"
                    ? safeInt(
                        data.goldNanograms,
                      )
                    : 0,

                currency:
                  CURRENCY,

                status:
                  String(
                    data.status ??
                    "pending",
                  ),

                upiIdMasked:
                  String(
                    data.upiIdMasked ??
                    "",
                  ),

                whatsappNumberMasked:
                  String(
                    data.whatsappNumberMasked ??
                    "",
                  ),

                requestedAt:
                  iso(
                    data.requestedAt,
                  ),

                updatedAt:
                  iso(
                    data.updatedAt,
                  ),

                paidAt:
                  iso(
                    data.paidAt,
                  ) ||
                  undefined,

                rejectedAt:
                  iso(
                    data.rejectedAt,
                  ) ||
                  undefined,

                paymentReference:
                  typeof data
                    .paymentReference ===
                    "string"
                    ? data
                        .paymentReference
                    : undefined,

                rejectionReason:
                  typeof data
                    .rejectionReason ===
                    "string"
                    ? data
                        .rejectionReason
                    : undefined,
              };
            },
          ),
      };
    },
  );

export const getAdminGenZGameRedemptionDetails =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      secrets: [
        PAYOUT_ENCRYPTION_KEY,
      ],
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      await requireAdmin(
        request.auth.uid,
      );


      const id =
        String(
          request.data
            ?.redemptionId ??
          "",
        ).trim();


      const redemptionSnapshot =
        await db
          .collection(
            "genzGameRedemptions",
          )
          .doc(
            id,
          )
          .get();


      if (
        !redemptionSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Redemption not found.",
        );
      }


      const redemption =
        redemptionSnapshot.data() ??
        {};


      const payoutSnapshot =
        await db
          .collection(
            "genzGamePayoutProfiles",
          )
          .doc(
            String(
              redemption.userId ??
              "",
            ),
          )
          .get();


      if (
        !payoutSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Payout profile not found.",
        );
      }


      const payout =
        payoutSnapshot.data() ??
        {};


      const upiId =
        decrypt(
          payout,
        );


      let whatsappNumber =
        "";


      if (
        payout.whatsappCiphertext &&
        payout.whatsappIv &&
        payout.whatsappAuthTag
      ) {
        whatsappNumber =
          decrypt({
            ciphertext:
              payout
                .whatsappCiphertext,

            iv:
              payout
                .whatsappIv,

            authTag:
              payout
                .whatsappAuthTag,

            algorithm:
              payout
                .whatsappAlgorithm ??
              "aes-256-gcm",
          });
      }


      return {
        redemptionId:
          id,

        userId:
          String(
            redemption.userId ??
            "",
          ),

        userName:
          String(
            redemption.userName ??
            "Player",
          ),

        username:
          String(
            redemption.username ??
            "",
          ),

        redemptionType:
          redemption.redemptionType ===
            "real_gold"
            ? "real_gold"
            : "cash",

        amountPaise:
          safeInt(
            redemption.amountPaise,
          ),

        goldNanograms:
          redemption.redemptionType ===
            "real_gold"
            ? safeInt(
                redemption
                  .goldNanograms,
              )
            : 0,

        upiId,

        upiIdMasked:
          String(
            redemption.upiIdMasked ??
            "",
          ),

        whatsappNumber,

        whatsappNumberMasked:
          String(
            redemption
              .whatsappNumberMasked ??
            "",
          ),

        status:
          String(
            redemption.status ??
            "pending",
          ),

        requestedAt:
          iso(
            redemption.requestedAt,
          ),
      };
    },
  );

export const getAdminGenZGameUsers =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      memory:
        "256MiB",

      cpu:
        "gcf_gen1",

      concurrency:
        1,

      maxInstances:
        1,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      await requireAdmin(
        request.auth.uid,
      );


      const cursorUserId =
        typeof request.data
          ?.cursorUserId ===
        "string"
          ? request.data
              .cursorUserId
              .trim()
          : "";


      const usersCollection =
        db.collection(
          "users",
        );


      const countSnapshot =
        await usersCollection
          .count()
          .get();


      const totalUsers =
        countSnapshot
          .data()
          .count;


      let query:
        FirebaseFirestore.Query =
        usersCollection
          .orderBy(
            FieldPath.documentId(),
          )
          .limit(
            20,
          );


      if (
        cursorUserId
      ) {
        query =
          query.startAfter(
            cursorUserId,
          );
      }


      const snapshot =
        await query.get();


      const users =
        snapshot.docs.map(
          (
            document,
          ) => {

            const data =
              document.data();


            return {
              userId:
                document.id,

              displayName:
                String(
                  data.gamerName ??
                  data.displayName ??
                  "Player",
                ),

              email:
                String(
                  data.email ??
                  "",
                ),

              photoUrl:
                String(
                  data.photoUrl ??
                  "",
                ),

              country:
                String(
                  data.country ??
                  "",
                ),

              role:
                String(
                  data.role ??
                  "user",
                ),

              accountStatus:
                String(
                  data.accountStatus ??
                  "active",
                ),

              createdAt:
                iso(
                  data.createdAt,
                ),
            };
          },
        );


      const nextCursorUserId =
        snapshot.docs.length ===
          20
          ? snapshot.docs[
              snapshot.docs.length -
                1
            ].id
          : null;


      return {
        success:
          true,

        totalUsers,

        users,

        nextCursorUserId,
      };
    },
  );


export const getAdminGenZGameUserDetails =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      memory:
        "256MiB",

      cpu:
        "gcf_gen1",

      concurrency:
        1,

      maxInstances:
        1,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      await requireAdmin(
        request.auth.uid,
      );


      const userId =
        String(
          request.data
            ?.userId ??
          "",
        ).trim();


      if (
        !userId
      ) {
        throw new HttpsError(
          "invalid-argument",
          "User ID is required.",
        );
      }


      const userRef =
        db
          .collection(
            "users",
          )
          .doc(
            userId,
          );


      const accountRef =
        db
          .collection(
            "genzGameAccounts",
          )
          .doc(
            userId,
          );


      const [
        userSnapshot,
        accountSnapshot,
      ] =
        await Promise.all([
          userRef.get(),
          accountRef.get(),
        ]);


      if (
        !userSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "User not found.",
        );
      }


      const user =
        userSnapshot.data() ??
        {};


      const account =
        accountSnapshot.exists
          ? accountSnapshot.data() ??
            {}
          : {};


      return {
        success:
          true,

        user: {
          userId,

          displayName:
            String(
              user.gamerName ??
              user.displayName ??
              "Player",
            ),

          email:
            String(
              user.email ??
              "",
            ),

          photoUrl:
            String(
              user.photoUrl ??
              "",
            ),

          phoneNumber:
            String(
              user.phoneNumber ??
              "",
            ),

          dateOfBirth:
            String(
              user.dateOfBirth ??
              "",
            ),

          country:
            String(
              user.country ??
              "",
            ),

          referralId:
            String(
              user.referralId ??
              "",
            ),

          referredByReferralId:
            String(
              user.referredByReferralId ??
              "",
            ),

          role:
            String(
              user.role ??
              "user",
            ),

          accountStatus:
            String(
              user.accountStatus ??
              "active",
            ),

          createdAt:
            iso(
              user.createdAt,
            ),
        },

        wallet: {
          balancePaise:
            safeInt(
              account.balancePaise,
            ),

          lifetimeEarningsPaise:
            safeInt(
              account
                .lifetimeEarningsPaise,
            ),

          redeemedPaise:
            safeInt(
              account.redeemedPaise,
            ),

          pendingRedemptionPaise:
            safeInt(
              account
                .pendingRedemptionPaise,
            ),

          lifetimeDiamonds:
            safeInt(
              account
                .lifetimeDiamonds,
            ),

          referralEarningsPaise:
            safeInt(
              account
                .referralEarningsPaise,
            ),

          referralUsersCount:
            safeInt(
              account
                .referralUsersCount,
            ),

          referralQualifiedEvents:
            safeInt(
              account
                .referralQualifiedEvents,
            ),
        },

        games: {
          sudoku: {
            completedLevels:
              normalizeCompleted(
                account
                  .sudokuCompletedLevelNumbers,
              ).length,

            highestUnlockedLevel:
              Math.max(
                1,
                safeInt(
                  account
                    .sudokuHighestUnlockedLevel,
                ) ||
                  1,
              ),
          },

          goldMine: {
            collectedCycles:
              safeInt(
                account
                  .goldMineCollectedCycles,
              ),
          },

          game2048: {
            completedRuns:
              safeInt(
                account
                  .game2048CompletedRuns,
              ),

            bestTile:
              safeInt(
                account
                  .game2048BestTile,
              ),

            highScore:
              safeInt(
                account
                  .game2048HighScore,
              ),
          },

          snake: {
            completedRuns:
              safeInt(
                account
                  .snakeCompletedRuns,
              ),

            highestUnlockedLevel:
              Math.max(
                1,
                safeInt(
                  account
                    .snakeHighestUnlockedLevel,
                ) ||
                  1,
              ),

            bestScore:
              safeInt(
                account
                  .snakeBestScore,
              ),
          },

          flappyRocket: {
            completedRuns:
              safeInt(
                account
                  .flappyRocketCompletedRuns,
              ),
          },

          knifeHit: {
            completedRuns:
              safeInt(
                account
                  .knifeHitCompletedRuns,
              ),

            bestScore:
              safeInt(
                account
                  .knifeHitBestScore,
              ),

            highestLevelCleared:
              safeInt(
                account
                  .knifeHitHighestLevelCleared,
              ),
          },

          brickBreaker: {
            completedRuns:
              safeInt(
                account
                  .brickBreakerCompletedRuns,
              ),

            rewardedRuns:
              safeInt(
                account
                  .brickBreakerRewardedRuns,
              ),

            bestScore:
              safeInt(
                account
                  .brickBreakerBestScore,
              ),

            highestLevelCleared:
              safeInt(
                account
                  .brickBreakerHighestLevelCleared,
              ),

            highestUnlockedLevel:
              Math.max(
                1,
                safeInt(
                  account
                    .brickBreakerHighestUnlockedLevel,
                ) ||
                  1,
              ),
          },

          candyCascade: {
            completedRuns:
              safeInt(
                account
                  .candyCascadeCompletedRuns,
              ),

            bestScore:
              safeInt(
                account
                  .candyCascadeBestScore,
              ),

            highestLevelCleared:
              safeInt(
                account
                  .candyCascadeHighestLevelCleared,
              ),

            highestUnlockedLevel:
              Math.max(
                1,
                safeInt(
                  account
                    .candyCascadeHighestUnlockedLevel,
                ) ||
                  1,
              ),

            totalStars:
              getCandyCascadeTotalStars(
                normalizeCandyCascadeLevelStars(
                  account
                    .candyCascadeLevelStars,
                ),
              ),
          },
        },
      };
    },
  );

export const sendAdminGenZGamesNotification =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      memory:
        "256MiB",

      cpu:
        "gcf_gen1",

      concurrency:
        1,

      maxInstances:
        1,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const adminId =
        request.auth.uid;


      const adminRole =
        await requireAdmin(
          adminId,
        );


      const recipientType =
        String(
          request.data
            ?.recipientType ??
          "",
        ).trim();


      const userId =
        String(
          request.data
            ?.userId ??
          "",
        ).trim();


      const title =
        String(
          request.data
            ?.title ??
          "",
        ).trim();


      const message =
        String(
          request.data
            ?.message ??
          "",
        ).trim();


      if (
        recipientType !==
          "all" &&
        recipientType !==
          "user"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Choose a valid notification recipient.",
        );
      }


      if (
        title.length <
          2 ||
        title.length >
          80
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Notification title must be between 2 and 80 characters.",
        );
      }


      if (
        message.length <
          1 ||
        message.length >
          500
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Notification message must be between 1 and 500 characters.",
        );
      }


      const now =
        Timestamp.now();


      if (
        recipientType ===
        "user"
      ) {

        if (
          !userId
        ) {
          throw new HttpsError(
            "invalid-argument",
            "Select a user.",
          );
        }


        const userRef =
          db
            .collection(
              "users",
            )
            .doc(
              userId,
            );


        const userSnapshot =
          await userRef.get();


        if (
          !userSnapshot.exists
        ) {
          throw new HttpsError(
            "not-found",
            "User not found.",
          );
        }


        if (
          userSnapshot
            .data()
            ?.accountStatus ===
          "suspended"
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This user account is suspended.",
          );
        }


        const notificationRef =
          userRef
            .collection(
              "notifications",
            )
            .doc();


        await notificationRef.set({
          userId,

          title,

          message,

          type:
            "admin_message",

          isRead:
            false,

          createdAt:
            now,

          linkUrl:
            null,

          createdBy:
            adminId,
        });


        await sendMiniGamesPushNotification({
          userId,

          title,

          body:
            message,

          type:
            "admin_message",

          data: {
            notificationId:
              notificationRef.id,
          },
        });


        const auditRef =
          db
            .collection(
              "adminAuditLogs",
            )
            .doc();


        await auditRef.set({
          performedBy:
            adminId,

          performerRole:
            adminRole,

          action:
            "genz_game_notification_user",

          targetId:
            userId,

          targetType:
            "genz_game_user",

          notificationId:
            notificationRef.id,

          timestamp:
            now,
        });


        return {
          success:
            true,

          recipientType:
            "user",

          userId,

          notificationId:
            notificationRef.id,
        };
      }


      const globalNotificationRef =
        db
          .collection(
            "genzGameGlobalNotifications",
          )
          .doc();


      await globalNotificationRef.set({
        title,

        message,

        type:
          "admin_message",

        createdAt:
          now,

        createdBy:
          adminId,

        active:
          true,
      });


      await sendMiniGamesTopicNotification({
        title,

        body:
          message,

        type:
          "admin_message",

        data: {
          notificationId:
            globalNotificationRef.id,

          scope:
            "all",
        },
      });


      const auditRef =
        db
          .collection(
            "adminAuditLogs",
          )
          .doc();


      await auditRef.set({
        performedBy:
          adminId,

        performerRole:
          adminRole,

        action:
          "genz_game_notification_all",

        targetId:
          globalNotificationRef.id,

        targetType:
          "genz_game_global_notification",

        timestamp:
          now,
      });


      return {
        success:
          true,

        recipientType:
          "all",

        notificationId:
          globalNotificationRef.id,
      };
    },
  );

export const reviewGenZGameRedemption =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,

      secrets: [
        PAYOUT_ENCRYPTION_KEY,
      ],
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const adminId =
        request.auth.uid;


      const adminRole =
        await requireAdmin(
          adminId,
        );


      const id =
        String(
          request.data
            ?.redemptionId ??
          "",
        ).trim();


      const status =
        String(
          request.data
            ?.status ??
          "",
        ).trim();


      const paymentReference =
        String(
          request.data
            ?.paymentReference ??
          "",
        ).trim();


      const reason =
        String(
          request.data
            ?.reason ??
          "",
        ).trim();


      if (
        ![
          "paid",
          "rejected",
        ].includes(
          status,
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid review status.",
        );
      }


      if (
        status ===
          "paid" &&
        !paymentReference
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter the payment reference.",
        );
      }


      if (
        status ===
          "rejected" &&
        !reason
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a rejection reason.",
        );
      }


      const redemptionRef =
        db
          .collection(
            "genzGameRedemptions",
          )
          .doc(
            id,
          );


      const auditRef =
        db
          .collection(
            "auditLogs",
          )
          .doc();


      const now =
        Timestamp.now();


      const result =
        await db.runTransaction(
          async (
            tx,
          ) => {

            const redemptionSnapshot =
              await tx.get(
                redemptionRef,
              );


            if (
              !redemptionSnapshot.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Redemption not found.",
              );
            }


            const redemption =
              redemptionSnapshot.data() ??
              {};


            if (
              redemption.status !==
              "pending"
            ) {
              throw new HttpsError(
                "failed-precondition",
                "This redemption is already processed.",
              );
            }


            const userId =
              String(
                redemption.userId ??
                "",
              );


            if (
              !userId
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Redemption user is invalid.",
              );
            }


            const amount =
              safeInt(
                redemption.amountPaise,
              );


            const redemptionType =
              redemption.redemptionType ===
                "real_gold"
                ? "real_gold" as const
                : "cash" as const;


            const goldNanograms =
              redemptionType ===
                "real_gold"
                ? safeInt(
                    redemption
                      .goldNanograms,
                  )
                : 0;


            if (
              redemptionType ===
                "real_gold" &&
              (
                amount !==
                  REAL_GOLD_REDEMPTION_PAISE ||
                goldNanograms <=
                  0
              )
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Real Gold redemption data is invalid.",
              );
            }


            const destination =
              String(
                redemption
                  .upiIdMasked ??
                "",
              ) ||
              "your saved UPI ID";


            const accountRef =
              db
                .collection(
                  "genzGameAccounts",
                )
                .doc(
                  userId,
                );


            const accountSnapshot =
              await tx.get(
                accountRef,
              );


            if (
              !accountSnapshot.exists
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Game account not found.",
              );
            }


            const account =
              accountSnapshot.data() ??
              {};


            if (
              redemptionType ===
              "real_gold"
            ) {

              const pendingGoldNanograms =
                safeInt(
                  account
                    .pendingRealGoldRedemptionNanograms,
                );


              if (
                pendingGoldNanograms <
                goldNanograms
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "Pending Real Gold balance does not match this request.",
                );
              }


              if (
                status ===
                "paid"
              ) {

                tx.update(
                  accountRef,
                  {
                    pendingRealGoldRedemptionNanograms:
                      Math.max(
                        0,

                        pendingGoldNanograms -
                          goldNanograms,
                      ),

                    redeemedRealGoldNanograms:
                      safeInt(
                        account
                          .redeemedRealGoldNanograms,
                      ) +
                      goldNanograms,

                    updatedAt:
                      now,
                  },
                );

              } else {

                /*
                 * Rejected Real Gold redemption:
                 * return the exact reserved gold
                 * weight to Real Gold Balance.
                 */
                tx.update(
                  accountRef,
                  {
                    pendingRealGoldRedemptionNanograms:
                      Math.max(
                        0,

                        pendingGoldNanograms -
                          goldNanograms,
                      ),

                    realGoldBalanceNanograms:
                      safeInt(
                        account
                          .realGoldBalanceNanograms,
                      ) +
                      goldNanograms,

                    updatedAt:
                      now,
                  },
                );
              }

            } else {

              /*
               * Existing cash-wallet redemption.
               * Keep the old behavior unchanged.
               */
              const pending =
                safeInt(
                  account
                    .pendingRedemptionPaise,
                );


              if (
                pending <
                amount
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "Pending wallet balance does not match this request.",
                );
              }


              if (
                status ===
                "paid"
              ) {

                tx.update(
                  accountRef,
                  {
                    pendingRedemptionPaise:
                      Math.max(
                        0,

                        pending -
                          amount,
                      ),

                    redeemedPaise:
                      safeInt(
                        account
                          .redeemedPaise,
                      ) +
                      amount,

                    hasCompletedFirstGameRedemption:
                      true,

                    updatedAt:
                      now,
                  },
                );

              } else {

                tx.update(
                  accountRef,
                  {
                    pendingRedemptionPaise:
                      Math.max(
                        0,

                        pending -
                          amount,
                      ),

                    balancePaise:
                      safeInt(
                        account
                          .balancePaise,
                      ) +
                      amount,

                    updatedAt:
                      now,
                  },
                );
              }
            }


            tx.update(
              redemptionRef,
              {
                status,

                reviewedBy:
                  adminId,

                reviewedAt:
                  now,

                updatedAt:
                  now,

                paidAt:
                  status ===
                  "paid"
                    ? now
                    : null,

                rejectedAt:
                  status ===
                  "rejected"
                    ? now
                    : null,

                paymentReference:
                  status ===
                  "paid"
                    ? paymentReference
                    : null,

                rejectionReason:
                  status ===
                  "rejected"
                    ? reason
                    : null,
              },
            );


            const notificationRef =
              db
                .collection(
                  "users",
                )
                .doc(
                  userId,
                )
                .collection(
                  "notifications",
                )
                .doc();


            const amountText =
              `₹${(
                amount /
                100
              ).toFixed(
                2,
              )}`;


            const paidTitle =
              redemptionType ===
                "real_gold"
                ? "Real Gold Payment Completed"
                : "GenZGames Payment Completed";


            const rejectedTitle =
              redemptionType ===
                "real_gold"
                ? "Real Gold Redemption Returned"
                : "GenZGames Redemption Returned";


            const paidMessage =
              redemptionType ===
                "real_gold"
                ? `${amountText} for your Real Gold redemption has been credited to your UPI ID ${destination}.`
                : `${amountText} has been credited to your UPI ID ${destination}.`;


            const rejectedMessage =
              redemptionType ===
                "real_gold"
                ? `Your ${amountText} Real Gold redemption was returned to your Real Gold Balance. ${reason}`
                : `Your ${amountText} redemption was returned to your Game Balance. ${reason}`;


            tx.set(
              notificationRef,
              {
                userId,

                title:
                  status ===
                  "paid"
                    ? paidTitle
                    : rejectedTitle,

                message:
                  status ===
                  "paid"
                    ? paidMessage
                    : rejectedMessage,

                type:
                  "payout",

                isRead:
                  false,

                createdAt:
                  now,

                linkUrl:
                  null,
              },
            );


            tx.set(
              auditRef,
              {
                performedBy:
                  adminId,

                performerRole:
                  adminRole,

                action:
                  status ===
                  "paid"
                    ? (
                        redemptionType ===
                          "real_gold"
                          ? "real_gold_redemption_paid"
                          : "game_redemption_paid"
                      )
                    : (
                        redemptionType ===
                          "real_gold"
                          ? "real_gold_redemption_rejected"
                          : "game_redemption_rejected"
                      ),

                targetId:
                  id,

                targetType:
                  redemptionType ===
                    "real_gold"
                    ? "genz_real_gold_redemption"
                    : "genz_game_redemption",

                timestamp:
                  now,
              },
            );


            return {
              userId,

              amount,

              destination,

              redemptionType,

              goldNanograms,
            };
          },
        );


      const amountText =
        `₹${(
          result.amount /
          100
        ).toFixed(
          2,
        )}`;


      const paidTitle =
        result.redemptionType ===
          "real_gold"
          ? "Real Gold Payment Completed"
          : "GenZGames Payment Completed";


      const rejectedTitle =
        result.redemptionType ===
          "real_gold"
          ? "Real Gold Redemption Returned"
          : "GenZGames Redemption Returned";


      const paidBody =
        result.redemptionType ===
          "real_gold"
          ? `${amountText} for your Real Gold redemption has been credited to your UPI ID ${result.destination}.`
          : `${amountText} has been credited to your UPI ID ${result.destination}.`;


      const rejectedBody =
        result.redemptionType ===
          "real_gold"
          ? `Your ${amountText} Real Gold redemption was returned to your Real Gold Balance. ${reason}`
          : `Your ${amountText} redemption was returned to your Game Balance. ${reason}`;


      await sendMiniGamesPushNotification({
        userId:
          result.userId,

        title:
          status ===
          "paid"
            ? paidTitle
            : rejectedTitle,

        body:
          status ===
          "paid"
            ? paidBody
            : rejectedBody,

        type:
          "payout",

        data: {
          redemptionId:
            id,

          redemptionType:
            result.redemptionType,

          status,
        },
      });


      return {
        success:
          true,

        redemptionId:
          id,

        redemptionType:
          result.redemptionType,

        status,

        userId:
          result.userId,

        amountPaise:
          result.amount,

        goldNanograms:
          result.goldNanograms,
      };
    },
  );



export const getMiniGamesNotifications =
  onCall(
    {
      invoker:
        "public",

      cors:
        true,
    },

    async (
      request,
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in required.",
        );
      }


      const [
        personalSnapshot,
        globalSnapshot,
      ] =
        await Promise.all([
          db
            .collection(
              "users",
            )
            .doc(
              request.auth.uid,
            )
            .collection(
              "notifications",
            )
            .orderBy(
              "createdAt",
              "desc",
            )
            .limit(
              50,
            )
            .get(),

          db
            .collection(
              "genzGameGlobalNotifications",
            )
            .where(
              "active",
              "==",
              true,
            )
            .orderBy(
              "createdAt",
              "desc",
            )
            .limit(
              20,
            )
            .get(),
        ]);


      const personal =
        personalSnapshot.docs.map(
          (
            document,
          ) => {

            const data =
              document.data();


            return {
              id:
                document.id,

              title:
                String(
                  data.title ??
                  "Notification",
                ),

              message:
                String(
                  data.message ??
                  "",
                ),

              type:
                String(
                  data.type ??
                  "info",
                ),

              isRead:
                data.isRead ===
                true,

              createdAt:
                iso(
                  data.createdAt,
                ),

              scope:
                "personal",
            };
          },
        );


      const global =
        globalSnapshot.docs.map(
          (
            document,
          ) => {

            const data =
              document.data();


            return {
              id:
                `global_${document.id}`,

              title:
                String(
                  data.title ??
                  "GenZGames",
                ),

              message:
                String(
                  data.message ??
                  "",
                ),

              type:
                String(
                  data.type ??
                  "admin_message",
                ),

              isRead:
                true,

              createdAt:
                iso(
                  data.createdAt,
                ),

              scope:
                "global",
            };
          },
        );


      const notifications =
        [
          ...personal,
          ...global,
        ]
          .sort(
            (
              first,
              second,
            ) =>
              new Date(
                second.createdAt ||
                0,
              ).getTime() -
              new Date(
                first.createdAt ||
                0,
              ).getTime(),
          )
          .slice(
            0,
            50,
          );


      return {
        notifications,
      };
    },
  );

export const markMiniGamesNotificationsRead = onCall({ invoker:"public", cors:true }, async (request) => {
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required."); const snap=await db.collection("users").doc(request.auth.uid).collection("notifications").where("isRead","==",false).limit(100).get(); const batch=db.batch(); snap.docs.forEach(d=>batch.update(d.ref,{isRead:true,readAt:FieldValue.serverTimestamp()})); if(!snap.empty)await batch.commit(); return {success:true,markedCount:snap.size};
});
