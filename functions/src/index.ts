import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
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

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

const CURRENCY = "INR" as const;
const SUDOKU_TOTAL_LEVELS = 100;
const NORMAL_GAME_REWARD_PAISE = 5; // ₹0.05
const FIRST_GAME_REWARD_PAISE = 100; // first successful Sudoku completion = ₹1.00 incl. welcome bonus
const FIRST_REDEEM_MIN_PAISE = 100; // ₹1.00
const STANDARD_REDEEM_MIN_PAISE = 500; // ₹5.00
const MINE_CYCLE_SECONDS = 300;
const MINE_CAPACITY_GOLD = 300;

/*
 * Gold Mine:
 *
 * One successful 5-minute cycle =
 * ₹0.03 / 3 paise.
 */
const GOLD_MINE_REWARD_PAISE =
  3;


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

const REFERRAL_DIAMOND_REWARD =
  20;


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
    | "payout";

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

const safeInt = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const iso = (value: unknown): string => value instanceof Timestamp ? value.toDate().toISOString() : "";
const normalizeCompleted = (value: unknown): number[] => Array.isArray(value) ? Array.from(new Set(value.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 100))).sort((a,b)=>a-b) : [];
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

  redeemedPaise:
    0,

  pendingRedemptionPaise:
    0,

  firstGameRewardGranted:
    false,

  hasCompletedFirstGameRedemption:
    false,

  sudokuCompletedLevelNumbers:
    [],

  sudokuHighestUnlockedLevel:
    1,

  goldMineCollectedCycles:
    0,

  goldMineCurrentCycleId:
    null,

  goldMineStartedAt:
    null,

  game2048CompletedRuns:
    0,

  game2048BestTile:
    0,

  game2048HighScore:
    0,

  createdAt:
    FieldValue.serverTimestamp(),

  updatedAt:
    FieldValue.serverTimestamp(),
});

type GenZDiamondSource =
  | "sudoku"
  | "mining"
  | "2048"
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

function mineState(account: FirebaseFirestore.DocumentData, now = Date.now()) {
  const cycleId = typeof account.goldMineCurrentCycleId === "string" && account.goldMineCurrentCycleId ? account.goldMineCurrentCycleId : null;
  const started = account.goldMineStartedAt instanceof Timestamp ? account.goldMineStartedAt : null;
  if (!cycleId || !started) return {
    level: 1, cycleSeconds: MINE_CYCLE_SECONDS, capacityGold: MINE_CAPACITY_GOLD,
    rewardPaise:
  GOLD_MINE_REWARD_PAISE, collectedCycles: safeInt(account.goldMineCollectedCycles),
    currentCycleId: null, startedAt: null, status: "idle" as const, elapsedSeconds: 0,
    remainingSeconds: MINE_CYCLE_SECONDS, goldCollected: 0, canCollect: false,
  };
  const elapsed = Math.max(0, Math.min(MINE_CYCLE_SECONDS, Math.floor((now - started.toMillis()) / 1000)));
  const full = elapsed >= MINE_CYCLE_SECONDS;
  return {
    level: 1, cycleSeconds: MINE_CYCLE_SECONDS, capacityGold: MINE_CAPACITY_GOLD,
    rewardPaise:
  GOLD_MINE_REWARD_PAISE, collectedCycles: safeInt(account.goldMineCollectedCycles),
    currentCycleId: cycleId, startedAt: started.toDate().toISOString(), status: full ? "full" as const : "mining" as const,
    elapsedSeconds: elapsed, remainingSeconds: Math.max(0, MINE_CYCLE_SECONDS - elapsed),
    goldCollected: Math.min(MINE_CAPACITY_GOLD, elapsed), canCollect: full,
  };
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


      return {
        success:
          true,

        deviceId,
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


            if (
              referrerAccountSnapshot.exists
            ) {

              tx.set(
                referrerAccountRef,
                {
                  lifetimeDiamonds,

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


      const dayKey =
        getIstDayKey();


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
          100,

          Math.max(
            1,

            safeInt(
              account
                .sudokuHighestUnlockedLevel,
            ) ||
            1,
          ),
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
        },

        payout: {
          configured:
            payout.exists,

          upiIdMasked:
            payout.exists
              ? String(
                  payout
                    .data()
                    ?.upiIdMasked ??
                  "",
                )
              : null,
        },

        sudoku: {
          totalLevels:
            100,

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
          ),

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
      };
    },
  );

export const startGenZGoldMine = onCall({ invoker:"public", cors:true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to start mining.");
  const uid=request.auth.uid; const ref=db.collection("genzGameAccounts").doc(uid); const now=Timestamp.now();
  const result=await db.runTransaction(async tx=>{ const snap=await tx.get(ref); const account=snap.exists?(snap.data()??{}):accountDefaults(uid); const state=mineState(account, now.toMillis()); if (state.currentCycleId) return {startedNew:false, account}; const cycleId=crypto.randomUUID(); const next={...account,goldMineCurrentCycleId:cycleId,goldMineStartedAt:now,updatedAt:now}; tx.set(ref,next,{merge:true}); return {startedNew:true,account:next}; });
  return {success:true, startedNew:result.startedNew, goldMine:mineState(result.account, now.toMillis())};
});

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
                now.toMillis(),
              );


            if (
              !state.currentCycleId ||
              !state.canCollect
            ) {
              throw new HttpsError(
                "failed-precondition",
                "The 5-minute mining cycle is not complete yet.",
              );
            }


            const transactionRef =
              db
                .collection(
                  "genzGameTransactions",
                )
                .doc(
                  `${uid}_mine_${state.currentCycleId}`,
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


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account.balancePaise,
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

              goldMineCurrentCycleId:
                null,

              goldMineStartedAt:
                null,

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
            };
          },
        );


      return {
        success:
          true,

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
          safeInt(
            result
              .account
              .goldMineCollectedCycles,
          ),

        goldMine:
          mineState(
            result.account,
            now.toMillis(),
          ),
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
             * Replay:
             *
             * no ₹ reward
             * no diamond reward
             */
            if (
              levelSnapshot.exists ||
              transactionSnapshot.exists ||
              completed.includes(
                level,
              )
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


            const next = {
              ...account,

              balancePaise:
                safeInt(
                  account.balancePaise,
                ) +
                reward,

              lifetimeEarningsPaise:
                safeInt(
                  account
                    .lifetimeEarningsPaise,
                ) +
                reward,

              lifetimeDiamonds,

              firstGameRewardGranted:
                true,

              sudokuCompletedLevelNumbers:
                nextCompleted,

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
  
export const unlockGenZSudokuLevel = onCall({ invoker:"public", cors:true }, async (request) => {
  if(!request.auth) throw new HttpsError("unauthenticated","Sign in to unlock Sudoku levels."); const uid=request.auth.uid; const level=Number(request.data?.level); if(!Number.isInteger(level)||level<2||level>100)throw new HttpsError("invalid-argument","Invalid Sudoku level."); const ref=db.collection("genzGameAccounts").doc(uid); const now=Timestamp.now();
  const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref); const account=snap.exists?(snap.data()??{}):accountDefaults(uid); const highest=Math.max(1,safeInt(account.sudokuHighestUnlockedLevel)||1); if(level<=highest)return {already:true,highest}; if(level!==highest+1)throw new HttpsError("failed-precondition","Unlock levels in order."); const completed=normalizeCompleted(account.sudokuCompletedLevelNumbers); if(!completed.includes(level-1))throw new HttpsError("failed-precondition","Complete the previous level first."); tx.set(ref,{...account,sudokuHighestUnlockedLevel:level,updatedAt:now},{merge:true}); tx.set(ref.collection("sudokuLevels").doc(String(level)),{level,unlocked:true,unlockedWithRewardedAd:true,unlockedAt:now,updatedAt:now},{merge:true}); return {already:false,highest:level};}); return {success:true,level,alreadyUnlocked:result.already,highestUnlockedLevel:result.highest};
});



export const saveGenZGamesUpiId = onCall({ invoker:"public", cors:true, secrets:[PAYOUT_ENCRYPTION_KEY] }, async (request) => {
  if(!request.auth) throw new HttpsError("unauthenticated","Sign in before saving UPI."); const uid=request.auth.uid; const upi=normalizeUpi(request.data?.upiId); if(!upi)throw new HttpsError("invalid-argument","Enter a valid UPI ID."); const hash=crypto.createHash("sha256").update(upi).digest("hex"); const payoutRef=db.collection("genzGamePayoutProfiles").doc(uid); const claimRef=db.collection("genzGameUpiClaims").doc(hash); const encrypted=encrypt(upi); const masked=maskUpi(upi); const now=Timestamp.now();
  await db.runTransaction(async tx=>{const [payoutSnap,claimSnap]=await Promise.all([tx.get(payoutRef),tx.get(claimRef)]); if(claimSnap.exists&&claimSnap.data()?.userId!==uid)throw new HttpsError("already-exists","This UPI ID is already linked to another GenZGames account."); const oldHash=String(payoutSnap.data()?.upiHash??""); if(oldHash&&oldHash!==hash)tx.delete(db.collection("genzGameUpiClaims").doc(oldHash)); tx.set(claimRef,{userId:uid,upiHash:hash,createdAt:claimSnap.exists?(claimSnap.data()?.createdAt??now):now,updatedAt:now}); tx.set(payoutRef,{userId:uid,upiIdMasked:masked,upiHash:hash,...encrypted,updatedAt:now,createdAt:payoutSnap.exists?(payoutSnap.data()?.createdAt??now):now}); }); return {success:true,upiIdMasked:masked};
});

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
                "Add your UPI ID before redeeming.",
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
                  String(
                    payoutSnapshot
                      .data()
                      ?.upiIdMasked ??
                    "",
                  ),

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
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required."); await requireAdmin(request.auth.uid); const snap=await db.collection("genzGameRedemptions").orderBy("requestedAt","desc").limit(200).get(); return {redemptions:snap.docs.map(d=>{const x=d.data();return{id:d.id,userId:String(x.userId??""),userName:String(x.userName??"Player"),username:String(x.username??""),email:String(x.email??""),amountPaise:safeInt(x.amountPaise),currency:CURRENCY,status:String(x.status??"pending"),upiIdMasked:String(x.upiIdMasked??""),requestedAt:iso(x.requestedAt),updatedAt:iso(x.updatedAt),paidAt:iso(x.paidAt)||undefined,rejectedAt:iso(x.rejectedAt)||undefined,paymentReference:typeof x.paymentReference==="string"?x.paymentReference:undefined,rejectionReason:typeof x.rejectionReason==="string"?x.rejectionReason:undefined};})};
});

export const getAdminGenZGameRedemptionDetails = onCall({ invoker:"public", cors:true, secrets:[PAYOUT_ENCRYPTION_KEY] }, async (request) => {
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required."); await requireAdmin(request.auth.uid); const id=String(request.data?.redemptionId??"").trim(); const r=await db.collection("genzGameRedemptions").doc(id).get(); if(!r.exists)throw new HttpsError("not-found","Redemption not found."); const x=r.data()??{}; const payout=await db.collection("genzGamePayoutProfiles").doc(String(x.userId??"")).get(); if(!payout.exists)throw new HttpsError("failed-precondition","UPI profile not found."); return {redemptionId:id,userId:String(x.userId??""),userName:String(x.userName??"Player"),username:String(x.username??""),amountPaise:safeInt(x.amountPaise),upiId:decrypt(payout.data()??{}),upiIdMasked:String(x.upiIdMasked??""),status:String(x.status??"pending"),requestedAt:iso(x.requestedAt)};
});

export const reviewGenZGameRedemption =
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
        );

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
        status === "paid" &&
        !paymentReference
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter the payment reference.",
        );
      }


      if (
        status === "rejected" &&
        !reason
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a rejection reason.",
        );
      }


      const redRef =
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

            const redemption =
              await tx.get(
                redRef,
              );


            if (
              !redemption.exists
            ) {
              throw new HttpsError(
                "not-found",
                "Redemption not found.",
              );
            }


            const data =
              redemption.data() ??
              {};


            if (
              data.status !==
              "pending"
            ) {
              throw new HttpsError(
                "failed-precondition",
                "This redemption is already processed.",
              );
            }


            const userId =
              String(
                data.userId ??
                "",
              );

            const amount =
              safeInt(
                data.amountPaise,
              );

            const destination =
              String(
                data.upiIdMasked ??
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

            const pending =
              safeInt(
                account.pendingRedemptionPaise,
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
                      account.redeemedPaise,
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
                      account.balancePaise,
                    ) +
                    amount,

                  updatedAt:
                    now,
                },
              );
            }


            tx.update(
              redRef,
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


            const notification =
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


            tx.set(
              notification,
              {
                userId,

                title:
                  status ===
                  "paid"
                    ? "GenZGames Payment Completed"
                    : "GenZGames Redemption Returned",

                message:
                  status ===
                  "paid"
                    ? `${amountText} has been credited to your UPI ID ${destination}.`
                    : `Your ${amountText} redemption was returned to your Game Balance. ${reason}`,

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
                    ? "game_redemption_paid"
                    : "game_redemption_rejected",

                targetId:
                  id,

                targetType:
                  "genz_game_redemption",

                timestamp:
                  now,
              },
            );


            return {
              userId,

              amount,

              destination,
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


      await sendMiniGamesPushNotification({
        userId:
          result.userId,

        title:
          status ===
          "paid"
            ? "GenZGames Payment Completed"
            : "GenZGames Redemption Returned",

        body:
          status ===
          "paid"
            ? `${amountText} has been credited to your UPI ID ${result.destination}.`
            : `Your ${amountText} redemption was returned to your Game Balance. ${reason}`,

        type:
          "payout",

        data: {
          redemptionId:
            id,

          status,
        },
      });


      return {
        success:
          true,

        redemptionId:
          id,

        status,

        userId:
          result.userId,

        amountPaise:
          result.amount,
      };
    },
  );

export const getMiniGamesNotifications = onCall({ invoker:"public", cors:true }, async (request) => {
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required."); const snap=await db.collection("users").doc(request.auth.uid).collection("notifications").orderBy("createdAt","desc").limit(50).get(); return {notifications:snap.docs.map(d=>{const x=d.data();return{id:d.id,title:String(x.title??"Notification"),message:String(x.message??""),type:String(x.type??"info"),isRead:x.isRead===true,createdAt:iso(x.createdAt)};})};
});

export const markMiniGamesNotificationsRead = onCall({ invoker:"public", cors:true }, async (request) => {
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required."); const snap=await db.collection("users").doc(request.auth.uid).collection("notifications").where("isRead","==",false).limit(100).get(); const batch=db.batch(); snap.docs.forEach(d=>batch.update(d.ref,{isRead:true,readAt:FieldValue.serverTimestamp()})); if(!snap.empty)await batch.commit(); return {success:true,markedCount:snap.size};
});
