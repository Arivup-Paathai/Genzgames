/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE TYPES
 * ============================================================
 *
 * Core design:
 *
 * - Maximum logical board: 9 × 9
 * - Per-level active-cell masks
 * - Deterministic seeded gameplay
 * - Swipe / tap adjacent pieces
 * - Cascades
 * - Special pieces
 * - Layered blockers
 * - Jelly-style cells
 * - Ingredient drop objectives
 * - Collect-color objectives
 * - Score objectives
 * - Limited moves
 * - One rewarded-ad +5 move continue per run
 * - Server-verifiable completed runs
 *
 * IMPORTANT:
 *
 * These types contain NO React / Firebase / AdMob logic.
 */


/*
 * ============================================================
 * BASIC COORDINATES
 * ============================================================
 */

export interface CandyCascadePoint {
  row: number;

  col: number;
}


export type CandyCascadeDirection =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT";


/*
 * ============================================================
 * PIECE COLORS
 * ============================================================
 *
 * We deliberately use generic internal color names.
 *
 * The rendered GenZGames pieces can later have our own:
 *
 * - shapes
 * - icons
 * - gradients
 * - faces
 * - effects
 *
 * without affecting the deterministic engine.
 */

export type CandyCascadeColor =
  | "RED"
  | "BLUE"
  | "GREEN"
  | "YELLOW"
  | "PURPLE"
  | "ORANGE";


/*
 * ============================================================
 * SPECIAL PIECES
 * ============================================================
 */

export type CandyCascadeSpecialType =
  | "NONE"

  /*
   * Clears entire horizontal row.
   */
  | "STRIPED_ROW"

  /*
   * Clears entire vertical column.
   */
  | "STRIPED_COLUMN"

  /*
   * Explodes nearby cells.
   *
   * Intended for T / L shaped matches.
   */
  | "WRAPPED"

  /*
   * Removes pieces of a selected color.
   *
   * Created from a straight 5-match.
   */
  | "COLOR_BOMB";


/*
 * ============================================================
 * GAME PIECE
 * ============================================================
 */

export interface CandyCascadePiece {
  /*
   * Deterministic piece identifier.
   *
   * Never create this with Date.now() or Math.random()
   * inside gameplay.
   */
  id: number;

  color:
    CandyCascadeColor;

  special:
    CandyCascadeSpecialType;
}


/*
 * ============================================================
 * BLOCKERS
 * ============================================================
 *
 * Blockers belong to the CELL rather than replacing the
 * piece whenever possible.
 *
 * This makes layered objectives easier to model.
 */

export type CandyCascadeBlockerType =
  | "NONE"

  /*
   * Piece exists underneath.
   *
   * Matching on this cell damages one layer.
   */
  | "FROSTING"

  /*
   * Piece cannot move while blocker remains.
   */
  | "LICORICE"

  /*
   * Stronger layered obstacle.
   */
  | "CRATE";


export interface CandyCascadeBlocker {
  type:
    CandyCascadeBlockerType;

  /*
   * 0 means no blocker.
   *
   * Typical values:
   *
   * 1
   * 2
   * 3
   */
  layers:
    number;
}


/*
 * ============================================================
 * DROP ITEMS / INGREDIENTS
 * ============================================================
 */

export type CandyCascadeDropItemType =
  | "STAR"
  | "GEM"
  | "FRUIT";


export interface CandyCascadeDropItem {
  id:
    number;

  type:
    CandyCascadeDropItemType;
}


/*
 * ============================================================
 * BOARD CELL
 * ============================================================
 */

export interface CandyCascadeCell {
  row:
    number;

  col:
    number;

  /*
   * False = this coordinate does not exist visually.
   *
   * Allows:
   *
   * ■■■■■■■■■
   * ■■■■■■■■■
   *
   * and shaped boards such as:
   *
   *   ■■■■■
   *  ■■■■■■■
   * ■■■■■■■■■
   */
  active:
    boolean;

  piece:
    CandyCascadePiece |
    null;

  blocker:
    CandyCascadeBlocker;

  /*
   * Jelly / gel layer beneath the piece.
   *
   * 0 = no jelly
   * 1 = one hit
   * 2 = two hits
   */
  jellyLayers:
    number;

  /*
   * Falling objective item.
   *
   * Piece and drop item are separate because the
   * drop item behaves differently during gravity.
   */
  dropItem:
    CandyCascadeDropItem |
    null;

  /*
   * Ingredient/drop objective exits through these cells.
   */
  isDropExit:
    boolean;

  /*
   * Optional teleport system.
   *
   * Kept in the model now so later levels do not require
   * another save-format redesign.
   */
  portalId:
    string |
    null;

  portalTarget:
    CandyCascadePoint |
    null;

  /*
   * Reserved for later advanced levels.
   *
   * NONE means normal gravity only.
   */
  conveyor:
    CandyCascadeDirection |
    "NONE";
}


/*
 * ============================================================
 * BOARD
 * ============================================================
 */

export type CandyCascadeBoard =
  CandyCascadeCell[][];


/*
 * ============================================================
 * OBJECTIVES
 * ============================================================
 */

export type CandyCascadeObjectiveType =
  | "SCORE"
  | "COLLECT_COLOR"
  | "CLEAR_JELLY"
  | "BREAK_BLOCKERS"
  | "DROP_ITEMS";


export interface CandyCascadeScoreObjective {
  type:
    "SCORE";

  targetScore:
    number;
}


export interface CandyCascadeCollectColorObjective {
  type:
    "COLLECT_COLOR";

  color:
    CandyCascadeColor;

  targetCount:
    number;
}


export interface CandyCascadeClearJellyObjective {
  type:
    "CLEAR_JELLY";

  targetLayers:
    number;
}


export interface CandyCascadeBreakBlockersObjective {
  type:
    "BREAK_BLOCKERS";

  targetLayers:
    number;
}


export interface CandyCascadeDropItemsObjective {
  type:
    "DROP_ITEMS";

  targetCount:
    number;
}


export type CandyCascadeObjective =
  | CandyCascadeScoreObjective
  | CandyCascadeCollectColorObjective
  | CandyCascadeClearJellyObjective
  | CandyCascadeBreakBlockersObjective
  | CandyCascadeDropItemsObjective;


/*
 * ============================================================
 * OBJECTIVE PROGRESS
 * ============================================================
 */

export interface CandyCascadeObjectiveProgress {
  type:
    CandyCascadeObjectiveType;

  /*
   * Used for COLLECT_COLOR.
   *
   * Null for other objective types.
   */
  color:
    CandyCascadeColor |
    null;

  current:
    number;

  target:
    number;

  completed:
    boolean;
}


/*
 * ============================================================
 * LEVEL CONFIG
 * ============================================================
 */

export interface CandyCascadeLevelConfig {
  id:
    number;

  rows:
    number;

  columns:
    number;

  /*
   * Number of available piece colors.
   *
   * Early levels may use 4.
   * Later levels can use 5 or 6.
   */
  colors:
    CandyCascadeColor[];

  moves:
    number;

  objectives:
    CandyCascadeObjective[];

  /*
   * Which cells physically exist.
   *
   * true  = playable coordinate
   * false = empty/cut-out coordinate
   */
  activeMask:
    boolean[][];

  /*
   * Starting jelly layers.
   */
  jellyMask:
    number[][];

  /*
   * Starting blocker configuration.
   */
  blockers:
    CandyCascadeInitialBlocker[];

  /*
   * Starting ingredient / drop items.
   */
  dropItems:
    CandyCascadeInitialDropItem[];

  /*
   * Board cells where falling objectives leave the board.
   */
  dropExits:
    CandyCascadePoint[];

  /*
   * Optional advanced-board portals.
   */
  portals:
    CandyCascadePortalConfig[];

  /*
   * Optional conveyors for later levels.
   */
  conveyors:
    CandyCascadeConveyorConfig[];
}


export interface CandyCascadeInitialBlocker {
  row:
    number;

  col:
    number;

  type:
    Exclude<
      CandyCascadeBlockerType,
      "NONE"
    >;

  layers:
    number;
}


export interface CandyCascadeInitialDropItem {
  row:
    number;

  col:
    number;

  type:
    CandyCascadeDropItemType;
}


export interface CandyCascadePortalConfig {
  id:
    string;

  from:
    CandyCascadePoint;

  to:
    CandyCascadePoint;
}


export interface CandyCascadeConveyorConfig {
  row:
    number;

  col:
    number;

  direction:
    CandyCascadeDirection;
}


/*
 * ============================================================
 * MATCH GROUP
 * ============================================================
 */

export type CandyCascadeMatchShape =
  | "LINE"
  | "T_SHAPE"
  | "L_SHAPE"
  | "CROSS";


export interface CandyCascadeMatchGroup {
  color:
    CandyCascadeColor;

  cells:
    CandyCascadePoint[];

  shape:
    CandyCascadeMatchShape;

  /*
   * For straight line matches only.
   */
  orientation:
    "ROW" |
    "COLUMN" |
    null;
}


/*
 * ============================================================
 * SPECIAL CREATION
 * ============================================================
 */

export interface CandyCascadeSpecialCreation {
  position:
    CandyCascadePoint;

  special:
    CandyCascadeSpecialType;

  color:
    CandyCascadeColor;
}


/*
 * ============================================================
 * SPECIAL COMBINATION
 * ============================================================
 */

export type CandyCascadeSpecialCombination =
  | "NONE"
  | "STRIPED_STRIPED"
  | "STRIPED_WRAPPED"
  | "WRAPPED_WRAPPED"
  | "COLOR_BOMB_NORMAL"
  | "COLOR_BOMB_STRIPED"
  | "COLOR_BOMB_WRAPPED"
  | "COLOR_BOMB_COLOR_BOMB";


/*
 * ============================================================
 * GAME STATE
 * ============================================================
 */

export interface CandyCascadeGameState {
  levelId:
    number;

  /*
   * Deterministic PRNG seed selected when run starts.
   */
  seed:
    number;

  /*
   * Every deterministic random result advances this counter.
   *
   * Frontend + backend must use:
   *
   * seed + randomStep
   *
   * to obtain exactly the same result.
   */
  randomStep:
    number;

  /*
   * Deterministic piece identifier counter.
   */
  nextPieceId:
    number;

  nextDropItemId:
    number;

  board:
    CandyCascadeBoard;

  movesRemaining:
    number;

  movesUsed:
    number;

  score:
    number;

  combo:
    number;

  /*
   * Highest cascade chain reached during this run.
   */
  bestCascade:
    number;

  objectiveProgress:
    CandyCascadeObjectiveProgress[];

  /*
   * Number of automatic shuffles performed because
   * no valid player move remained.
   */
  shuffleCount:
    number;

  /*
   * The rewarded-ad continue can add exactly 5 moves
   * once per run.
   */
  extraMovesUsed:
    boolean;

  extraMovesGranted:
    number;

  isGameOver:
    boolean;

  isLevelCleared:
    boolean;
}


/*
 * ============================================================
 * PLAYER SWAP EVENT
 * ============================================================
 *
 * This is the main event sent to the backend.
 *
 * We do NOT send:
 *
 * - generated pieces
 * - cascades
 * - match results
 * - scores
 *
 * The backend reconstructs those from:
 *
 * seed + swap events.
 */

export interface CandyCascadeSwapEvent {
  type:
    "SWAP";

  /*
   * Player move number BEFORE this move resolves.
   *
   * Starts at 0.
   */
  moveIndex:
    number;

  from:
    CandyCascadePoint;

  to:
    CandyCascadePoint;
}


/*
 * ============================================================
 * EXTRA MOVES EVENT
 * ============================================================
 *
 * Rewarded ad verification itself remains client-controlled,
 * but deterministic gameplay records where the +5 moves
 * were introduced.
 */

export interface CandyCascadeContinueEvent {
  type:
    "CONTINUE";

  /*
   * movesUsed when the continue was activated.
   */
  afterMoveIndex:
    number;

  movesGranted:
    number;
}


export type CandyCascadeRunEvent =
  | CandyCascadeSwapEvent
  | CandyCascadeContinueEvent;


/*
 * ============================================================
 * SWAP RESULT
 * ============================================================
 */

export interface CandyCascadeSwapResult {
  accepted:
    boolean;

  state:
    CandyCascadeGameState;

  /*
   * Invalid swaps return accepted:false and do not consume
   * a move.
   */
  moveConsumed:
    boolean;

  swapped:
    boolean;

  specialCombination:
    CandyCascadeSpecialCombination;

  removedPieces:
    number;

  destroyedJellyLayers:
    number;

  destroyedBlockerLayers:
    number;

  droppedItems:
    number;

  gainedScore:
    number;

  cascadeCount:
    number;

  createdSpecials:
    CandyCascadeSpecialCreation[];

  shuffled:
    boolean;

  levelCleared:
    boolean;

  gameOver:
    boolean;
}


/*
 * ============================================================
 * CASCADE STEP
 * ============================================================
 *
 * The engine can expose these steps to the React board so
 * animation is visual only.
 *
 * Gameplay results themselves remain deterministic.
 */

export interface CandyCascadeCascadeStep {
  cascadeIndex:
    number;

  matchedCells:
    CandyCascadePoint[];

  blastCells:
    CandyCascadePoint[];

  createdSpecials:
    CandyCascadeSpecialCreation[];

  removedPieces:
    number;

  gainedScore:
    number;

  boardAfterRemoval:
    CandyCascadeBoard;

  boardAfterGravity:
    CandyCascadeBoard;
}


/*
 * ============================================================
 * COMPLETE MOVE RESULT
 * ============================================================
 *
 * UI can animate individual cascade stages without changing
 * the actual final deterministic state.
 */

export interface CandyCascadeMoveResolution {
  result:
    CandyCascadeSwapResult;

  cascadeSteps:
    CandyCascadeCascadeStep[];
}


/*
 * ============================================================
 * STAR RESULT
 * ============================================================
 */

export type CandyCascadeStarCount =
  | 0
  | 1
  | 2
  | 3;


/*
 * ============================================================
 * SAVED ACTIVE RUN
 * ============================================================
 */

export interface SavedGenZCandyCascadeRun {
  version:
    1;

  runId:
    string;

  seed:
    number;

  level:
    number;

  gameState:
    CandyCascadeGameState;

  events:
    CandyCascadeRunEvent[];

  /*
   * Completion reward:
   *
   * ₹0.05 + 10 diamonds
   *
   * Exactly once for this run.
   */
  rewardClaimed:
    boolean;

  /*
   * Backend has verified the complete deterministic run and
   * progression/unlock state.
   */
  levelClearVerified:
    boolean;

  startedAt:
    number;

  updatedAt:
    number;
}


/*
 * ============================================================
 * LOCAL PROGRESS
 * ============================================================
 *
 * Server remains authoritative for unlock progression.
 *
 * These values mainly improve local UX.
 */

export interface CandyCascadeLocalProgress {
  selectedLevel:
    number;

  highestLevelCleared:
    number;

  bestScore:
    number;

  stars:
    Record<
      number,
      CandyCascadeStarCount
    >;
}


/*
 * ============================================================
 * SERVER COMPLETION REQUEST
 * ============================================================
 *
 * A successful level should need only ONE settlement call.
 *
 * Backend replays the complete run and then:
 *
 * - verifies objective completion
 * - verifies score
 * - verifies remaining moves
 * - computes stars
 * - grants ₹0.05
 * - grants 10 diamonds
 * - updates progression
 * - unlocks next level
 */

export interface CompleteCandyCascadeRunRequest {
  runId:
    string;

  seed:
    number;

  level:
    number;

  events:
    CandyCascadeRunEvent[];

  elapsedSeconds:
    number;
}


/*
 * ============================================================
 * SERVER COMPLETION RESPONSE
 * ============================================================
 */

export interface CompleteCandyCascadeRunResponse {
  success:
    boolean;

  runId:
    string;

  level:
    number;

  levelClearVerified:
    boolean;

  rewardGranted:
    boolean;

  rewardPaise:
    number;

  diamondsGranted:
    number;

  diamondDayKey:
    string;

  todayDiamonds:
    number;

  lifetimeDiamonds:
    number;

  balancePaise:
    number;

  lifetimeEarningsPaise:
    number;

  score:
    number;

  stars:
    CandyCascadeStarCount;

  movesRemaining:
    number;

  completedRuns:
    number;

  rewardedRuns:
    number;

  bestScore:
    number;

  highestLevelCleared:
    number;

  highestUnlockedLevel:
    number;

  nextUnlockedLevel:
    number |
    null;
}