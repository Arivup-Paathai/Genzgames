import React, {
  useEffect,
  useRef,
} from "react";

import {
  Direction,
  type Point,
  type SnakeGameState,
} from "./snakeTypes";

import {
  GRID_SIZE,
} from "./snakeConstants";


interface SnakeGameCanvasProps {
  state:
    SnakeGameState;

  levelUpPulseKey:
    number;

  shakeKey:
    number;

  perfectClearFxKey:
    number;
}


type Particle = {
  x: number;

  y: number;

  vx: number;

  vy: number;

  born: number;

  life: number;

  size: number;
};


const SNAKE_COLOR =
  "#f97316";

const SNAKE_COLOR_END =
  "#fb923c";


const clamp =
  (
    value:
      number,

    min:
      number,

    max:
      number,
  ) =>
    Math.max(
      min,
      Math.min(
        max,
        value,
      ),
    );


const easeOutCubic =
  (
    value:
      number,
  ) =>
    1 -
    Math.pow(
      1 -
        value,
      3,
    );


const easeInOutSine =
  (
    value:
      number,
  ) =>
    -(
      Math.cos(
        Math.PI *
          value,
      ) -
      1
    ) /
    2;


const SnakeGameCanvas:
React.FC<
  SnakeGameCanvasProps
> = ({
  state,
  levelUpPulseKey,
  shakeKey,
  perfectClearFxKey,
}) => {

  const canvasRef =
    useRef<
      HTMLCanvasElement
    >(
      null,
    );


  const pulseStartRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const previousPulseKeyRef =
    useRef(
      levelUpPulseKey,
    );


  const shakeStartRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const previousShakeKeyRef =
    useRef(
      shakeKey,
    );


  const perfectFxStartRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const previousPerfectFxKeyRef =
    useRef(
      perfectClearFxKey,
    );


  const particlesRef =
    useRef<
      Particle[]
    >(
      [],
    );


  const previousPowerUpRef =
    useRef<{
      pos:
        Point;

      remainingTicks:
        number;
    } | null>(
      null,
    );


  useEffect(() => {

    if (
      levelUpPulseKey !==
      previousPulseKeyRef.current
    ) {

      previousPulseKeyRef.current =
        levelUpPulseKey;


      pulseStartRef.current =
        performance.now();
    }

  }, [
    levelUpPulseKey,
  ]);


  useEffect(() => {

    if (
      shakeKey !==
      previousShakeKeyRef.current
    ) {

      previousShakeKeyRef.current =
        shakeKey;


      shakeStartRef.current =
        performance.now();
    }

  }, [
    shakeKey,
  ]);


  useEffect(() => {

    if (
      perfectClearFxKey !==
      previousPerfectFxKeyRef.current
    ) {

      previousPerfectFxKeyRef.current =
        perfectClearFxKey;


      perfectFxStartRef.current =
        performance.now();
    }

  }, [
    perfectClearFxKey,
  ]);


  /*
   * Create a small particle burst when
   * a board power-up disappears.
   */
  useEffect(() => {

    if (
      state.powerUp
    ) {

      previousPowerUpRef.current = {
        pos: {
          ...state.powerUp.pos,
        },

        remainingTicks:
          state.powerUp.remainingTicks,
      };


      return;
    }


    const previous =
      previousPowerUpRef.current;


    if (
      !previous
    ) {
      return;
    }


    const now =
      performance.now();


    for (
      let index =
        0;

      index <
      16;

      index +=
        1
    ) {

      const angle =
        (
          Math.PI *
          2 *
          index
        ) /
          16 +
        Math.random() *
          0.4;


      const speed =
        0.8 +
        Math.random() *
          1.4;


      particlesRef.current.push({
        x:
          previous.pos.x +
          0.5,

        y:
          previous.pos.y +
          0.5,

        vx:
          Math.cos(
            angle,
          ) *
          speed,

        vy:
          Math.sin(
            angle,
          ) *
          speed,

        born:
          now,

        life:
          400 +
          Math.random() *
            250,

        size:
          0.10 +
          Math.random() *
            0.16,
      });
    }


    previousPowerUpRef.current =
      null;

  }, [
    state.powerUp,
  ]);


  useEffect(() => {

    const canvas =
      canvasRef.current;


    if (
      !canvas
    ) {
      return;
    }


    const context =
      canvas.getContext(
        "2d",
      );


    if (
      !context
    ) {
      return;
    }


    const rect =
      canvas
        .getBoundingClientRect();


    if (
      rect.width <=
        0 ||
      rect.height <=
        0
    ) {
      return;
    }


    const dpr =
      window.devicePixelRatio ||
      1;


    const cssSize =
      Math.floor(
        Math.min(
          rect.width,
          rect.height,
        ),
      );


    canvas.width =
      Math.floor(
        cssSize *
          dpr,
      );


    canvas.height =
      Math.floor(
        cssSize *
          dpr,
      );


    canvas.style.width =
      `${cssSize}px`;


    canvas.style.height =
      `${cssSize}px`;


    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0,
    );


    const cellSize =
      Math.floor(
        cssSize /
          GRID_SIZE,
      );


    const drawableSize =
      cellSize *
      GRID_SIZE;


    const offset =
      Math.floor(
        (
          cssSize -
          drawableSize
        ) /
          2,
      );


    const now =
      performance.now();


    /*
     * =================================================
     * BACKGROUND
     * =================================================
     */
    context.clearRect(
      0,
      0,
      cssSize,
      cssSize,
    );


    const background =
      context.createRadialGradient(
        cssSize *
          0.35,

        cssSize *
          0.30,

        cssSize *
          0.05,

        cssSize *
          0.5,

        cssSize *
          0.5,

        cssSize,
      );


    background.addColorStop(
      0,
      "rgba(249,115,22,0.12)",
    );


    background.addColorStop(
      0.45,
      "rgba(251,146,60,0.05)",
    );


    background.addColorStop(
      1,
      "rgba(8,8,8,1)",
    );


    context.fillStyle =
      background;


    context.fillRect(
      0,
      0,
      cssSize,
      cssSize,
    );


    /*
     * =================================================
     * COMPLETION FLASH
     * =================================================
     */
    if (
      perfectFxStartRef.current !==
      null
    ) {

      const elapsed =
        now -
        perfectFxStartRef.current;


      const duration =
        650;


      const progress =
        clamp(
          elapsed /
            duration,
          0,
          1,
        );


      const remaining =
        1 -
        progress;


      context.save();


      context.globalAlpha =
        0.18 *
        remaining;


      context.fillStyle =
        "#f97316";


      context.fillRect(
        0,
        0,
        cssSize,
        cssSize,
      );


      context.restore();


      if (
        progress >=
        1
      ) {

        perfectFxStartRef.current =
          null;
      }
    }


    /*
     * =================================================
     * SHAKE
     * =================================================
     */
    let shakeX =
      0;

    let shakeY =
      0;


    if (
      shakeStartRef.current !==
      null
    ) {

      const elapsed =
        now -
        shakeStartRef.current;


      const progress =
        clamp(
          elapsed /
            220,
          0,
          1,
        );


      const power =
        (
          1 -
          progress
        ) *
        clamp(
          cellSize *
            0.14,
          2,
          7,
        );


      shakeX =
        (
          Math.random() *
            2 -
          1
        ) *
        power;


      shakeY =
        (
          Math.random() *
            2 -
          1
        ) *
        power;


      if (
        progress >=
        1
      ) {

        shakeStartRef.current =
          null;
      }
    }


    /*
     * =================================================
     * LEVEL COMPLETE ZOOM
     * =================================================
     */
    let zoom =
      1;


    if (
      pulseStartRef.current !==
      null
    ) {

      const elapsed =
        now -
        pulseStartRef.current;


      const progress =
        clamp(
          elapsed /
            650,
          0,
          1,
        );


      const peak =
        0.07;


      if (
        progress <
        0.35
      ) {

        zoom =
          1 +
          peak *
            easeOutCubic(
              progress /
                0.35,
            );

      } else {

        zoom =
          1 +
          peak *
            (
              1 -
              easeInOutSine(
                (
                  progress -
                  0.35
                ) /
                  0.65,
              )
            );
      }


      if (
        progress >=
        1
      ) {

        pulseStartRef.current =
          null;
      }
    }


    const centerX =
      offset +
      drawableSize /
        2;


    const centerY =
      offset +
      drawableSize /
        2;


    context.save();


    context.translate(
      centerX +
        shakeX,
      centerY +
        shakeY,
    );


    context.scale(
      zoom,
      zoom,
    );


    context.translate(
      -centerX,
      -centerY,
    );


    /*
     * =================================================
     * GRID
     * =================================================
     */
    context.strokeStyle =
      "rgba(255,255,255,0.035)";


    context.lineWidth =
      1;


    for (
      let index =
        0;

      index <=
      GRID_SIZE;

      index +=
        1
    ) {

      const position =
        offset +
        index *
          cellSize +
        0.5;


      context.beginPath();


      context.moveTo(
        position,
        offset,
      );


      context.lineTo(
        position,
        offset +
          drawableSize,
      );


      context.stroke();


      context.beginPath();


      context.moveTo(
        offset,
        position,
      );


      context.lineTo(
        offset +
          drawableSize,
        position,
      );


      context.stroke();
    }


    /*
     * =================================================
     * OBSTACLES
     * =================================================
     */
    state.obstacles.forEach(
      (
        obstacle,
      ) => {

        const x =
          offset +
          obstacle.x *
            cellSize;


        const y =
          offset +
          obstacle.y *
            cellSize;


        context.fillStyle =
          "#334155";


        context.shadowBlur =
          8;


        context.shadowColor =
          "rgba(148,163,184,0.25)";


        context.fillRect(
          x +
            3,
          y +
            3,
          cellSize -
            6,
          cellSize -
            6,
        );


        context.shadowBlur =
          0;
      },
    );


    /*
     * =================================================
     * FOOD
     * =================================================
     */
    if (
      state.food
    ) {

      const {
        pos,
        isBonus,
      } =
        state.food;


      const centerFoodX =
        offset +
        pos.x *
          cellSize +
        cellSize /
          2;


      const centerFoodY =
        offset +
        pos.y *
          cellSize +
        cellSize /
          2;


      context.shadowBlur =
        isBonus
          ? 24
          : 16;


      context.shadowColor =
        isBonus
          ? "#facc15"
          : "#22c55e";


      context.fillStyle =
        isBonus
          ? "#facc15"
          : "#22c55e";


      context.beginPath();


      context.arc(
        centerFoodX,
        centerFoodY,
        isBonus
          ? cellSize *
              0.38
          : cellSize *
              0.30,
        0,
        Math.PI *
          2,
      );


      context.fill();


      context.shadowBlur =
        0;
    }


    /*
     * =================================================
     * BOARD POWER-UP
     * =================================================
     */
    if (
      state.powerUp
    ) {

      const centerPowerX =
        offset +
        state.powerUp.pos.x *
          cellSize +
        cellSize /
          2;


      const centerPowerY =
        offset +
        state.powerUp.pos.y *
          cellSize +
        cellSize /
          2;


      const ratio =
        clamp(
          state.powerUp
            .remainingTicks /
            100,
          0,
          1,
        );


      context.save();


      context.strokeStyle =
        "#facc15";


      context.lineWidth =
        Math.max(
          2,
          cellSize *
            0.09,
        );


      context.beginPath();


      context.arc(
        centerPowerX,
        centerPowerY,
        cellSize *
          0.45,
        -Math.PI /
          2,
        -Math.PI /
            2 +
          Math.PI *
            2 *
            ratio,
      );


      context.stroke();


      context.font =
        `${Math.max(
          14,
          cellSize *
            0.72,
        )}px sans-serif`;


      context.textAlign =
        "center";


      context.textBaseline =
        "middle";


      context.fillText(
        "⭐",
        centerPowerX,
        centerPowerY,
      );


      context.restore();
    }


    /*
     * =================================================
     * POWER-UP PARTICLES
     * =================================================
     */
    if (
      particlesRef.current.length >
      0
    ) {

      const alive:
        Particle[] =
        [];


      for (
        const particle
        of particlesRef.current
      ) {

        const age =
          now -
          particle.born;


        if (
          age >
          particle.life
        ) {
          continue;
        }


        particle.x +=
          particle.vx *
          0.016;


        particle.y +=
          particle.vy *
          0.016;


        particle.vx *=
          0.985;


        particle.vy *=
          0.985;


        const alpha =
          1 -
          age /
            particle.life;


        context.save();


        context.globalAlpha =
          alpha;


        context.fillStyle =
          "#facc15";


        context.beginPath();


        context.arc(
          offset +
            particle.x *
              cellSize,

          offset +
            particle.y *
              cellSize,

          particle.size *
            cellSize,

          0,

          Math.PI *
            2,
        );


        context.fill();


        context.restore();


        alive.push(
          particle,
        );
      }


      particlesRef.current =
        alive;
    }


    /*
     * =================================================
     * SNAKE
     * =================================================
     */
    [
      ...state.snake,
    ]
      .reverse()
      .forEach(
        (
          part,
          reverseIndex,
        ) => {

          const actualIndex =
            state.snake.length -
            1 -
            reverseIndex;


          const isHead =
            actualIndex ===
            0;


          const centerSnakeX =
            offset +
            part.x *
              cellSize +
            cellSize /
              2;


          const centerSnakeY =
            offset +
            part.y *
              cellSize +
            cellSize /
              2;


          const gradient =
            context
              .createRadialGradient(
                centerSnakeX,
                centerSnakeY,
                0,

                centerSnakeX,
                centerSnakeY,
                cellSize,
              );


          gradient.addColorStop(
            0,
            isHead
              ? SNAKE_COLOR_END
              : SNAKE_COLOR,
          );


          gradient.addColorStop(
            1,
            "#7c2d12",
          );


          context.fillStyle =
            gradient;


          if (
            isHead
          ) {

            context.shadowBlur =
              20;


            context.shadowColor =
              SNAKE_COLOR;
          }


          const size =
            isHead
              ? cellSize *
                  0.92
              : cellSize *
                  0.82;


          context.beginPath();


          context.arc(
            centerSnakeX,
            centerSnakeY,
            size /
              2,
            0,
            Math.PI *
              2,
          );


          context.fill();


          context.shadowBlur =
            0;


          /*
           * Snake eyes.
           */
          if (
            isHead
          ) {

            const eyeSize =
              Math.max(
                1.5,
                cellSize *
                  0.09,
              );


            let eyes = [
              {
                x:
                  -0.20,

                y:
                  -0.20,
              },

              {
                x:
                  0.20,

                y:
                  -0.20,
              },
            ];


            if (
              state.direction ===
              Direction.DOWN
            ) {

              eyes = [
                {
                  x:
                    -0.20,

                  y:
                    0.20,
                },

                {
                  x:
                    0.20,

                  y:
                    0.20,
                },
              ];
            }


            if (
              state.direction ===
              Direction.LEFT
            ) {

              eyes = [
                {
                  x:
                    -0.20,

                  y:
                    -0.20,
                },

                {
                  x:
                    -0.20,

                  y:
                    0.20,
                },
              ];
            }


            if (
              state.direction ===
              Direction.RIGHT
            ) {

              eyes = [
                {
                  x:
                    0.20,

                  y:
                    -0.20,
                },

                {
                  x:
                    0.20,

                  y:
                    0.20,
                },
              ];
            }


            context.fillStyle =
              "#ffffff";


            eyes.forEach(
              (
                eye,
              ) => {

                context.beginPath();


                context.arc(
                  centerSnakeX +
                    cellSize *
                      eye.x,

                  centerSnakeY +
                    cellSize *
                      eye.y,

                  eyeSize,

                  0,

                  Math.PI *
                    2,
                );


                context.fill();
              },
            );
          }
        },
      );


    /*
     * =================================================
     * BORDER
     * =================================================
     */
    const border =
      context
        .createLinearGradient(
          offset,
          offset,
          offset +
            drawableSize,
          offset +
            drawableSize,
        );


    border.addColorStop(
      0,
      "rgba(249,115,22,0.85)",
    );


    border.addColorStop(
      0.5,
      "rgba(251,146,60,0.45)",
    );


    border.addColorStop(
      1,
      "rgba(250,204,21,0.65)",
    );


    context.strokeStyle =
      border;


    context.lineWidth =
      3;


    context.shadowBlur =
      14;


    context.shadowColor =
      "rgba(249,115,22,0.45)";


    context.strokeRect(
      offset +
        1.5,
      offset +
        1.5,
      drawableSize -
        3,
      drawableSize -
        3,
    );


    context.shadowBlur =
      0;


    context.restore();

  }, [
    state,
    levelUpPulseKey,
    shakeKey,
    perfectClearFxKey,
  ]);


  return (
    <canvas
      ref={
        canvasRef
      }
      className="
        block
        h-full
        w-full
        rounded-3xl
        bg-black
        shadow-2xl
      "
    />
  );
};


export default SnakeGameCanvas;