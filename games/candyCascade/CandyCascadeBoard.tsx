import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CANDY_CASCADE_COLUMNS,
  CANDY_CASCADE_ROWS,
} from "./candyCascadeConstants";

import type {
  CandyCascadeCell,
  CandyCascadeColor,
  CandyCascadeGameState,
  CandyCascadePoint,
  CandyCascadeSpecialType,
} from "./candyCascadeTypes";


/*
 * ============================================================
 * GENZGAMES - CANDY CASCADE BOARD
 * ============================================================
 *
 * Responsibilities:
 *
 * - render responsive maximum 9 × 9 board
 * - support irregular active-cell masks
 * - render original GenZGames piece styling
 * - render jelly
 * - render blockers
 * - render drop items
 * - render special pieces
 * - tap-to-select
 * - tap adjacent piece to swap
 * - swipe-to-swap
 * - hint pulse
 * - visual blast/highlight states
 *
 * IMPORTANT:
 *
 * This component contains NO gameplay calculation.
 *
 * It does NOT:
 *
 * - detect matches
 * - calculate score
 * - generate random pieces
 * - resolve cascades
 * - grant rewards
 *
 * Those remain inside candyCascadeEngine.ts.
 */


/*
 * ============================================================
 * BOARD VISUAL STATE
 * ============================================================
 */

export type CandyCascadeBoardPhase =
  | "IDLE"
  | "SWAP"
  | "REMOVE"
  | "FALL"
  | "SHUFFLE";


export interface CandyCascadeBoardVisualState {
  phase?:
    CandyCascadeBoardPhase;

  highlightedCells?:
    CandyCascadePoint[];

  blastCells?:
    CandyCascadePoint[];
}


/*
 * ============================================================
 * COMPONENT PROPS
 * ============================================================
 */

interface CandyCascadeBoardProps {
  state:
    CandyCascadeGameState;

  disabled?:
    boolean;

  busy?:
    boolean;

  hint?:
    {
      from:
        CandyCascadePoint;

      to:
        CandyCascadePoint;
    } |
    null;

  visualState?:
    CandyCascadeBoardVisualState;

  onSwap:
    (
      from:
        CandyCascadePoint,

      to:
        CandyCascadePoint,
    ) =>
      void |
      Promise<void>;
}


/*
 * ============================================================
 * POINTER STATE
 * ============================================================
 */

interface PointerStartState {
  point:
    CandyCascadePoint;

  x:
    number;

  y:
    number;

  pointerId:
    number;
}


/*
 * ============================================================
 * VISUAL CONSTANTS
 * ============================================================
 */

const SWIPE_THRESHOLD_PX =
  18;


const CELL_GAP_PX =
  3;

const getSwapTransform =
  (
    point:
      CandyCascadePoint,

    phase:
      CandyCascadeBoardPhase,

    highlightedCells:
      CandyCascadePoint[] |
      undefined,
  ): string | null => {

    if (
      phase !==
        "SWAP" ||
      !highlightedCells ||
      highlightedCells.length <
        2
    ) {
      return null;
    }


    const first =
      highlightedCells[0];

    const second =
      highlightedCells[1];


    let target:
      CandyCascadePoint |
      null =
      null;


    if (
      samePoint(
        point,
        first,
      )
    ) {
      target =
        second;

    } else if (
      samePoint(
        point,
        second,
      )
    ) {
      target =
        first;
    }


    if (
      !target
    ) {
      return null;
    }


    const rowDelta =
      target.row -
      point.row;

    const colDelta =
      target.col -
      point.col;


    if (
      colDelta ===
      1
    ) {
      return `translate3d(calc(100% + ${CELL_GAP_PX}px), 0, 0)`;
    }


    if (
      colDelta ===
      -1
    ) {
      return `translate3d(calc(-100% - ${CELL_GAP_PX}px), 0, 0)`;
    }


    if (
      rowDelta ===
      1
    ) {
      return `translate3d(0, calc(100% + ${CELL_GAP_PX}px), 0)`;
    }


    if (
      rowDelta ===
      -1
    ) {
      return `translate3d(0, calc(-100% - ${CELL_GAP_PX}px), 0)`;
    }


    return null;
  };


/*
 * ============================================================
 * POINT HELPERS
 * ============================================================
 */

const samePoint =
  (
    first:
      CandyCascadePoint |
      null,

    second:
      CandyCascadePoint |
      null,
  ) =>
    Boolean(
      first &&
      second &&
      first.row ===
        second.row &&
      first.col ===
        second.col,
    );


const pointKey =
  (
    point:
      CandyCascadePoint,
  ) =>
    `${point.row}:${point.col}`;


const insideBoard =
  (
    point:
      CandyCascadePoint,
  ) =>
    point.row >=
      0 &&
    point.row <
      CANDY_CASCADE_ROWS &&
    point.col >=
      0 &&
    point.col <
      CANDY_CASCADE_COLUMNS;


const areAdjacent =
  (
    first:
      CandyCascadePoint,

    second:
      CandyCascadePoint,
  ) =>
    Math.abs(
      first.row -
        second.row,
    ) +
      Math.abs(
        first.col -
          second.col,
      ) ===
    1;


/*
 * ============================================================
 * PIECE VISUAL THEME
 * ============================================================
 *
 * These are original GenZGames pieces.
 *
 * We use the same match-3 color language players understand,
 * but not copied Candy Crush artwork/assets.
 */

interface PieceTheme {
  background:
    string;

  shadow:
    string;

  highlight:
    string;

  shape:
    string;
}


const PIECE_THEME:
Record<
  CandyCascadeColor,
  PieceTheme
> = {
  RED: {
    background:
      "linear-gradient(145deg,#ff7b8d 0%,#ff365f 46%,#c81242 100%)",

    shadow:
      "0 5px 8px rgba(190,18,60,0.38), inset 0 -4px 5px rgba(100,0,20,0.20)",

    highlight:
      "rgba(255,255,255,0.58)",

    shape:
      "42% 58% 48% 52% / 50% 44% 56% 50%",
  },

  BLUE: {
    background:
      "linear-gradient(145deg,#7ddcff 0%,#2ba6ff 48%,#0965d7 100%)",

    shadow:
      "0 5px 8px rgba(2,105,200,0.38), inset 0 -4px 5px rgba(0,50,130,0.20)",

    highlight:
      "rgba(255,255,255,0.58)",

    shape:
      "48% 52% 48% 52% / 38% 38% 62% 62%",
  },

  GREEN: {
    background:
      "linear-gradient(145deg,#8df39c 0%,#35ce69 46%,#079447 100%)",

    shadow:
      "0 5px 8px rgba(5,130,70,0.36), inset 0 -4px 5px rgba(0,80,35,0.20)",

    highlight:
      "rgba(255,255,255,0.55)",

    shape:
      "56% 44% 58% 42% / 48% 58% 42% 52%",
  },

  YELLOW: {
    background:
      "linear-gradient(145deg,#fff589 0%,#ffd73d 48%,#e69a09 100%)",

    shadow:
      "0 5px 8px rgba(190,120,0,0.34), inset 0 -4px 5px rgba(130,70,0,0.18)",

    highlight:
      "rgba(255,255,255,0.70)",

    shape:
      "28% 72% 28% 72% / 50% 50% 50% 50%",
  },

  PURPLE: {
    background:
      "linear-gradient(145deg,#d69cff 0%,#9b55ef 47%,#6420bb 100%)",

    shadow:
      "0 5px 8px rgba(100,32,185,0.36), inset 0 -4px 5px rgba(55,0,110,0.20)",

    highlight:
      "rgba(255,255,255,0.58)",

    shape:
      "52% 48% 52% 48% / 44% 56% 44% 56%",
  },

  ORANGE: {
    background:
      "linear-gradient(145deg,#ffc477 0%,#ff8e37 48%,#de4d08 100%)",

    shadow:
      "0 5px 8px rgba(190,70,0,0.36), inset 0 -4px 5px rgba(110,35,0,0.20)",

    highlight:
      "rgba(255,255,255,0.58)",

    shape:
      "50% 50% 45% 55% / 58% 58% 42% 42%",
  },
};


/*
 * ============================================================
 * SPECIAL PIECE VISUAL
 * ============================================================
 */

const getSpecialOverlay =
  (
    special:
      CandyCascadeSpecialType,
  ) => {

    if (
      special ===
      "STRIPED_ROW"
    ) {

      return (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            overflow-hidden
          "
          style={{
            borderRadius:
              "inherit",

            background:
              "repeating-linear-gradient(0deg,rgba(255,255,255,0.72) 0px,rgba(255,255,255,0.72) 4px,transparent 4px,transparent 10px)",
          }}
        />
      );
    }


    if (
      special ===
      "STRIPED_COLUMN"
    ) {

      return (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            overflow-hidden
          "
          style={{
            borderRadius:
              "inherit",

            background:
              "repeating-linear-gradient(90deg,rgba(255,255,255,0.72) 0px,rgba(255,255,255,0.72) 4px,transparent 4px,transparent 10px)",
          }}
        />
      );
    }


    if (
      special ===
      "WRAPPED"
    ) {

      return (
        <>
          <div
            className="
              pointer-events-none
              absolute
              left-[42%]
              top-[4%]
              h-[92%]
              w-[16%]
              rounded-full
              bg-white/65
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              left-[4%]
              top-[42%]
              h-[16%]
              w-[92%]
              rounded-full
              bg-white/65
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-1/2
              h-[34%]
              w-[34%]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border-2
              border-white/80
              bg-white/25
            "
          />
        </>
      );
    }


    return null;
  };


/*
 * ============================================================
 * COLOR BOMB / PRISM CORE
 * ============================================================
 */

const PrismCore:
React.FC = () => (
  <div
    style={{
      position:
        "relative",

      width:
        "100%",

      height:
        "100%",

      borderRadius:
        "9999px",

      border:
        "1px solid rgba(255,255,255,0.42)",

      background:
        "radial-gradient(circle at 34% 28%, #4e5567 0%, #23283a 26%, #090b14 70%, #000000 100%)",

      boxShadow:
        "0 6px 12px rgba(0,0,0,0.48), inset 0 2px 5px rgba(255,255,255,0.22), inset 0 -4px 8px rgba(0,0,0,0.24)",

      overflow:
        "hidden",
    }}
  >
    {[
      {
        left:
          "18%",

        top:
          "18%",

        background:
          "#ff4f70",
      },

      {
        left:
          "50%",

        top:
          "12%",

        background:
          "#43c7ff",
      },

      {
        left:
          "68%",

        top:
          "34%",

        background:
          "#ffd83d",
      },

      {
        left:
          "48%",

        top:
          "60%",

        background:
          "#9c63ff",
      },

      {
        left:
          "16%",

        top:
          "56%",

        background:
          "#47e47c",
      },

      {
        left:
          "34%",

        top:
          "38%",

        background:
          "#ff9138",
      },
    ].map(
      (
        dot,
        index,
      ) => (
        <span
          key={
            index
          }
          style={{
            position:
              "absolute",

            left:
              dot.left,

            top:
              dot.top,

            width:
              "17%",

            height:
              "17%",

            borderRadius:
              "9999px",

            border:
              "1px solid rgba(255,255,255,0.42)",

            background:
              dot.background,

            boxShadow:
              `0 0 8px ${dot.background}`,
          }}
        />
      ),
    )}

    <span
      style={{
        position:
          "absolute",

        left:
          "18%",

        top:
          "12%",

        width:
          "34%",

        height:
          "18%",

        borderRadius:
          "9999px",

        background:
          "rgba(255,255,255,0.30)",

        filter:
          "blur(1px)",

        transform:
          "rotate(-18deg)",
      }}
    />

    <span
      style={{
        position:
          "absolute",

        inset:
          "-4%",

        borderRadius:
          "9999px",

        border:
          "2px solid rgba(255,255,255,0.18)",
      }}
    />
  </div>
);


/*
 * ============================================================
 * NORMAL / SPECIAL PIECE
 * ============================================================
 */

interface PieceProps {
  cell:
    CandyCascadeCell;

  selected:
    boolean;

  hinted:
    boolean;

  removing:
    boolean;

  falling:
    boolean;
}


const CandyPiece:
React.FC<
  PieceProps
> = ({
  cell,
  selected,
  hinted,
  removing,
  falling,
}) => {

  const piece =
    cell.piece;

  const jellyLayers =
  cell.jellyLayers;


const hasJelly =
  jellyLayers >
  0;


const strongJelly =
  jellyLayers >=
  2;


  if (
    !piece
  ) {
    return null;
  }


  if (
    piece.special ===
    "COLOR_BOMB"
  ) {

    return (
      <div
  className={`
    absolute
    inset-[7%]
    flex
    items-center
    justify-center
    transition-all
    duration-200

    ${
      selected
        ? "scale-[0.88]"
        : "scale-100"
    }

    ${
      hinted
        ? "animate-pulse"
        : ""
    }

    ${
      removing
        ? "scale-[1.28] opacity-0"
        : ""
    }

    ${
      falling
        ? "animate-[bounce_0.32s_ease-out_1]"
        : ""
    }
  `}
  style={{
  position:
    "absolute",

  top:
    "4%",

  right:
    "4%",

  bottom:
    "4%",

  left:
    "4%",

  zIndex:
    20,
}}
>
  <PrismCore />
</div>
    );
  }


  const theme =
    PIECE_THEME[
      piece.color
    ];


  return (
    <div
      className={`
        absolute
        inset-[9%]
        transition-all
        duration-200

        ${
          selected
            ? "scale-[0.86]"
            : "scale-100"
        }

        ${
          hinted
            ? "animate-pulse"
            : ""
        }

        ${
          removing
            ? "scale-[1.34] rotate-12 opacity-0"
            : ""
        }

        ${
          falling
            ? "animate-[bounce_0.32s_ease-out_1]"
            : ""
        }
      `}
      style={{
  position:
    "absolute",

  top:
    hasJelly
      ? "5%"
      : "9%",

  right:
    hasJelly
      ? "5%"
      : "9%",

  bottom:
    hasJelly
      ? "5%"
      : "9%",

  left:
    hasJelly
      ? "5%"
      : "9%",

  zIndex:
    20,

  borderRadius:
    hasJelly
      ? "26%"
      : theme.shape,

  background:
    hasJelly
      ? strongJelly
        ? `linear-gradient(
            145deg,
            rgba(255,255,255,0.44) 0%,
            transparent 26%,
            transparent 68%,
            rgba(236,72,153,0.22) 100%
          ), ${theme.background}`
        : `linear-gradient(
            145deg,
            rgba(255,255,255,0.50) 0%,
            transparent 28%,
            transparent 70%,
            rgba(34,211,238,0.20) 100%
          ), ${theme.background}`
      : theme.background,

  border:
    hasJelly
      ? strongJelly
        ? "3px solid rgba(244,114,182,0.95)"
        : "3px solid rgba(103,232,249,0.95)"
      : "none",

  boxShadow:
    hasJelly
      ? strongJelly
        ? `${theme.shadow}, inset 0 0 12px rgba(255,255,255,0.72), 0 0 10px rgba(236,72,153,0.70)`
        : `${theme.shadow}, inset 0 0 12px rgba(255,255,255,0.72), 0 0 9px rgba(34,211,238,0.65)`
      : theme.shadow,
}}
    >
            <div
        className="
          pointer-events-none
          absolute
          left-[18%]
          top-[13%]
          h-[21%]
          w-[34%]
          -rotate-[20deg]
          rounded-full
          blur-[0.3px]
        "
        style={{
          background:
            theme.highlight,
        }}
      />


      {hasJelly && (
        <>
          <div
            className="
              pointer-events-none
              absolute
              left-[8%]
              top-[7%]
              h-[22%]
              w-[48%]
              -rotate-12
              rounded-full
            "
            style={{
              background:
                strongJelly
                  ? "rgba(255,255,255,0.82)"
                  : "rgba(255,255,255,0.76)",

              filter:
                "blur(0.4px)",
            }}
          />


          <div
            className="
              pointer-events-none
              absolute
              bottom-[8%]
              right-[10%]
              h-[16%]
              w-[16%]
              rounded-full
              border
              border-white/80
            "
            style={{
              background:
                strongJelly
                  ? "rgba(244,114,182,0.78)"
                  : "rgba(103,232,249,0.78)",
            }}
          />


          {strongJelly && (
            <div
              className="
                pointer-events-none
                absolute
                inset-[9%]
                rounded-[22%]
                border-2
                border-white/65
              "
            />
          )}
        </>
      )}


      {getSpecialOverlay(
        piece.special,
      )}

      {piece.special !==
        "NONE" && (
        <div
          className="
            pointer-events-none
            absolute
            inset-[-4%]
            rounded-[inherit]
            border-2
            border-white/50
          "
          style={{
            boxShadow:
              "0 0 12px rgba(255,255,255,0.40)",
          }}
        />
      )}
    </div>
  );
};


/*
 * ============================================================
 * JELLY VISUAL
 * ============================================================
 */

const JellyLayer:
React.FC<{
  layers:
    number;
}> = ({
  layers,
}) => {

  if (
    layers <=
    0
  ) {
    return null;
  }


  const strong =
    layers >=
    2;


  return (
    <div
      className="
        pointer-events-none
        absolute
        inset-[2px]
        z-[8]
        rounded-[22%]
      "
      style={{
        background:
          strong
            ? "linear-gradient(145deg,rgba(251,207,232,0.78),rgba(216,180,254,0.62),rgba(103,232,249,0.50))"
            : "linear-gradient(145deg,rgba(207,250,254,0.92),rgba(165,243,252,0.68),rgba(125,211,252,0.52))",

        border:
          strong
            ? "2px solid rgba(236,72,153,0.85)"
            : "2px solid rgba(6,182,212,0.82)",

        boxShadow:
          strong
            ? "inset 0 0 12px rgba(255,255,255,0.95),0 0 9px rgba(236,72,153,0.55)"
            : "inset 0 0 12px rgba(255,255,255,0.95),0 0 8px rgba(6,182,212,0.50)",
      }}
    />
  );
};


/*
 * ============================================================
 * BLOCKER VISUAL
 * ============================================================
 */

const BlockerLayer:
React.FC<{
  cell:
    CandyCascadeCell;
}> = ({
  cell,
}) => {

  const blocker =
    cell.blocker;


  if (
    blocker.layers <=
      0 ||
    blocker.type ===
      "NONE"
  ) {
    return null;
  }


  if (
    blocker.type ===
    "FROSTING"
  ) {

    return (
      <div
        className="
          pointer-events-none
          absolute
          inset-[5%]
          z-30
          overflow-hidden
          rounded-[22%]
          border-2
          border-white/80
        "
        style={{
          background:
            blocker.layers >=
              2
              ? "linear-gradient(145deg,#ffffff 0%,#d9f7ff 45%,#82dfff 100%)"
              : "linear-gradient(145deg,#ffffff 0%,#e9fbff 62%,#b6edff 100%)",

          boxShadow:
            "0 3px 6px rgba(40,140,180,0.25),inset 0 -3px 5px rgba(30,140,190,0.14)",
        }}
      >
        <div
          className="
            absolute
            left-[12%]
            top-[12%]
            h-[25%]
            w-[38%]
            rounded-full
            bg-white
          "
        />

        {blocker.layers >=
          2 && (
          <div
            className="
              absolute
              inset-[18%]
              rounded-[24%]
              border-2
              border-cyan-300/60
            "
          />
        )}
      </div>
    );
  }


  if (
    blocker.type ===
    "LICORICE"
  ) {

    return (
      <div
        className="
          pointer-events-none
          absolute
          inset-[7%]
          z-30
          flex
          items-center
          justify-center
          rounded-[26%]
        "
        style={{
          background:
            "linear-gradient(145deg,#4b4c59,#151722 72%,#080910)",

          boxShadow:
            "0 4px 7px rgba(0,0,0,0.42),inset 0 2px 3px rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="
            h-[68%]
            w-[68%]
            rounded-full
            border-[5px]
            border-slate-700
          "
          style={{
            boxShadow:
              "inset 0 0 0 3px #090a0f",
          }}
        />

        <div
          className="
            absolute
            h-[18%]
            w-[70%]
            rotate-45
            rounded-full
            bg-slate-700
          "
        />
      </div>
    );
  }


  /*
   * CRATE
   */
  return (
    <div
      className="
        pointer-events-none
        absolute
        inset-[4%]
        z-30
        overflow-hidden
        rounded-[16%]
        border-2
        border-amber-950/40
      "
      style={{
        background:
          blocker.layers >=
            3
            ? "linear-gradient(145deg,#d89a50,#8f4c20)"
            : blocker.layers >=
                2
              ? "linear-gradient(145deg,#e5ae69,#a9602d)"
              : "linear-gradient(145deg,#f1c17e,#bd7337)",

        boxShadow:
          "0 4px 6px rgba(100,45,10,0.30),inset 0 2px 2px rgba(255,255,255,0.22)",
      }}
    >
      <div
        className="
          absolute
          left-[46%]
          top-[-10%]
          h-[120%]
          w-[12%]
          rotate-45
          bg-amber-950/25
        "
      />

      <div
        className="
          absolute
          left-[46%]
          top-[-10%]
          h-[120%]
          w-[12%]
          -rotate-45
          bg-amber-950/25
        "
      />

      {blocker.layers >=
        2 && (
        <div
          className="
            absolute
            inset-[20%]
            rounded-md
            border-2
            border-amber-950/30
          "
        />
      )}
    </div>
  );
};


/*
 * ============================================================
 * DROP ITEM VISUAL
 * ============================================================
 */

const DropItem:
React.FC<{
  cell:
    CandyCascadeCell;
}> = ({
  cell,
}) => {

  const item =
    cell.dropItem;


  if (
    !item
  ) {
    return null;
  }


  if (
    item.type ===
    "STAR"
  ) {

    return (
      <div
        className="
          pointer-events-none
          absolute
          inset-[10%]
          z-20
          flex
          items-center
          justify-center
          text-[clamp(18px,6vw,38px)]
          drop-shadow-lg
        "
      >
        ⭐
      </div>
    );
  }


  if (
    item.type ===
    "GEM"
  ) {

    return (
      <div
        className="
          pointer-events-none
          absolute
          inset-[18%]
          z-20
          rotate-45
          rounded-[22%]
          border-2
          border-white/70
        "
        style={{
          background:
            "linear-gradient(145deg,#bffcff,#42d9ff 48%,#2b6cff 100%)",

          boxShadow:
            "0 0 12px rgba(40,200,255,0.55),inset 0 2px 4px rgba(255,255,255,0.65)",
        }}
      >
        <span
          className="
            absolute
            left-[15%]
            top-[12%]
            h-[22%]
            w-[38%]
            rounded-full
            bg-white/60
          "
        />
      </div>
    );
  }


  return (
    <div
      className="
        pointer-events-none
        absolute
        inset-[12%]
        z-20
        flex
        items-center
        justify-center
        text-[clamp(18px,6vw,38px)]
        drop-shadow-lg
      "
    >
      🍒
    </div>
  );
};
/*
 * ============================================================
 * SINGLE BOARD CELL
 * ============================================================
 */

interface BoardCellProps {
  cell:
    CandyCascadeCell;

  selected:
    boolean;

  hinted:
    boolean;

  highlighted:
    boolean;

  blast:
    boolean;

  removing:
    boolean;

  falling:
    boolean;

  shuffling:
  boolean;

swapTransform:
  string |
  null;

disabled:
  boolean;

  onPointerDown:
    (
      point:
        CandyCascadePoint,

      event:
        React.PointerEvent<HTMLButtonElement>,
    ) =>
      void;

  onPointerUp:
    (
      point:
        CandyCascadePoint,

      event:
        React.PointerEvent<HTMLButtonElement>,
    ) =>
      void;

  onPointerCancel:
    (
      event:
        React.PointerEvent<HTMLButtonElement>,
    ) =>
      void;

  onKeyboardActivate:
    (
      point:
        CandyCascadePoint,
    ) =>
      void;
}


const canInteractWithCell =
  (
    cell:
      CandyCascadeCell,
  ) => {

    if (
      !cell.active ||
      (
        !cell.piece &&
        !cell.dropItem
      )
    ) {
      return false;
    }


    if (
      cell.blocker.layers >
        0 &&
      (
        cell.blocker.type ===
          "LICORICE" ||
        cell.blocker.type ===
          "CRATE"
      )
    ) {
      return false;
    }


    return true;
  };


const BoardCell:
React.FC<
  BoardCellProps
> = ({
  cell,
  selected,
  hinted,
  highlighted,
  blast,
  removing,
  falling,

shuffling,

swapTransform,

disabled,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onKeyboardActivate,
}) => {

  const point:
    CandyCascadePoint = {
    row:
      cell.row,

    col:
      cell.col,
  };


  /*
   * Inactive cells remain inside the 9 × 9 grid,
   * but are completely transparent.
   *
   * This is how shaped boards keep correct alignment.
   */
  if (
    !cell.active
  ) {

    return (
  <div
    aria-hidden="true"
    className="
      relative
      h-full
      w-full
      min-h-0
      min-w-0
      pointer-events-none
    "
  />
);
  }


  const interactable =
    canInteractWithCell(
      cell,
    );


  return (
    <button
      type="button"
      aria-label={
        `Candy Cascade row ${
          cell.row +
          1
        }, column ${
          cell.col +
          1
        }`
      }
      disabled={
        disabled ||
        !interactable
      }
      onPointerDown={
        event =>
          onPointerDown(
            point,
            event,
          )
      }
      onPointerUp={
        event =>
          onPointerUp(
            point,
            event,
          )
      }
      onPointerCancel={
        onPointerCancel
      }
      onKeyDown={
        event => {

          if (
            disabled ||
            !interactable
          ) {
            return;
          }


          if (
            event.key ===
              "Enter" ||
            event.key ===
              " "
          ) {

            event.preventDefault();


            onKeyboardActivate(
              point,
            );
          }
        }
      }
      className={`
  relative
  h-full
  w-full
  min-h-0
  min-w-0
  overflow-visible
  rounded-[20%]
  outline-none
        transition-transform
        duration-150
        touch-none
        select-none

        ${
          disabled ||
          !interactable
            ? "cursor-default"
            : "cursor-pointer active:scale-[0.94]"
        }

        ${
          selected
            ? "z-40"
            : "z-10"
        }

        ${
          shuffling
            ? "animate-[pulse_0.38s_ease-in-out_2]"
            : ""
        }
      `}
      style={{
  WebkitTapHighlightColor:
    "transparent",

  touchAction:
    "none",

  userSelect:
    "none",

  display:
    "block",

  width:
    "100%",

  height:
    "100%",

  minWidth:
    0,

  minHeight:
    0,

  padding:
    0,

  margin:
    0,

  border:
    0,

  background:
    "transparent",

  alignSelf:
    "stretch",

  justifySelf:
    "stretch",

  appearance:
    "none",
}}
    >
      {/*
       * Board socket.
       */}
      <div
        className="
          pointer-events-none
          absolute
          inset-[2px]
          rounded-[20%]
          border
          border-white/25
          bg-white/20
          dark:border-white/10
          dark:bg-slate-800/38
        "
        style={{
  position:
    "absolute",

  top:
    2,

  right:
    2,

  bottom:
    2,

  left:
    2,

  boxShadow:
    "inset 0 2px 4px rgba(255,255,255,0.16), inset 0 -2px 4px rgba(0,0,0,0.08)",
}}
      />


      {/*
       * Drop exit marker.
       */}
      {cell.isDropExit && (
        <div
          className="
            pointer-events-none
            absolute
            bottom-[1px]
            left-[16%]
            right-[16%]
            z-[5]
            h-[9%]
            rounded-full
            bg-cyan-400/80
            shadow-[0_0_8px_rgba(34,211,238,0.75)]
          "
        />
      )}


      <JellyLayer
        layers={
          cell.jellyLayers
        }
      />


      <div
  className="
    pointer-events-none
    absolute
    inset-0
    z-20
  "
  style={{
    transform:
      swapTransform ??
      "translate3d(0, 0, 0)",

    transition:
      "transform 150ms cubic-bezier(0.22, 0.8, 0.32, 1)",

    animation:
      blast &&
      removing
        ? "cc-candy-blast 220ms ease-out forwards"
        : removing
          ? "cc-candy-pop 190ms ease-out forwards"
          : falling
            ? "cc-candy-fall 220ms cubic-bezier(0.20, 0.85, 0.30, 1.15) both"
            : undefined,

    willChange:
      "transform, opacity",
  }}
>
  <CandyPiece
    cell={
      cell
    }
    selected={
      selected
    }
    hinted={
      hinted
    }
    removing={
      false
    }
    falling={
      false
    }
  />


  <DropItem
    cell={
      cell
    }
  />
</div>


      <BlockerLayer
        cell={
          cell
        }
      />


      {/*
       * Selected piece ring.
       */}
      {selected && (
        <div
          className="
            pointer-events-none
            absolute
            inset-[-2px]
            z-50
            rounded-[22%]
            border-[3px]
            border-orange-300
          "
          style={{
            boxShadow:
              "0 0 14px rgba(251,146,60,0.75), inset 0 0 8px rgba(255,255,255,0.40)",
          }}
        />
      )}


      {/*
       * Idle hint.
       */}
      {hinted &&
        !selected && (
        <div
          className="
            pointer-events-none
            absolute
            inset-[-1px]
            z-40
            animate-pulse
            rounded-[22%]
            border-2
            border-yellow-300/90
          "
          style={{
            boxShadow:
              "0 0 12px rgba(253,224,71,0.60)",
          }}
        />
      )}


      {/*
       * Cascade highlight.
       */}
      {highlighted && (
        <div
          className="
            pointer-events-none
            absolute
            inset-[3px]
            z-40
            rounded-[20%]
            bg-white/18
          "
          style={{
            boxShadow:
              "inset 0 0 14px rgba(255,255,255,0.85),0 0 8px rgba(255,255,255,0.45)",
          }}
        />
      )}


      {/*
       * Special / combo blast.
       */}
      {blast && (
        <div
          className="
            pointer-events-none
            absolute
            -inset-[12%]
            z-[60]
            animate-ping
            rounded-full
            border-2
            border-yellow-200/90
            bg-yellow-200/25
          "
        />
      )}
    </button>
  );
};


/*
 * ============================================================
 * MAIN BOARD COMPONENT
 * ============================================================
 */

export const CandyCascadeBoard:
React.FC<
  CandyCascadeBoardProps
> = ({
  state,
  disabled =
    false,
  busy =
    false,
  hint =
    null,
  visualState,
  onSwap,
}) => {

  const boardHostRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );


  const pointerStartRef =
    useRef<
      PointerStartState |
      null
    >(
      null,
    );


  const swapInFlightRef =
    useRef(
      false,
    );


  const [
    boardSize,
    setBoardSize,
  ] =
    useState(
      320,
    );


  const [
    selected,
    setSelected,
  ] =
    useState<
      CandyCascadePoint |
      null
    >(
      null,
    );


  /*
   * ==========================================================
   * BOARD MEASUREMENT
   * ==========================================================
   *
   * Measure the real rendered host.
   *
   * Do NOT rely only on:
   *
   * window.innerWidth
   * visualViewport.width
   *
   * Rewarded ads can temporarily leave Android WebView with
   * stale viewport measurements.
   */

  useEffect(() => {

    const host =
      boardHostRef.current;


    if (
      !host
    ) {
      return;
    }


    let disposed =
      false;


    const timerIds:
      number[] =
      [];


    const frameIds:
      number[] =
      [];


    const measure =
      () => {

        if (
          disposed
        ) {
          return;
        }


        const rect =
          host.getBoundingClientRect();


        const width =
          Math.max(
            host.clientWidth,
            rect.width,
          );


        const height =
          Math.max(
            host.clientHeight,
            rect.height,
          );


        const availableWidth =
          Math.max(
            0,
            width -
              4,
          );


        const availableHeight =
          Math.max(
            0,
            height -
              4,
          );


        const nextSize =
          Math.floor(
            Math.min(
              availableWidth,
              availableHeight,
              620,
            ),
          );


        if (
          nextSize <
          180
        ) {
          return;
        }


        setBoardSize(
          previous =>
            previous ===
              nextSize
              ? previous
              : nextSize,
        );
      };


    const queueFrame =
      () => {

        const frameId =
          window.requestAnimationFrame(
            measure,
          );


        frameIds.push(
          frameId,
        );
      };


    const queueDelayed =
      (
        delay:
          number,
      ) => {

        const timerId =
          window.setTimeout(
            () => {

              measure();

              queueFrame();
            },
            delay,
          );


        timerIds.push(
          timerId,
        );
      };


    measure();

    queueFrame();


    /*
     * Re-measure after the stages where Android WebView
     * commonly settles after a full-screen rewarded ad.
     */
    [
      60,
      180,
      350,
      700,
      1200,
    ].forEach(
      queueDelayed,
    );


    const resizeObserver =
      typeof ResizeObserver !==
        "undefined"
        ? new ResizeObserver(
            () => {

              measure();
            },
          )
        : null;


    resizeObserver?.observe(
      host,
    );


    const handleWindowResize =
      () => {

        measure();

        queueFrame();
      };


    const handleVisibility =
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          measure();

          queueFrame();

          queueDelayed(
            120,
          );

          queueDelayed(
            350,
          );
        }
      };


    window.addEventListener(
      "resize",
      handleWindowResize,
    );


    window.addEventListener(
      "orientationchange",
      handleWindowResize,
    );


    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );


    return () => {

      disposed =
        true;


      resizeObserver?.disconnect();


      timerIds.forEach(
        timerId =>
          window.clearTimeout(
            timerId,
          ),
      );


      frameIds.forEach(
        frameId =>
          window.cancelAnimationFrame(
            frameId,
          ),
      );


      window.removeEventListener(
        "resize",
        handleWindowResize,
      );


      window.removeEventListener(
        "orientationchange",
        handleWindowResize,
      );


      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };

  }, []);


/*
 * ============================================================
 * VISUAL LOOKUP SETS
 * ============================================================
 */

  const highlightedKeys =
    useMemo(
      () =>
        new Set(
          (
            visualState
              ?.highlightedCells ??
            []
          ).map(
            pointKey,
          ),
        ),
      [
        visualState
          ?.highlightedCells,
      ],
    );


  const blastKeys =
    useMemo(
      () =>
        new Set(
          (
            visualState
              ?.blastCells ??
            []
          ).map(
            pointKey,
          ),
        ),
      [
        visualState
          ?.blastCells,
      ],
    );


  const phase =
    visualState
      ?.phase ??
    "IDLE";


/*
 * ============================================================
 * KEEP SELECTION VALID
 * ============================================================
 */

  useEffect(() => {

    if (
      !selected
    ) {
      return;
    }


    const cell =
      state.board[
        selected.row
      ]?.[
        selected.col
      ];


    if (
      !cell ||
      !canInteractWithCell(
        cell,
      )
    ) {

      setSelected(
        null,
      );
    }

  }, [
    state.board,
    selected,
  ]);


/*
 * ============================================================
 * EXECUTE SWAP
 * ============================================================
 */

  const executeSwap =
    useCallback(
      async (
        from:
          CandyCascadePoint,

        to:
          CandyCascadePoint,
      ) => {

        if (
          disabled ||
          busy ||
          swapInFlightRef.current ||
          !insideBoard(
            from,
          ) ||
          !insideBoard(
            to,
          ) ||
          !areAdjacent(
            from,
            to,
          )
        ) {
          return;
        }


        const firstCell =
          state.board[
            from.row
          ]?.[
            from.col
          ];


        const secondCell =
          state.board[
            to.row
          ]?.[
            to.col
          ];


        if (
          !firstCell ||
          !secondCell ||
          !canInteractWithCell(
            firstCell,
          ) ||
          !canInteractWithCell(
            secondCell,
          )
        ) {
          return;
        }


        swapInFlightRef.current =
          true;


        setSelected(
          null,
        );


        try {

          await onSwap(
            from,
            to,
          );

        } finally {

          swapInFlightRef.current =
            false;
        }
      },
      [
        busy,
        disabled,
        onSwap,
        state.board,
      ],
    );


/*
 * ============================================================
 * TAP HANDLING
 * ============================================================
 */

  const handleTap =
    useCallback(
      (
        point:
          CandyCascadePoint,
      ) => {

        if (
          disabled ||
          busy ||
          swapInFlightRef.current
        ) {
          return;
        }


        const cell =
          state.board[
            point.row
          ]?.[
            point.col
          ];


        if (
          !cell ||
          !canInteractWithCell(
            cell,
          )
        ) {
          return;
        }


        if (
          !selected
        ) {

          setSelected(
            point,
          );


          return;
        }


        if (
          samePoint(
            selected,
            point,
          )
        ) {

          setSelected(
            null,
          );


          return;
        }


        if (
          areAdjacent(
            selected,
            point,
          )
        ) {

          void executeSwap(
            selected,
            point,
          );


          return;
        }


        /*
         * Tapping another non-adjacent piece simply moves
         * the selection to that piece.
         */
        setSelected(
          point,
        );
      },
      [
        busy,
        disabled,
        executeSwap,
        selected,
        state.board,
      ],
    );


/*
 * ============================================================
 * POINTER START
 * ============================================================
 */

  const handlePointerDown =
    useCallback(
      (
        point:
          CandyCascadePoint,

        event:
          React.PointerEvent<HTMLButtonElement>,
      ) => {

        if (
          disabled ||
          busy ||
          swapInFlightRef.current
        ) {
          return;
        }


        const cell =
          state.board[
            point.row
          ]?.[
            point.col
          ];


        if (
          !cell ||
          !canInteractWithCell(
            cell,
          )
        ) {
          return;
        }


        event.preventDefault();


        try {

          event.currentTarget.setPointerCapture(
            event.pointerId,
          );

        } catch {

          /*
           * Pointer capture can fail on some old WebViews.
           * Swipe handling still works without crashing.
           */
        }


        pointerStartRef.current = {
          point,

          x:
            event.clientX,

          y:
            event.clientY,

          pointerId:
            event.pointerId,
        };


        /*
         * Highlight immediately so the interaction feels
         * responsive even before pointer-up.
         */
        setSelected(
          point,
        );
      },
      [
        busy,
        disabled,
        state.board,
      ],
    );


/*
 * ============================================================
 * POINTER END / SWIPE
 * ============================================================
 */

  const handlePointerUp =
    useCallback(
      (
        point:
          CandyCascadePoint,

        event:
          React.PointerEvent<HTMLButtonElement>,
      ) => {

        event.preventDefault();


        const start =
          pointerStartRef.current;


        pointerStartRef.current =
          null;


        if (
          !start ||
          start.pointerId !==
            event.pointerId ||
          disabled ||
          busy ||
          swapInFlightRef.current
        ) {
          return;
        }


        const dx =
          event.clientX -
          start.x;


        const dy =
          event.clientY -
          start.y;


        const horizontal =
          Math.abs(
            dx,
          ) >
          Math.abs(
            dy,
          );


        let target:
          CandyCascadePoint |
          null =
          null;


        if (
          horizontal &&
          Math.abs(
            dx,
          ) >=
            SWIPE_THRESHOLD_PX
        ) {

          target = {
            row:
              start.point.row,

            col:
              start.point.col +
              (
                dx >
                  0
                  ? 1
                  : -1
              ),
          };

        } else if (
          !horizontal &&
          Math.abs(
            dy,
          ) >=
            SWIPE_THRESHOLD_PX
        ) {

          target = {
            row:
              start.point.row +
              (
                dy >
                  0
                  ? 1
                  : -1
              ),

            col:
              start.point.col,
          };
        }


        if (
          target &&
          insideBoard(
            target,
          )
        ) {

          const targetCell =
            state.board[
              target.row
            ]?.[
              target.col
            ];


          if (
            targetCell &&
            canInteractWithCell(
              targetCell,
            )
          ) {

            void executeSwap(
              start.point,
              target,
            );


            return;
          }
        }


        /*
         * Movement below threshold = normal tap.
         */
        if (
          Math.abs(
            dx,
          ) <
            SWIPE_THRESHOLD_PX &&
          Math.abs(
            dy,
          ) <
            SWIPE_THRESHOLD_PX
        ) {

          handleTap(
            point,
          );
        }
      },
      [
        busy,
        disabled,
        executeSwap,
        handleTap,
        state.board,
      ],
    );


  const handlePointerCancel =
    useCallback(
      (
        _event:
          React.PointerEvent<HTMLButtonElement>,
      ) => {

        pointerStartRef.current =
          null;
      },
      [],
    );


/*
 * ============================================================
 * DISABLED STATE
 * ============================================================
 */

  const boardDisabled =

  disabled ||
  busy ||
  swapInFlightRef.current;



/*
 * ============================================================
 * RENDER
 * ============================================================
 */

  return (
  <div
    ref={
      boardHostRef
    }
      className="
  relative
  flex
  h-full
  min-h-[220px]
  w-full
  min-w-0
  items-start
  justify-center
  overflow-hidden
  pt-3
  touch-none
  select-none
"
      style={{
        touchAction:
          "none",

        overscrollBehavior:
          "none",

        userSelect:
          "none",
      }}
    >
      <style>
        {`
          @keyframes cc-candy-pop {
            0% {
              transform: scale(1);
              opacity: 1;
            }

            42% {
              transform: scale(1.22);
              opacity: 1;
            }

            100% {
              transform: scale(0.16);
              opacity: 0;
            }
          }


          @keyframes cc-candy-blast {
            0% {
              transform: scale(1);
              opacity: 1;
              filter: brightness(1);
            }

            35% {
              transform: scale(1.30);
              opacity: 1;
              filter: brightness(1.9);
            }

            65% {
              transform: scale(1.12);
              opacity: 0.9;
              filter: brightness(2.4);
            }

            100% {
              transform: scale(0.10);
              opacity: 0;
              filter: brightness(2.8);
            }
          }


          @keyframes cc-candy-fall {
            0% {
              transform: translate3d(0, -72%, 0);
              opacity: 0.15;
            }

            65% {
              transform: translate3d(0, 10%, 0);
              opacity: 1;
            }

            82% {
              transform: translate3d(0, -4%, 0);
              opacity: 1;
            }

            100% {
              transform: translate3d(0, 0, 0);
              opacity: 1;
            }
          }
        `}
      </style>


      <div
        className="
          relative
          shrink-0
          overflow-visible
          rounded-[28px]
          border
          border-white/40
          bg-gradient-to-br
          from-fuchsia-200/55
          via-violet-100/45
          to-cyan-100/55
          p-[5px]
          shadow-[0_14px_40px_rgba(90,50,170,0.22)]
          dark:border-white/10
          dark:from-fuchsia-950/35
          dark:via-violet-950/25
          dark:to-cyan-950/25
        "
        style={{
          width:
            boardSize,

          height:
            boardSize,

          touchAction:
            "none",
        }}
      >
        {/*
         * Soft GenZ glow behind cells.
         */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            overflow-hidden
            rounded-[26px]
          "
        >
          <div
            className="
              absolute
              -left-[18%]
              -top-[18%]
              h-[52%]
              w-[52%]
              rounded-full
              bg-fuchsia-400/15
              blur-3xl
            "
          />

          <div
            className="
              -right-[16%]
              absolute
              bottom-[-18%]
              h-[55%]
              w-[55%]
              rounded-full
              bg-cyan-400/15
              blur-3xl
            "
          />
        </div>


        <div
          className="
            relative
            z-10
            grid
            h-full
            w-full
          "
          style={{
            gridTemplateColumns:
              `repeat(${CANDY_CASCADE_COLUMNS}, minmax(0, 1fr))`,

            gridTemplateRows:
              `repeat(${CANDY_CASCADE_ROWS}, minmax(0, 1fr))`,

            gap:
              `${CELL_GAP_PX}px`,

            touchAction:
              "none",
          }}
        >
          {state.board.map(
            (
              row,
            ) =>
              row.map(
                cell => {

                  const point = {
                    row:
                      cell.row,

                    col:
                      cell.col,
                  };


                  const key =
                    pointKey(
                      point,
                    );


                  const isSelected =
                    samePoint(
                      selected,
                      point,
                    );


                  const isHinted =
                    Boolean(
                      hint &&
                      (
                        samePoint(
                          hint.from,
                          point,
                        ) ||
                        samePoint(
                          hint.to,
                          point,
                        )
                      ),
                    );


                  const highlighted =
                    highlightedKeys.has(
                      key,
                    );


                  const blast =
                    blastKeys.has(
                      key,
                    );


                  const removing =
                    phase ===
                      "REMOVE" &&
                    (
                      highlighted ||
                      blast
                    );


                  const falling =
                    phase ===
                      "FALL" &&
                    cell.active &&
                    Boolean(
                      cell.piece ||
                      cell.dropItem,
                    );

                    const swapTransform =
  getSwapTransform(
    point,
    phase,
    visualState
      ?.highlightedCells,
  );


                  return (
                    <BoardCell
                      key={
                        key
                      }
                      cell={
                        cell
                      }
                      selected={
                        isSelected
                      }
                      hinted={
                        isHinted
                      }
                      highlighted={
                        highlighted
                      }
                      blast={
                        blast
                      }
                      removing={
                        removing
                      }
                      falling={
                        falling
                      }
                      shuffling={
  phase ===
  "SHUFFLE"
}
swapTransform={
  swapTransform
}
disabled={
  boardDisabled
}
                      onPointerDown={
                        handlePointerDown
                      }
                      onPointerUp={
                        handlePointerUp
                      }
                      onPointerCancel={
                        handlePointerCancel
                      }
                      onKeyboardActivate={
                        handleTap
                      }
                    />
                  );
                },
              ),
          )}
        </div>


        {/*
         * Busy / cascade interaction shield.
         *
         * Important:
         *
         * This blocks accidental second swaps while the page
         * is animating an already accepted move.
         */}
        {boardDisabled && (
          <div
            className="
              absolute
              inset-0
              z-[100]
              rounded-[28px]
            "
            style={{
              touchAction:
                "none",

              background:
                busy
                  ? "rgba(255,255,255,0.015)"
                  : "transparent",
            }}
          />
        )}
      </div>
    </div>
  );
};


export default CandyCascadeBoard;