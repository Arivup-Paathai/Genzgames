import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../firebase/firebase";


export type GenZGoldMineStatus =
  | "idle"
  | "mining"
  | "full";


export type GenZLeaderboardPeriod =
  | "today"
  | "yesterday";


export interface GenZDiamondSummary {
  dayKey: string;

  today: number;

  lifetime: number;

  sudokuToday: number;

  miningToday: number;

  referralToday: number;

  game2048Today: number;
}


export interface GenZLeaderboardPlayer {
  userId: string;

  gamerName: string;

  photoUrl: string;

  diamonds: number;

  rank: number;
}


export interface GetGenZGamesDailyLeaderboardResponse {
  success: boolean;

  period:
    GenZLeaderboardPeriod;

  dayKey: string;

  topPlayers:
    GenZLeaderboardPlayer[];

  currentPlayer:
    GenZLeaderboardPlayer |
    null;

  isCurrentPlayerInTop10:
    boolean;

  generatedAt:
    string;
}


export interface ApplyGenZGamesReferralResponse {
  success: boolean;

  referralId: string;

  referrerUserId: string;

  diamondsGranted: number;

  diamondDayKey: string;

  referrerTodayDiamonds: number;

  referrerLifetimeDiamonds: number;
}


export interface GenZGoldMineSummary {
  level: number;

  cycleSeconds: number;

  capacityGold: number;

  rewardPaise: number;

  collectedCycles: number;

  currentCycleId:
    string |
    null;

  startedAt:
    string |
    null;

  status:
    GenZGoldMineStatus;

  elapsedSeconds:
    number;

  remainingSeconds:
    number;

  goldCollected:
    number;

  canCollect:
    boolean;
}


export interface GetGenZGamesSummaryResponse {
  success: boolean;

  currency:
    "INR";

  balancePaise:
    number;

  lifetimeEarningsPaise:
    number;

  redeemedPaise:
    number;

  pendingRedemptionPaise:
    number;

  minimumRedemptionPaise:
    number;

  diamonds:
    GenZDiamondSummary;

  payout: {
    configured:
      boolean;

    upiIdMasked:
      string |
      null;
  };

  sudoku: {
    totalLevels:
      number;

    completedLevels:
      number;

    completedLevelNumbers:
      number[];

    highestUnlockedLevel:
      number;
  };

  goldMine:
    GenZGoldMineSummary;

  game2048: {
    completedRuns: number;

    bestTile: number;

    highScore: number;
  };
}


export interface StartGenZGoldMineResponse {
  success: boolean;

  startedNew: boolean;

  goldMine:
    GenZGoldMineSummary;
}


export interface CollectGenZGoldMineResponse {
  success: boolean;

  cycleId: string;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  collectedCycles: number;

  goldMine:
    GenZGoldMineSummary;
}

export type GenZ2048Move =
  | "up"
  | "down"
  | "left"
  | "right";


export interface CompleteGenZ2048RunRequest {
  runId: string;

  seed: number;

  moves:
    GenZ2048Move[];

  elapsedSeconds: number;
}


export interface CompleteGenZ2048RunResponse {
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

  highestTile: number;

  score: number;

  completedRuns: number;

  bestTile: number;

  highScore: number;
}

export interface CompleteGenZSudokuLevelRequest {
  level: number;

  elapsedSeconds: number;

  finalBoard:
    number[][];
}


export interface CompleteGenZSudokuLevelResponse {
  success: boolean;

  level: number;

  rewardGranted: boolean;

  rewardPaise: number;

  diamondsGranted: number;

  diamondDayKey: string;

  todayDiamonds: number;

  lifetimeDiamonds: number;

  balancePaise: number;

  lifetimeEarningsPaise: number;

  completedLevels: number;

  completedLevelNumbers:
    number[];

  highestUnlockedLevel:
    number;
}


export interface UnlockGenZSudokuLevelResponse {
  success: boolean;

  level: number;

  alreadyUnlocked: boolean;

  highestUnlockedLevel:
    number;
}


export interface SaveGenZGamesUpiIdResponse {
  success: boolean;

  upiIdMasked: string;
}


export interface RequestGenZGamesRedemptionResponse {
  success: boolean;

  redemptionId: string;

  amountPaise: number;

  balancePaise: number;

  pendingRedemptionPaise:
    number;
}


const getSummary =
  httpsCallable<
    void,
    GetGenZGamesSummaryResponse
  >(
    functions,
    "getGenZGamesSummary",
  );


const startMine =
  httpsCallable<
    void,
    StartGenZGoldMineResponse
  >(
    functions,
    "startGenZGoldMine",
  );


const collectMine =
  httpsCallable<
    void,
    CollectGenZGoldMineResponse
  >(
    functions,
    "collectGenZGoldMine",
  );


const complete2048 =
  httpsCallable<
    CompleteGenZ2048RunRequest,
    CompleteGenZ2048RunResponse
  >(
    functions,
    "completeGenZ2048Run",
  );


const completeSudoku =
  httpsCallable<
    CompleteGenZSudokuLevelRequest,
    CompleteGenZSudokuLevelResponse
  >(
    functions,
    "completeGenZSudokuLevel",
  );


const unlockSudoku =
  httpsCallable<
    {
      level:
        number;
    },
    UnlockGenZSudokuLevelResponse
  >(
    functions,
    "unlockGenZSudokuLevel",
  );


const saveUpi =
  httpsCallable<
    {
      upiId:
        string;
    },
    SaveGenZGamesUpiIdResponse
  >(
    functions,
    "saveGenZGamesUpiId",
  );


const requestRedemption =
  httpsCallable<
    void,
    RequestGenZGamesRedemptionResponse
  >(
    functions,
    "requestGenZGamesRedemption",
  );


const getDailyLeaderboard =
  httpsCallable<
    {
      period:
        GenZLeaderboardPeriod;
    },
    GetGenZGamesDailyLeaderboardResponse
  >(
    functions,
    "getGenZGamesDailyLeaderboard",
  );


const applyReferral =
  httpsCallable<
    {
      referralId:
        string;
    },
    ApplyGenZGamesReferralResponse
  >(
    functions,
    "applyGenZGamesReferral",
  );


export const cloudflareR2 = {

  async getGenZGamesSummary() {

    return (
      await getSummary()
    ).data;
  },


  async startGenZGoldMine() {

    return (
      await startMine()
    ).data;
  },


  async collectGenZGoldMine() {

    return (
      await collectMine()
    ).data;
  },


  async completeGenZ2048Run(
    request:
      CompleteGenZ2048RunRequest,
  ) {

    return (
      await complete2048(
        request,
      )
    ).data;
  },


  async completeGenZSudokuLevel(
    request:
      CompleteGenZSudokuLevelRequest,
  ) {

    return (
      await completeSudoku(
        request,
      )
    ).data;
  },


  async unlockGenZSudokuLevel(
    level:
      number,
  ) {

    return (
      await unlockSudoku({
        level,
      })
    ).data;
  },


  async saveGenZGamesUpiId(
    upiId:
      string,
  ) {

    return (
      await saveUpi({
        upiId,
      })
    ).data;
  },


  async requestGenZGamesRedemption() {

    return (
      await requestRedemption()
    ).data;
  },


  async getGenZGamesDailyLeaderboard(
    period:
      GenZLeaderboardPeriod,
  ) {

    return (
      await getDailyLeaderboard({
        period,
      })
    ).data;
  },


  async applyGenZGamesReferral(
    referralId:
      string,
  ) {

    return (
      await applyReferral({
        referralId,
      })
    ).data;
  },
};