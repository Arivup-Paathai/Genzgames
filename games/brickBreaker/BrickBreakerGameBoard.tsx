import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BRICK_BREAKER_FIXED_SCALE,
  BRICK_BREAKER_GAME_HEIGHT,
  BRICK_BREAKER_GAME_WIDTH,
  BRICK_BREAKER_PADDLE_INPUT_QUANTUM,
} from "./brickBreakerConstants";

import {
  brickBreakerFixedToVisual,
  brickBreakerPointerToEngineX,
} from "./brickBreakerEngine";

import type {
  BrickBreakerGameState,
} from "./brickBreakerTypes";


/*
 * =========================================================
 * GENZGAMES - BRICK BREAKER GAME BOARD
 * =========================================================
 *
 * IMPORTANT RESPONSIVE RULE:
 *
 * The deterministic game world is ALWAYS:
 *
 * 400 × 700 logical visual units.
 *
 * Small phones DO NOT:
 *
 * - move bricks downward
 * - move paddle upward
 * - shrink brick/paddle spacing independently
 * - change collision coordinates
 *
 * Instead the COMPLETE board scales uniformly.
 *
 * Therefore:
 *
 * Large phone:
 *
 * 400 × 700 -> large physical board
 *
 * Small phone:
 *
 * 400 × 700 -> smaller physical board
 *
 * Physics remain identical.
 */


/*
 * =========================================================
 * PROPS
 * =========================================================
 */

interface BrickBreakerGameBoardProps {
  state:
    BrickBreakerGameState;

  /*
   * False while:
   *
   * - paused
   * - verifying reward
   * - game over overlay
   * - level-clear overlay
   */
  interactionEnabled?:
    boolean;

  /*
   * Receives deterministic FIXED-POINT paddle
   * center X.
   *
   * Parent page records this against the
   * current game tick.
   */
  onPaddleCenterChange: (
    centerX:
      number,
  ) => void;

  /*
   * Parent records a LAUNCH event using the
   * current deterministic game tick.
   */
  onLaunch:
    () => void;

  className?:
    string;
}


/*
 * =========================================================
 * BOARD DIMENSIONS
 * =========================================================
 */

const BOARD_VISUAL_WIDTH =
  BRICK_BREAKER_GAME_WIDTH /
  BRICK_BREAKER_FIXED_SCALE;


const BOARD_VISUAL_HEIGHT =
  BRICK_BREAKER_GAME_HEIGHT /
  BRICK_BREAKER_FIXED_SCALE;


const BOARD_ASPECT_RATIO =
  BOARD_VISUAL_WIDTH /
  BOARD_VISUAL_HEIGHT;


/*
 * Minimum movement in physical pixels before
 * a pointer gesture is considered a drag
 * instead of a tap.
 *
 * Tap:
 * → launch ball
 *
 * Drag:
 * → only move paddle
 */
const TAP_MOVE_THRESHOLD_PX =
  9;


/*
 * Keyboard paddle movement.
 *
 * 20 visual game units.
 */
const KEYBOARD_MOVE_STEP =
  20 *
  BRICK_BREAKER_FIXED_SCALE;


/*
 * =========================================================
 * SMALL HELPERS
 * =========================================================
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


const quantizePaddleX =
  (
    centerX:
      number,
  ) => {

    const quantized =
      Math.round(
        centerX /
        BRICK_BREAKER_PADDLE_INPUT_QUANTUM,
      ) *
      BRICK_BREAKER_PADDLE_INPUT_QUANTUM;


    return clamp(
      quantized,
      0,
      BRICK_BREAKER_GAME_WIDTH,
    );
  };


const formatVisual =
  (
    value:
      number,
  ) =>
    brickBreakerFixedToVisual(
      value,
    );


/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export const BrickBreakerGameBoard:
React.FC<
  BrickBreakerGameBoardProps
> = ({
  state,
  interactionEnabled =
    true,
  onPaddleCenterChange,
  onLaunch,
  className =
    "",
}) => {

  /*
   * Outer host:
   *
   * receives whatever space the gameplay page
   * can safely provide after:
   *
   * - safe area
   * - compact HUD
   * - header
   *
   * Banner is hidden during actual gameplay.
   */
  const hostRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );


  /*
   * Exact physical board rectangle.
   */
  const boardRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );


  const activePointerIdRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const pointerStartRef =
    useRef<{
      x:
        number;

      y:
        number;
    } | null>(
      null,
    );


  /*
   * Prevent repeated identical pointer positions
   * from being sent to the parent.
   */
  const lastSentPaddleXRef =
    useRef<
      number |
      null
    >(
      null,
    );


  /*
   * Reasonable first-paint fallback.
   *
   * ResizeObserver immediately replaces this with
   * the real host dimensions after layout.
   */
  const [
    renderSize,
    setRenderSize,
  ] =
    useState(
      () => {

        const viewportWidth =
          typeof window !==
          "undefined"
            ? window.innerWidth
            : 360;


        const width =
          Math.max(
            120,

            Math.min(
              viewportWidth -
                24,
              340,
            ),
          );


        return {
          width,

          height:
            width /
            BOARD_ASPECT_RATIO,
        };
      },
    );


  /*
   * Reset pointer dedupe when moving to another
   * level.
   */
  useEffect(
    () => {

      lastSentPaddleXRef.current =
        null;

    },
    [
      state.levelId,
    ],
  );


  /*
   * =====================================================
   * REAL AVAILABLE-SIZE MEASUREMENT
   * =====================================================
   *
   * This is intentionally based on the actual host.
   *
   * We DO NOT use visualViewport.width for game sizing.
   *
   * Android can temporarily report stale viewport
   * dimensions after closing a rewarded ad.
   *
   * Width AND height are considered.
   *
   * This is what protects:
   *
   * - small phones
   * - short phones
   * - navigation-button phones
   * - gesture-navigation phones
   * - orientation changes
   * - return from rewarded ads
   */

  useLayoutEffect(
    () => {

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


          const host =
            hostRef.current;


          if (
            !host
          ) {
            return;
          }


          const rect =
            host
              .getBoundingClientRect();


          const hostWidth =
            Math.max(
              host.clientWidth,
              rect.width,
            );


          const hostHeight =
            Math.max(
              host.clientHeight,
              rect.height,
            );


          /*
           * Tiny safety margin prevents glow/border
           * clipping against the host.
           */
          const availableWidth =
            Math.max(
              0,
              hostWidth -
                4,
            );


          const availableHeight =
            Math.max(
              0,
              hostHeight -
                4,
            );


          if (
            availableWidth <
              40 ||
            availableHeight <
              70
          ) {
            return;
          }


          /*
           * Start width-constrained.
           */
          let width =
            availableWidth;


          let height =
            width /
            BOARD_ASPECT_RATIO;


          /*
           * Short device:
           *
           * height becomes the limiting dimension.
           *
           * Scale the entire board down uniformly.
           */
          if (
            height >
            availableHeight
          ) {

            height =
              availableHeight;


            width =
              height *
              BOARD_ASPECT_RATIO;
          }


          width =
            Math.floor(
              width,
            );


          height =
            Math.floor(
              height,
            );


          setRenderSize(
            previous => {

              if (
                Math.abs(
                  previous.width -
                    width,
                ) <
                  1 &&
                Math.abs(
                  previous.height -
                    height,
                ) <
                  1
              ) {
                return previous;
              }


              return {
                width,

                height,
              };
            },
          );
        };


      const queueFrame =
        () => {

          const frameId =
            window
              .requestAnimationFrame(
                () => {

                  measure();
                },
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


      /*
       * Immediate layout.
       */
      measure();


      /*
       * First browser paint.
       */
      queueFrame();


      /*
       * Android WebView / rewarded-ad return can
       * settle through several layout passes.
       */
      queueDelayed(
        60,
      );

      queueDelayed(
        180,
      );

      queueDelayed(
        350,
      );

      queueDelayed(
        700,
      );

      queueDelayed(
        1200,
      );


      const observer =
        typeof ResizeObserver !==
        "undefined"
          ? new ResizeObserver(
              () => {

                measure();
              },
            )
          : null;


      const observedHost =
        hostRef.current;


      if (
        observedHost
      ) {

        observer?.observe(
          observedHost,
        );
      }


      const handleResize =
        () => {

          measure();

          queueFrame();
        };


      const handleVisibility =
        () => {

          if (
            document
              .visibilityState !==
            "visible"
          ) {
            return;
          }


          /*
           * Common after:
           *
           * rewarded ad closes
           * app returns to foreground
           */
          measure();


          queueDelayed(
            80,
          );


          queueDelayed(
            250,
          );
        };


      window.addEventListener(
        "resize",
        handleResize,
      );


      window.addEventListener(
        "orientationchange",
        handleResize,
      );


      document.addEventListener(
        "visibilitychange",
        handleVisibility,
      );


      return () => {

        disposed =
          true;


        observer?.disconnect();


        window.removeEventListener(
          "resize",
          handleResize,
        );


        window.removeEventListener(
          "orientationchange",
          handleResize,
        );


        document.removeEventListener(
          "visibilitychange",
          handleVisibility,
        );


        for (
          const timerId of
          timerIds
        ) {

          window.clearTimeout(
            timerId,
          );
        }


        for (
          const frameId of
          frameIds
        ) {

          window.cancelAnimationFrame(
            frameId,
          );
        }
      };

    },
    [],
  );


  /*
   * =====================================================
   * POINTER -> DETERMINISTIC PADDLE POSITION
   * =====================================================
   */

  const sendPaddlePosition =
    useCallback(
      (
        clientX:
          number,
      ) => {

        if (
          !interactionEnabled
        ) {
          return;
        }


        const board =
          boardRef.current;


        if (
          !board
        ) {
          return;
        }


        const rect =
          board
            .getBoundingClientRect();


        if (
          rect.width <=
          0
        ) {
          return;
        }


        const rawCenterX =
          brickBreakerPointerToEngineX(
            clientX,
            rect.left,
            rect.width,
          );


        const centerX =
          quantizePaddleX(
            rawCenterX,
          );


        if (
          lastSentPaddleXRef
            .current ===
          centerX
        ) {
          return;
        }


        lastSentPaddleXRef.current =
          centerX;


        onPaddleCenterChange(
          centerX,
        );
      },
      [
        interactionEnabled,
        onPaddleCenterChange,
      ],
    );


  /*
   * =====================================================
   * POINTER CONTROLS
   * =====================================================
   *
   * User does NOT need to touch the paddle.
   *
   * Drag anywhere across the board.
   *
   * This keeps the finger comfortably above the
   * phone bottom edge.
   */

  const handlePointerDown =
    (
      event:
        React.PointerEvent<HTMLDivElement>,
    ) => {

      if (
        !interactionEnabled
      ) {
        return;
      }


      event.preventDefault();


      activePointerIdRef.current =
        event.pointerId;


      pointerStartRef.current = {
        x:
          event.clientX,

        y:
          event.clientY,
      };


      try {

        event.currentTarget
          .setPointerCapture(
            event.pointerId,
          );

      } catch {
        // Some WebViews may already own capture.
      }


      /*
       * Makes keyboard controls immediately usable
       * after touching/clicking the game.
       */
      event.currentTarget
        .focus({
          preventScroll:
            true,
        });


      sendPaddlePosition(
        event.clientX,
      );
    };


  const handlePointerMove =
    (
      event:
        React.PointerEvent<HTMLDivElement>,
    ) => {

      if (
        !interactionEnabled ||
        activePointerIdRef.current !==
          event.pointerId
      ) {
        return;
      }


      event.preventDefault();


      sendPaddlePosition(
        event.clientX,
      );
    };


  const finishPointer =
    (
      event:
        React.PointerEvent<HTMLDivElement>,

      allowLaunch:
        boolean,
    ) => {

      if (
        activePointerIdRef.current !==
        event.pointerId
      ) {
        return;
      }


      event.preventDefault();


      sendPaddlePosition(
        event.clientX,
      );


      const start =
        pointerStartRef.current;


      activePointerIdRef.current =
        null;


      pointerStartRef.current =
        null;


      try {

        if (
          event.currentTarget
            .hasPointerCapture(
              event.pointerId,
            )
        ) {

          event.currentTarget
            .releasePointerCapture(
              event.pointerId,
            );
        }

      } catch {
        // Ignore capture cleanup errors.
      }


      if (
        !allowLaunch ||
        !interactionEnabled ||
        !start ||
        state.ballLaunched ||
        state.isPaused ||
        state.isGameOver ||
        state.isLevelCleared
      ) {
        return;
      }


      const dx =
        event.clientX -
        start.x;


      const dy =
        event.clientY -
        start.y;


      const distance =
        Math.hypot(
          dx,
          dy,
        );


      /*
       * Simple tap:
       *
       * launch.
       *
       * Drag:
       *
       * move paddle only.
       */
      if (
        distance <=
        TAP_MOVE_THRESHOLD_PX
      ) {

        onLaunch();
      }
    };


  const handlePointerUp =
    (
      event:
        React.PointerEvent<HTMLDivElement>,
    ) => {

      finishPointer(
        event,
        true,
      );
    };


  const handlePointerCancel =
    (
      event:
        React.PointerEvent<HTMLDivElement>,
    ) => {

      finishPointer(
        event,
        false,
      );
    };


  /*
   * =====================================================
   * KEYBOARD CONTROLS
   * =====================================================
   */

  const handleKeyDown =
    (
      event:
        React.KeyboardEvent<HTMLDivElement>,
    ) => {

      if (
        !interactionEnabled
      ) {
        return;
      }


      const currentCenter =
        state.paddle.x +
        state.paddle.width /
          2;


      if (
        event.key ===
        "ArrowLeft"
      ) {

        event.preventDefault();


        onPaddleCenterChange(
          quantizePaddleX(
            currentCenter -
              KEYBOARD_MOVE_STEP,
          ),
        );


        return;
      }


      if (
        event.key ===
        "ArrowRight"
      ) {

        event.preventDefault();


        onPaddleCenterChange(
          quantizePaddleX(
            currentCenter +
              KEYBOARD_MOVE_STEP,
          ),
        );


        return;
      }


      if (
        (
          event.key ===
            " " ||
          event.key ===
            "Enter"
        ) &&
        !state.ballLaunched &&
        !state.isPaused &&
        !state.isGameOver &&
        !state.isLevelCleared
      ) {

        event.preventDefault();


        onLaunch();
      }
    };


  /*
   * =====================================================
   * RENDER DATA
   * =====================================================
   */

  const visibleBricks =
    useMemo(
      () =>
        state.bricks
          .filter(
            brick =>
              brick.hp >
              0,
          ),
      [
        state.bricks,
      ],
    );


  const paddle = {
    x:
      formatVisual(
        state.paddle.x,
      ),

    y:
      formatVisual(
        state.paddle.y,
      ),

    width:
      formatVisual(
        state.paddle.width,
      ),

    height:
      formatVisual(
        state.paddle.height,
      ),
  };


  const ball = {
    x:
      formatVisual(
        state.ball.x,
      ),

    y:
      formatVisual(
        state.ball.y,
      ),

    radius:
      formatVisual(
        state.ball.radius,
      ),
  };


  const canLaunch =
    interactionEnabled &&
    !state.ballLaunched &&
    !state.isPaused &&
    !state.isGameOver &&
    !state.isLevelCleared;


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div
      ref={
        hostRef
      }
      className={`
        relative
        flex
        h-full
        min-h-0
        w-full
        min-w-0
        items-center
        justify-center
        overflow-hidden
        ${className}
      `}
    >
      <div
        ref={
          boardRef
        }
        role="application"
        tabIndex={
          interactionEnabled
            ? 0
            : -1
        }
        aria-label={
          `Brick Breaker level ${state.levelId}. Drag horizontally anywhere on the board to move the paddle. Tap to launch the ball.`
        }
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          handlePointerCancel
        }
        onKeyDown={
          handleKeyDown
        }
        onContextMenu={
          event =>
            event.preventDefault()
        }
        className="
          relative
          shrink-0
          overflow-hidden
          rounded-[22px]
          border
          app-border
          bg-slate-100
          shadow-xl
          outline-none
          dark:bg-[#080b14]
          focus-visible:ring-2
          focus-visible:ring-orange-500/70
        "
        style={{
          width:
            `${renderSize.width}px`,

          height:
            `${renderSize.height}px`,

          /*
           * Critical for paddle control.
           *
           * No parent-page scroll or browser gesture
           * should start while dragging inside the board.
           */
          touchAction:
            "none",

          overscrollBehavior:
            "none",

          userSelect:
            "none",

          WebkitUserSelect:
            "none",

          cursor:
            interactionEnabled
              ? "crosshair"
              : "default",
        }}
      >
        <svg
          viewBox={`
            0
            0
            ${BOARD_VISUAL_WIDTH}
            ${BOARD_VISUAL_HEIGHT}
          `}
          preserveAspectRatio="xMidYMid meet"
          className="
            block
            h-full
            w-full
          "
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="genz-brick-board-bg"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="currentColor"
                stopOpacity="0.025"
              />

              <stop
                offset="100%"
                stopColor="currentColor"
                stopOpacity="0.075"
              />
            </linearGradient>


            <linearGradient
              id="genz-brick-paddle"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor="#fb923c"
              />

              <stop
                offset="50%"
                stopColor="#f97316"
              />

              <stop
                offset="100%"
                stopColor="#f59e0b"
              />
            </linearGradient>


            <radialGradient
              id="genz-brick-ball"
              cx="35%"
              cy="30%"
              r="70%"
            >
              <stop
                offset="0%"
                stopColor="#ffffff"
              />

              <stop
                offset="55%"
                stopColor="#f8fafc"
              />

              <stop
                offset="100%"
                stopColor="#cbd5e1"
              />
            </radialGradient>


            <pattern
              id="genz-brick-grid"
              width="25"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 25 0 L 0 0 0 25"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.35"
                opacity="0.055"
              />
            </pattern>
          </defs>


          {/*
           * Background.
           */}
          <rect
            x="0"
            y="0"
            width={
              BOARD_VISUAL_WIDTH
            }
            height={
              BOARD_VISUAL_HEIGHT
            }
            fill="url(#genz-brick-board-bg)"
            className="
              text-slate-900
              dark:text-white
            "
          />


          <rect
            x="0"
            y="0"
            width={
              BOARD_VISUAL_WIDTH
            }
            height={
              BOARD_VISUAL_HEIGHT
            }
            fill="url(#genz-brick-grid)"
            className="
              text-slate-900
              dark:text-white
            "
          />


          {/*
           * =================================================
           * BRICKS
           * =================================================
           *
           * Position comes directly from deterministic
           * engine coordinates.
           */}
          {visibleBricks.map(
            brick => {

              const x =
                formatVisual(
                  brick.x,
                );


              const y =
                formatVisual(
                  brick.y,
                );


              const width =
                formatVisual(
                  brick.width,
                );


              const height =
                formatVisual(
                  brick.height,
                );


              const hpRatio =
                brick.maxHp >
                  0
                  ? brick.hp /
                    brick.maxHp
                  : 0;


              const opacity =
                0.72 +
                hpRatio *
                  0.28;


              const lightness =
                Math.round(
                  49 +
                  hpRatio *
                    7,
                );


              const fill =
                `hsl(${brick.hue} 82% ${lightness}%)`;


              return (
                <g
                  key={
                    brick.id
                  }
                >
                  {/*
                   * Tiny shadow underneath.
                   *
                   * SVG geometry itself stays unchanged.
                   */}
                  <rect
                    x={
                      x +
                      1.2
                    }
                    y={
                      y +
                      1.6
                    }
                    width={
                      width
                    }
                    height={
                      height
                    }
                    rx="4"
                    fill="rgba(0,0,0,.16)"
                  />


                  <rect
                    x={
                      x
                    }
                    y={
                      y
                    }
                    width={
                      width
                    }
                    height={
                      height
                    }
                    rx="4"
                    fill={
                      fill
                    }
                    opacity={
                      opacity
                    }
                    stroke="rgba(255,255,255,.30)"
                    strokeWidth="0.7"
                  />


                  {/*
                   * Reinforced brick indicator.
                   *
                   * Only visual.
                   */}
                  {brick.hp >
                    1 && (
                    <text
                      x={
                        x +
                        width /
                          2
                      }
                      y={
                        y +
                        height /
                          2 +
                        3
                      }
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="900"
                      fill="rgba(255,255,255,.92)"
                      pointerEvents="none"
                    >
                      {brick.hp}
                    </text>
                  )}
                </g>
              );
            },
          )}


          {/*
           * =================================================
           * PADDLE
           * =================================================
           */}
          <rect
            x={
              paddle.x +
              1.5
            }
            y={
              paddle.y +
              2
            }
            width={
              paddle.width
            }
            height={
              paddle.height
            }
            rx={
              Math.min(
                7,
                paddle.height /
                  2,
              )
            }
            fill="rgba(0,0,0,.24)"
          />


          <rect
            x={
              paddle.x
            }
            y={
              paddle.y
            }
            width={
              paddle.width
            }
            height={
              paddle.height
            }
            rx={
              Math.min(
                7,
                paddle.height /
                  2,
              )
            }
            fill="url(#genz-brick-paddle)"
            stroke="rgba(255,255,255,.55)"
            strokeWidth="0.8"
          />


          {/*
           * Small highlight gives the paddle enough
           * visibility even after the whole board is
           * scaled down on compact phones.
           */}
          <rect
            x={
              paddle.x +
              4
            }
            y={
              paddle.y +
              2
            }
            width={
              Math.max(
                0,
                paddle.width -
                  8,
              )
            }
            height="2"
            rx="1"
            fill="rgba(255,255,255,.45)"
          />


          {/*
           * =================================================
           * BALL
           * =================================================
           */}
          <circle
            cx={
              ball.x +
              1.1
            }
            cy={
              ball.y +
              1.6
            }
            r={
              ball.radius
            }
            fill="rgba(0,0,0,.24)"
          />


          <circle
            cx={
              ball.x
            }
            cy={
              ball.y
            }
            r={
              ball.radius
            }
            fill="url(#genz-brick-ball)"
            stroke="rgba(15,23,42,.35)"
            strokeWidth="0.7"
          />
        </svg>


        {/*
         * ===================================================
         * CONTROL HINT
         * ===================================================
         *
         * Pointer-events are disabled.
         *
         * This message therefore never blocks paddle
         * movement.
         */}
        {canLaunch && (
          <div
            className="
              pointer-events-none
              absolute
              bottom-[2.5%]
              left-1/2
              -translate-x-1/2
              whitespace-nowrap
              rounded-full
              border
              border-orange-500/25
              bg-white/80
              px-2.5
              py-1
              text-[8px]
              font-black
              uppercase
              tracking-[0.12em]
              text-orange-600
              shadow-sm
              backdrop-blur-md
              dark:bg-black/55
              dark:text-orange-400
            "
          >
            Drag to move • Tap to launch
          </div>
        )}


        {/*
         * ===================================================
         * PAUSE SHADE
         * ===================================================
         */}
        {state.isPaused && (
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              flex
              items-center
              justify-center
              bg-black/35
              backdrop-blur-[1px]
            "
          >
            <div
              className="
                rounded-2xl
                border
                border-white/15
                bg-black/55
                px-5
                py-3
                text-center
                text-white
                shadow-xl
              "
            >
              <p
                className="
                  text-sm
                  font-black
                "
              >
                Paused
              </p>

              <p
                className="
                  mt-1
                  text-[9px]
                  font-semibold
                  text-white/65
                "
              >
                Your run is saved
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default BrickBreakerGameBoard;