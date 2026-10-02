import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "./firebase/firebase";

import type {
  BrickBreakerInputEvent,
  BrickBreakerReviveEvent,
} from "../games/brickBreaker/brickBreakerTypes";

import type {
  CandyCascadeRunEvent,
} from "../games/candyCascade/candyCascadeTypes";


/*
 * =====================================================
 * FLAPPY ROCKET
 * =====================================================
 */

export interface CompleteFlappyRocketRunRequest {
  runId: string;

  seed: number;

  tickCount: number;

  flapEvents: Array<{
    tick: number;
  }>;

  reviveTick:
    number |
    null;

  elapsedSeconds: number;
}


export interface CompleteFlappyRocketRunResponse {
  success: boolean;

  runId: string;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  score: number;

  completedRuns: number;

  reviveUsed: boolean;
}

export interface SubmitFlappyRocketFinalRecordRequest {
  seed: number;

  tickCount: number;

  flapEvents:
    Array<{
      tick:
        number;
    }>;

  reviveTick:
    number |
    null;
}


export interface SubmitFlappyRocketFinalRecordResponse {
  success: boolean;

  score: number;
}


/*
 * =====================================================
 * KNIFE HIT
 * =====================================================
 */

export type KnifeHitRunEndReason =
  | "BATCH_COMPLETE"
  | "OUT_OF_REVIVES"
  | "USER_END";


export interface CompleteKnifeHitRunRequest {
  runId: string;

  seed: number;

  batchStartLevel: number;

  attempts: Array<{
    level: number;

    attemptNumber: number;

    throwEvents: Array<{
      tick: number;
    }>;
  }>;

  endReason:
    KnifeHitRunEndReason;

  elapsedSeconds: number;
}


export interface CompleteKnifeHitRunResponse {
  success: boolean;

  runId: string;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  batchStartLevel: number;

  batchEndLevel: number;

  completedLevels: number[];

  completedLevelCount: number;

  revivesUsed: number;

  endReason:
    KnifeHitRunEndReason;

  score: number;

  completedRuns: number;

  bestScore: number;

  highestLevelCleared: number;

  highestUnlockedBatchStart: number;

  nextBatchStartLevel:
    number |
    null;
}

/*
 * =====================================================
 * BRICK BREAKER
 * =====================================================
 */


/*
 * -----------------------------------------------------
 * 50% REWARD MILESTONE
 * -----------------------------------------------------
 *
 * Backend replays the deterministic run only up to
 * milestoneTick.
 *
 * If valid:
 *
 * ₹0.05 + 10 diamonds
 *
 * Gameplay continues after this call.
 */
export interface ClaimBrickBreakerRewardRequest {
  runId: string;

  level: number;

  milestoneTick: number;

  inputEvents:
    BrickBreakerInputEvent[];

  reviveEvents:
    BrickBreakerReviveEvent[];

  elapsedSeconds: number;
}


export interface ClaimBrickBreakerRewardResponse {
  success: boolean;

  runId: string;

  level: number;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  destroyedBrickHp: number;

  totalBrickHp: number;

  progressPercent: number;

  rewardedRuns: number;
}


/*
 * -----------------------------------------------------
 * 100% LEVEL CLEAR
 * -----------------------------------------------------
 *
 * Uses the SAME runId as the 50% reward claim.
 *
 * Backend replays the complete deterministic run.
 *
 * No second cash/diamond reward is granted here.
 *
 * This call is responsible for:
 *
 * - verified 100% completion
 * - best score
 * - highest level cleared
 * - unlocking the next level
 */
export interface CompleteBrickBreakerLevelRequest {
  runId: string;

  level: number;

  tickCount: number;

  inputEvents:
    BrickBreakerInputEvent[];

  reviveEvents:
    BrickBreakerReviveEvent[];

  elapsedSeconds: number;
}


export interface CompleteBrickBreakerLevelResponse {
  success: boolean;

  runId: string;

  level: number;

  levelClearVerified: boolean;

  score: number;

  completedRuns: number;

  bestScore: number;

  highestLevelCleared: number;

  highestUnlockedLevel: number;

  nextUnlockedLevel:
    number |
    null;
}

/*
 * =====================================================
 * CANDY CASCADE
 * =====================================================
 *
 * One verified successful run:
 *
 * ₹0.05 + 10 diamonds
 *
 * Backend reconstructs the complete deterministic game
 * from level + seed + ordered gameplay events.
 */

export interface CompleteCandyCascadeRunRequest {
  runId: string;

  level: number;

  seed: number;

  events:
    CandyCascadeRunEvent[];

  elapsedSeconds: number;
}


export interface CompleteCandyCascadeRunResponse {
  success: boolean;

  runId: string;

  level: number;

  levelClearVerified: boolean;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  score: number;

  movesUsed: number;

  stars:
    0 |
    1 |
    2 |
    3;

  completedRuns: number;

  bestScore: number;

  highestLevelCleared: number;

  highestUnlockedLevel: number;

  nextUnlockedLevel:
    number |
    null;

  totalStars: number;

  levelStars:
    Record<
      string,
      number
    >;
}

const completeFlappyRocketRunCallable =
  httpsCallable<
    CompleteFlappyRocketRunRequest,
    CompleteFlappyRocketRunResponse
  >(
    functions,
    "completeFlappyRocketRun",
  );

const submitFlappyRocketFinalRecordCallable =
  httpsCallable<
    SubmitFlappyRocketFinalRecordRequest,
    SubmitFlappyRocketFinalRecordResponse
  >(
    functions,
    "submitGenZFlappyRocketFinalRecord",
  );


const completeKnifeHitRunCallable =
  httpsCallable<
    CompleteKnifeHitRunRequest,
    CompleteKnifeHitRunResponse
  >(
    functions,
    "completeKnifeHitRun",
  );


const claimBrickBreakerRewardCallable =
  httpsCallable<
    ClaimBrickBreakerRewardRequest,
    ClaimBrickBreakerRewardResponse
  >(
    functions,
    "claimBrickBreakerReward",
  );


const completeBrickBreakerLevelCallable = 
  httpsCallable< 
    CompleteBrickBreakerLevelRequest, 
    CompleteBrickBreakerLevelResponse 
  >( 
    functions, 
    "completeBrickBreakerLevel", 
  ); 


const completeCandyCascadeRunCallable =
  httpsCallable<
    CompleteCandyCascadeRunRequest,
    CompleteCandyCascadeRunResponse
  >(
    functions,
    "completeCandyCascadeRun",
  );


/*
 * =====================================================
 * GENZGAMES API
 * =====================================================
 *
 * New GenZGames integrations should use
 * this clearly named API service.
 *
 * Existing completed games can continue
 * using their current legacy service.
 */
export const genZGamesApi = {

  async completeFlappyRocketRun(
    request:
      CompleteFlappyRocketRunRequest,
  ):
    Promise<
      CompleteFlappyRocketRunResponse
    > {

    const response =
      await completeFlappyRocketRunCallable(
        request,
      );


    return response.data;
  },


  async submitFlappyRocketFinalRecord(
    request:
      SubmitFlappyRocketFinalRecordRequest,
  ):
    Promise<
      SubmitFlappyRocketFinalRecordResponse
    > {

    const response =
      await submitFlappyRocketFinalRecordCallable(
        request,
      );


    return response.data;
  },


  async completeKnifeHitRun(
    request:
      CompleteKnifeHitRunRequest,
  ):
    Promise<
      CompleteKnifeHitRunResponse
    > {

    const response =
      await completeKnifeHitRunCallable(
        request,
      );


    return response.data;
  },


  async claimBrickBreakerReward(
    request:
      ClaimBrickBreakerRewardRequest,
  ):
    Promise<
      ClaimBrickBreakerRewardResponse
    > {

    const response =
      await claimBrickBreakerRewardCallable(
        request,
      );


    return response.data;
  },


    async completeBrickBreakerLevel( 
    request: 
      CompleteBrickBreakerLevelRequest, 
  ): 
    Promise< 
      CompleteBrickBreakerLevelResponse 
    > { 
 
    const response = 
      await completeBrickBreakerLevelCallable( 
        request, 
      ); 
 
 
    return response.data; 
  },


  async completeCandyCascadeRun(
    request:
      CompleteCandyCascadeRunRequest,
  ):
    Promise<
      CompleteCandyCascadeRunResponse
    > {

    const response =
      await completeCandyCascadeRunCallable(
        request,
      );


    return response.data;
  },
};