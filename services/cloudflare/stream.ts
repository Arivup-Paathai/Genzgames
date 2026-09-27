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

  snakeToday: number;

  flappyRocketToday: number;

  knifeHitToday: number;

  brickBreakerToday: number;

  candyCascadeToday: number;
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

referralEarnings: {
  todayPaise:
    number;

  lifetimePaise:
    number;

  referredPlayers:
    number;

  qualifiedEvents:
    number;
};

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

    whatsappNumberMasked:
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

    snake: {
    highestUnlockedLevel: number;

    completedRuns: number;

    bestScore: number;

    bestLevel: number;
  };

  flappyRocket: {
    completedRuns: number;
  };

  knifeHit: {
    completedRuns: number;

    bestScore: number;

    highestLevelCleared: number;

    highestUnlockedBatchStart: number;
  };

  brickBreaker: {
    totalLevels: number;

    highestUnlockedLevel: number;

    highestLevelCleared: number;

    rewardedRuns: number;

    completedRuns: number;

    bestScore: number;
  };

  candyCascade: {
    totalLevels: number;

    highestUnlockedLevel: number;

    highestLevelCleared: number;

    completedRuns: number;

    bestScore: number;

    totalStars: number;

    levelStars:
      Record<
        string,
        number
      >;
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

export type GenZSnakeDirection =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT";


export interface GenZSnakeDirectionEvent {
  tick: number;

  direction:
    GenZSnakeDirection;
}


export interface CompleteGenZSnakeRunRequest {
  runId: string;

  seed: number;

  level: number;

  /*
   * Final deterministic game tick.
   *
   * The backend replays exactly this many
   * Snake movement steps.
   */
  tickCount: number;

  directionEvents:
    GenZSnakeDirectionEvent[];

  elapsedSeconds: number;
}


export interface CompleteGenZSnakeRunResponse {
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

  score: number;

  growthPercent: number;

  completedRuns: number;

  highestUnlockedLevel: number;

  bestScore: number;

  bestLevel: number;
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

  whatsappNumberMasked: string;
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

  const completeSnake =
  httpsCallable<
    CompleteGenZSnakeRunRequest,
    CompleteGenZSnakeRunResponse
  >(
    functions,
    "completeGenZSnakeRun",
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

      whatsappNumber:
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

  async completeGenZSnakeRun(
  request:
    CompleteGenZSnakeRunRequest,
) {

  return (
    await completeSnake(
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

    whatsappNumber:
      string,
  ) {

    return (
      await saveUpi({
        upiId,

        whatsappNumber,
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