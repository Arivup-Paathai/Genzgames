import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Pause,
  Play,
  RefreshCw,
  Trophy,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

import type {
  GetGenZGamesSummaryResponse,
} from "../services/cloudflare/stream";

import {
  DiamondCounter,
} from "../components/DiamondCounter";

import {
  DiamondFlyReward,
} from "../components/DiamondFlyReward";

import {
  formatGamePaise,
} from "../services/genzGames";

import {
  showGenZGamesRewardedAd,
} from "../services/admob";

import {
  registerNativeBackHandler,
} from "../services/nativeBack";

import {
  genZGamesApi,
} from "../services/genZGamesApi";

import type {
  CompleteFlappyRocketRunResponse,
} from "../services/genZGamesApi";

import {
  playGameSound,
  playTone,
} from "../audioManager";

import {
  FLAPPY_DIAMOND_REWARD,
  FLAPPY_GAME_HEIGHT,
  FLAPPY_GAME_WIDTH,
  FLAPPY_PLAYER_SIZE,
  FLAPPY_PLAYER_X,
  FLAPPY_REWARD_PAISE,
  FLAPPY_REWARD_SCORE,
  FLAPPY_TICK_MS,
} from "../games/flappyRocket/flappyRocketConstants";

import {
  advanceFlappyRocketTick,
  applyFlappyRocketFlap,
  createInitialFlappyRocketState,
  reviveFlappyRocketState,
} from "../games/flappyRocket/flappyRocketEngine";

import type {
  FlappyRocketCharacterKey,
  SavedGenZFlappyRocketRun,
} from "../games/flappyRocket/flappyRocketTypes";

import {
  clearGenZFlappyRocketRun,
  createFlappyRocketRunId,
  createFlappyRocketSeed,
  loadGenZFlappyRocketRun,
  saveGenZFlappyRocketRun,
} from "../games/flappyRocket/flappyRocketStorage";


interface GenZFlappyRocketProps {
  summary:
    GetGenZGamesSummaryResponse |
    null;

  onSummaryChange: (
    summary:
      GetGenZGamesSummaryResponse,
  ) => void;

  onBack:
    () => void;
}


type ScreenState =
  | "HOME"
  | "GAME"
  | "GAME_OVER";


interface CharacterConfig {
  key:
    FlappyRocketCharacterKey;

  label:
    string;

  emoji:
    string;
}


interface Star {
  id:
    string;

  x:
    number;

  y:
    number;

  size:
    number;

  alpha:
    number;
}


interface Cloud {
  id:
    string;

  x:
    number;

  y:
    number;

  scale:
    number;

  speed:
    number;
}


interface Particle {
  id:
    string;

  x:
    number;

  y:
    number;

  dx:
    number;

  dy:
    number;

  size:
    number;

  life:
    number;

  color:
    string;
}


const BEST_SCORE_KEY =
  "ap_flappy_rocket_best_score";


const SELECTED_CHARACTER_KEY =
  "ap_flappy_rocket_character";


const STAR_COUNT =
  12;


const CLOUD_COUNT =
  3;

const BANNER_RESERVE_PX =
  72;

const STAR_SPEED =
  0.45;


const CHARACTERS:
  CharacterConfig[] = [
    {
      key:
        "rocket",

      label:
        "Rocket",

      emoji:
        "🚀",
    },

    {
      key:
        "bird",

      label:
        "Bird",

      emoji:
        "🐦",
    },

    {
      key:
        "ball",

      label:
        "Ball",

      emoji:
        "⚽",
    },

    {
      key:
        "ufo",

      label:
        "UFO",

      emoji:
        "🛸",
    },
  ];


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


const makeVisualId =
  () =>
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;


/*
 * Math.random() below is ONLY for visual
 * stars/clouds/particles.
 *
 * It never changes verified gameplay.
 */
const visualRandomBetween =
  (
    min:
      number,

    max:
      number,
  ) =>
    min +
    Math.random() *
      (
        max -
        min
      );


const createInitialStars =
  (): Star[] =>
    Array.from(
      {
        length:
          STAR_COUNT,
      },

      () => ({
        id:
          makeVisualId(),

        x:
          visualRandomBetween(
            0,
            FLAPPY_GAME_WIDTH,
          ),

        y:
          visualRandomBetween(
            0,
            FLAPPY_GAME_HEIGHT,
          ),

        size:
          visualRandomBetween(
            1.5,
            3.8,
          ),

        alpha:
          visualRandomBetween(
            0.18,
            0.88,
          ),
      }),
    );


const createInitialClouds =
  (): Cloud[] =>
    Array.from(
      {
        length:
          CLOUD_COUNT,
      },

      () => ({
        id:
          makeVisualId(),

        x:
          visualRandomBetween(
            -40,
            FLAPPY_GAME_WIDTH,
          ),

        y:
          visualRandomBetween(
            70,
            250,
          ),

        scale:
          visualRandomBetween(
            0.8,
            1.45,
          ),

        speed:
          visualRandomBetween(
            0.18,
            0.42,
          ),
      }),
    );


const getStoredBestScore =
  () => {

    try {

      const value =
        Number(
          localStorage.getItem(
            BEST_SCORE_KEY,
          ) ??
            "0",
        );


      return Number.isFinite(
        value,
      )
        ? Math.max(
            0,
            Math.floor(
              value,
            ),
          )
        : 0;

    } catch {

      return 0;
    }
  };


const saveBestScore =
  (
    score:
      number,
  ) => {

    try {

      localStorage.setItem(
        BEST_SCORE_KEY,
        String(
          Math.max(
            0,
            Math.floor(
              score,
            ),
          ),
        ),
      );

    } catch {
      // Ignore localStorage failure.
    }
  };


const getStoredCharacter =
  (): FlappyRocketCharacterKey => {

    try {

      const saved =
        localStorage.getItem(
          SELECTED_CHARACTER_KEY,
        ) as
          FlappyRocketCharacterKey |
          null;


      if (
        saved &&
        CHARACTERS.some(
          character =>
            character.key ===
            saved,
        )
      ) {

        return saved;
      }

    } catch {
      // Ignore localStorage failure.
    }


    return "rocket";
  };


const saveCharacter =
  (
    character:
      FlappyRocketCharacterKey,
  ) => {

    try {

      localStorage.setItem(
        SELECTED_CHARACTER_KEY,
        character,
      );

    } catch {
      // Ignore localStorage failure.
    }
  };


export const GenZFlappyRocket:
React.FC<
  GenZFlappyRocketProps
> = ({
  summary,
  onSummaryChange,
  onBack,
}) => {

  const {
    currentUser,
    addToast,
  } =
    useAuth();


  const [
    screen,
    setScreen,
  ] =
    useState<
      ScreenState
    >(
      "HOME",
    );


  const [
    run,
    setRun,
  ] =
    useState<
      SavedGenZFlappyRocketRun |
      null
    >(
      null,
    );


  const [
    bestScore,
    setBestScore,
  ] =
    useState(
      () =>
        getStoredBestScore(),
    );


  const [
    selectedCharacter,
    setSelectedCharacter,
  ] =
    useState<
      FlappyRocketCharacterKey
    >(
      () =>
        getStoredCharacter(),
    );


  const [
    starting,
    setStarting,
  ] =
    useState(
      false,
    );


  const [
    reviving,
    setReviving,
  ] =
    useState(
      false,
    );


  const [
    claiming,
    setClaiming,
  ] =
    useState(
      false,
    );


  const [
    completionError,
    setCompletionError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    claimResult,
    setClaimResult,
  ] =
    useState<
      CompleteFlappyRocketRunResponse |
      null
    >(
      null,
    );


  const [
    showDiamondFly,
    setShowDiamondFly,
  ] =
    useState(
      false,
    );


  const [
    stars,
    setStars,
  ] =
    useState<
      Star[]
    >(
      () =>
        createInitialStars(),
    );


  const [
    clouds,
    setClouds,
  ] =
    useState<
      Cloud[]
    >(
      () =>
        createInitialClouds(),
    );


  const [
    particles,
    setParticles,
  ] =
    useState<
      Particle[]
    >(
      [],
    );


  const [
    tapPulse,
    setTapPulse,
  ] =
    useState(
      0,
    );


  const [
    crashFlash,
    setCrashFlash,
  ] =
    useState(
      0,
    );

    const [
  waitingForTap,
  setWaitingForTap,
] =
  useState(
    false,
  );

const [
  isPaused,
  setIsPaused,
] =
  useState(
    false,
  );
  const runRef =
    useRef<
      SavedGenZFlappyRocketRun |
      null
    >(
      null,
    );


  const animationFrameRef =
    useRef<
      number |
      null
    >(
      null,
    );


  const lastFrameTimeRef =
    useRef(
      0,
    );


  const accumulatorRef =
    useRef(
      0,
    );


  const lastLocalSaveTickRef =
    useRef(
      0,
    );


  const claimInFlightRef =
    useRef(
      false,
    );


  const previousScoreRef =
    useRef(
      0,
    );


  const previousGameOverRef =
    useRef(
      false,
    );


  const finalRecordRunIdRef =
    useRef<
      string |
      null
    >(
      null,
    );


  const previousMilestoneRef =
    useRef(
      false,
    );


  const activeCharacter =
    useMemo(
      () =>
        CHARACTERS.find(
          character =>
            character.key ===
            selectedCharacter,
        ) ??
        CHARACTERS[0],
      [
        selectedCharacter,
      ],
    );


  const gameState =
    run
      ?.gameState ??
    null;


  const score =
    gameState
      ?.score ??
    0;


  const rewardProgress =
    Math.min(
      100,

      (
        score /
        FLAPPY_REWARD_SCORE
      ) *
        100,
    );


  const reviveAvailable =
    Boolean(
      gameState &&
      gameState.isGameOver &&
      gameState.score <
        FLAPPY_REWARD_SCORE &&
      !gameState.reviveUsed,
    );


  const hasPendingReward =
    Boolean(
      run &&
      run.rewardMilestoneTick !==
        null &&
      !run.rewardClaimed,
    );


  const persistRun =
    useCallback(
      (
        nextRun:
          SavedGenZFlappyRocketRun |
          null,
      ) => {

        if (
          !currentUser
        ) {
          return;
        }


        if (
          !nextRun
        ) {

          clearGenZFlappyRocketRun(
            currentUser.id,
          );


          return;
        }


        saveGenZFlappyRocketRun(
          currentUser.id,
          nextRun,
        );
      },
      [
        currentUser,
      ],
    );


  /*
   * =====================================================
   * RESTORE LOCAL RUN
   * =====================================================
   */

  useEffect(() => {

    if (
      !currentUser
    ) {

      setRun(
        null,
      );

      runRef.current =
        null;


      return;
    }


    const saved =
      loadGenZFlappyRocketRun(
        currentUser.id,
      );


    if (
      !saved
    ) {

      setRun(
        null,
      );

      runRef.current =
        null;


      return;
    }


    /*
     * A fully finished rewarded run does not
     * need to remain after game over.
     */
    if (
      saved.rewardClaimed &&
      saved.gameState.isGameOver
    ) {

      clearGenZFlappyRocketRun(
        currentUser.id,
      );


      setRun(
        null,
      );

      runRef.current =
        null;


      return;
    }


    setRun(
      saved,
    );

    runRef.current =
      saved;

    previousScoreRef.current =
      saved.gameState.score;

    previousGameOverRef.current =
      saved.gameState.isGameOver;

  }, [
    currentUser,
  ]);


  /*
   * =====================================================
   * SAVE WHEN APP LEAVES FOREGROUND
   * =====================================================
   */

  useEffect(() => {

    const handleVisibility =
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          /*
           * Do not simulate the time the app
           * spent in the background.
           */
          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;


          return;
        }


        const current =
          runRef.current;


        if (
          current
        ) {

          persistRun(
            current,
          );
        }
      };


    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );


    return () => {

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };

  }, [
    persistRun,
  ]);


  /*
   * =====================================================
   * ANDROID BACK
   * =====================================================
   *
   * Flight / Game Over -> Flappy home.
   * Flappy home -> GenZGames home.
   */

  useEffect(() => {

    return registerNativeBackHandler(
      () => {

        const current =
          runRef.current;


        if (
  screen !==
  "HOME"
) {

  if (
    current
  ) {

    persistRun(
      current,
    );
  }


  setIsPaused(
    false,
  );


  setScreen(
    "HOME",
  );


  return;
}


        onBack();
      },
    );

  }, [
    screen,
    onBack,
    persistRun,
  ]);


  /*
   * =====================================================
   * PAGE SCROLL
   * =====================================================
   */

  useEffect(() => {

    window.scrollTo({
      top:
        0,

      left:
        0,

      behavior:
        "auto",
    });


    const previousOverflow =
      document.body.style.overflow;

    const previousTouchAction =
      document.body.style.touchAction;


    if (
      screen ===
      "GAME"
    ) {

      document.body.style.overflow =
        "hidden";

      document.body.style.touchAction =
        "none";

    } else {

      document.body.style.overflow =
        "";

      document.body.style.touchAction =
        "";
    }


    return () => {

      document.body.style.overflow =
        previousOverflow;

      document.body.style.touchAction =
        previousTouchAction;
    };

  }, [
    screen,
  ]);


  /*
   * =====================================================
   * START NEW RUN
   * =====================================================
   */

  const startNewRun =
    useCallback(
      async () => {

        if (
          !currentUser ||
          starting ||
          hasPendingReward
        ) {
          return;
        }


        setStarting(
          true,
        );

        setCompletionError(
          null,
        );

        setClaimResult(
          null,
        );

        setShowDiamondFly(
          false,
        );


        try {

          /*
           * Every NEW Flappy Rocket run
           * requires one rewarded ad.
           *
           * Resuming an existing run does not.
           */
          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to start the Flappy Rocket run.",
              "info",
            );


            return;
          }


          const seed =
            createFlappyRocketSeed();


          const created =
            createInitialFlappyRocketState();


          const now =
            Date.now();


          const nextRun:
            SavedGenZFlappyRocketRun = {

              version:
                1,

              runId:
                createFlappyRocketRunId(),

              seed,

              randomStep:
                created.randomStep,

              gameState:
                created.state,

              flapEvents:
                [],

              reviveTick:
                null,

              rewardMilestoneTick:
                null,

              rewardClaimed:
                false,

              startedAt:
                now,

              updatedAt:
                now,
            };


          setRun(
            nextRun,
          );

          runRef.current =
            nextRun;


          persistRun(
            nextRun,
          );


          previousScoreRef.current =
            0;

          previousGameOverRef.current =
            false;

          previousMilestoneRef.current =
            false;

          lastLocalSaveTickRef.current =
            0;

          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;


          setStars(
            createInitialStars(),
          );

          setClouds(
            createInitialClouds(),
          );

          setParticles(
  [],
);

setIsPaused(
  false,
);
/*
 * The rewarded ad has finished, but
 * deterministic gameplay must NOT begin
 * until the player is ready.
 */
setWaitingForTap(
  true,
);


setScreen(
  "GAME",
);


          playTone(
            520,
            "triangle",
            0.10,
            0.30,
          );

        } finally {

          setStarting(
            false,
          );
        }
      },
      [
        currentUser,
        starting,
        hasPendingReward,
        addToast,
        persistRun,
      ],
    );


  /*
   * =====================================================
   * RESUME LOCAL RUN
   * =====================================================
   */

  const resumeRun =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
          !current
        ) {
          return;
        }


        lastFrameTimeRef.current =
  0;

accumulatorRef.current =
  0;

setIsPaused(
  false,
);


if (
  current.gameState.isGameOver
) {

  setWaitingForTap(
    false,
  );


  setScreen(
    "GAME_OVER",
  );

} else {

  /*
   * Never restart an active flight
   * unexpectedly.
   */
  setWaitingForTap(
    true,
  );


  setScreen(
    "GAME",
  );
}


        playTone(
          420,
          "sine",
          0.08,
          0.26,
        );
      },
      [],
    );


  /*
   * =====================================================
   * PARTICLES
   * =====================================================
   */

  const spawnFlameParticles =
    useCallback(
      (
        count:
          number,
      ) => {

        const state =
          runRef.current
            ?.gameState;


        if (
          !state
        ) {
          return;
        }


        const colors =
          selectedCharacter ===
          "bird"
            ? [
                "#facc15",
                "#fde68a",
              ]
            : selectedCharacter ===
                "ball"
              ? [
                  "#e2e8f0",
                  "#cbd5e1",
                ]
              : selectedCharacter ===
                  "ufo"
                ? [
                    "#a78bfa",
                    "#60a5fa",
                  ]
                : [
                    "#fb923c",
                    "#facc15",
                  ];


        const created:
          Particle[] =
          Array.from(
            {
              length:
                count,
            },

            () => ({
              id:
                makeVisualId(),

              x:
                FLAPPY_PLAYER_X -
                12 +
                visualRandomBetween(
                  -2,
                  4,
                ),

              y:
                state.rocketY +
                visualRandomBetween(
                  -4,
                  4,
                ),

              dx:
                visualRandomBetween(
                  -2.8,
                  -1.1,
                ),

              dy:
                visualRandomBetween(
                  -0.8,
                  0.8,
                ),

              size:
                visualRandomBetween(
                  4,
                  8,
                ),

              life:
                visualRandomBetween(
                  14,
                  22,
                ),

              color:
                colors[
                  Math.floor(
                    Math.random() *
                      colors.length,
                  )
                ],
            }),
          );


        setParticles(
          previous =>
            [
              ...previous,
              ...created,
            ].slice(
              -32,
            ),
        );
      },
      [
        selectedCharacter,
      ],
    );


  /*
   * =====================================================
   * FLAP
   * =====================================================
   */

  const flap =
    useCallback(
      () => {

        const current =
          runRef.current;


        if (
  screen !==
    "GAME" ||
  !current ||
  current.gameState.isGameOver ||
  isPaused
) {
  return;
}

        /*
 * First tap after Start / Resume / Revive
 * releases the deterministic clock.
 *
 * This same tap also becomes the normal
 * flap event for tick + 1.
 */
if (
  waitingForTap
) {

  setWaitingForTap(
    false,
  );


  lastFrameTimeRef.current =
    0;

  accumulatorRef.current =
    0;
}


        const eventTick =
          current.gameState.tick +
          1;


        const lastEvent =
          current.flapEvents[
            current.flapEvents.length -
              1
          ];


        /*
         * Multiple taps before the next
         * deterministic tick have the same
         * gameplay result.
         *
         * Store only one event for that tick.
         */
        const nextEvents =
          lastEvent &&
          lastEvent.tick ===
            eventTick
            ? current.flapEvents
            : [
                ...current.flapEvents,

                {
                  tick:
                    eventTick,
                },
              ];


        const nextRun:
          SavedGenZFlappyRocketRun = {

            ...current,

            gameState:
              applyFlappyRocketFlap(
                current.gameState,
              ),

            flapEvents:
              nextEvents,

            updatedAt:
              Date.now(),
          };


        setRun(
          nextRun,
        );

        runRef.current =
          nextRun;


        /*
         * Save flap input immediately.
         *
         * localStorage only.
         */
        persistRun(
          nextRun,
        );


        setTapPulse(
          previous =>
            previous +
            1,
        );


        spawnFlameParticles(
          2,
        );


        playGameSound(
          "flappy-tap",
        );
      },
      [
  screen,
  waitingForTap,
  isPaused,
  persistRun,
  spawnFlameParticles,
],
    );


  /*
   * =====================================================
   * KEYBOARD
   * =====================================================
   */

  useEffect(() => {

    if (
      screen !==
      "GAME"
    ) {
      return;
    }


    const handleKeyDown =
      (
        event:
          KeyboardEvent,
      ) => {

        if (
          event.code ===
            "Space" ||
          event.key ===
            "ArrowUp"
        ) {

          event.preventDefault();

          flap();
        }
      };


    window.addEventListener(
      "keydown",
      handleKeyDown,
    );


    return () => {

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };

  }, [
    screen,
    flap,
  ]);


  /*
   * =====================================================
   * FIXED 60HZ GAME LOOP
   * =====================================================
   *
   * requestAnimationFrame controls only WHEN
   * we get CPU time.
   *
   * Actual gameplay advances through fixed
   * deterministic ticks.
   */

  useEffect(() => {

    if (
      screen !==
      "GAME"
    ) {
      return;
    }


    let mounted =
      true;


    const frame =
      (
        time:
          number,
      ) => {

        if (
          !mounted
        ) {
          return;
        }


        if (
          document.visibilityState !==
          "visible"
        ) {

          lastFrameTimeRef.current =
            0;

          accumulatorRef.current =
            0;


          animationFrameRef.current =
            window.requestAnimationFrame(
              frame,
            );


          return;
        }


        if (
          lastFrameTimeRef.current ===
          0
        ) {

          lastFrameTimeRef.current =
            time;
        }


        const delta =
          Math.min(
            100,

            Math.max(
              0,
              time -
                lastFrameTimeRef.current,
            ),
          );


        lastFrameTimeRef.current =
          time;


        /*
 * While waiting for the player's first
 * tap, visual background animation may
 * continue, but deterministic gameplay
 * must remain completely frozen.
 */
if (
  waitingForTap ||
  isPaused
) {

  accumulatorRef.current =
    0;

  lastFrameTimeRef.current =
    time;

} else {

  accumulatorRef.current +=
    delta;
}


/*
 * Visual-only movement.
 */
const visualFactor =
          delta /
          16.666;


        setStars(
          previous =>
            previous.map(
              star => {

                let nextX =
                  star.x -
                  STAR_SPEED *
                    visualFactor;


                if (
                  nextX <
                  -8
                ) {

                  nextX =
                    FLAPPY_GAME_WIDTH +
                    visualRandomBetween(
                      0,
                      25,
                    );
                }


                return {
                  ...star,

                  x:
                    nextX,
                };
              },
            ),
        );


        setClouds(
          previous =>
            previous.map(
              cloud => {

                let nextX =
                  cloud.x -
                  cloud.speed *
                    visualFactor;

                let nextY =
                  cloud.y;


                if (
                  nextX <
                  -120
                ) {

                  nextX =
                    FLAPPY_GAME_WIDTH +
                    visualRandomBetween(
                      10,
                      80,
                    );

                  nextY =
                    visualRandomBetween(
                      70,
                      260,
                    );
                }


                return {
                  ...cloud,

                  x:
                    nextX,

                  y:
                    nextY,
                };
              },
            ),
        );


        setParticles(
          previous =>
            previous
              .map(
                particle => ({
                  ...particle,

                  x:
                    particle.x +
                    particle.dx *
                      visualFactor,

                  y:
                    particle.y +
                    particle.dy *
                      visualFactor,

                  dy:
                    particle.dy +
                    0.03 *
                      visualFactor,

                  life:
                    particle.life -
                    visualFactor,
                }),
              )
              .filter(
                particle =>
                  particle.life >
                  0,
              ),
        );


        let current =
          runRef.current;


        let steps =
          0;


        /*
         * Cap catch-up work per frame.
         *
         * This prevents a slow device from
         * creating a giant replay burst.
         */
        while (
  current &&
  !waitingForTap &&
  !isPaused &&
  !current.gameState.isGameOver &&
  accumulatorRef.current >=
    FLAPPY_TICK_MS &&
  steps <
    6
) {

          accumulatorRef.current -=
            FLAPPY_TICK_MS;


          const result =
            advanceFlappyRocketTick(
              current.gameState,
              current.seed,
              current.randomStep,
            );


          const rewardMilestoneTick =
            current.rewardMilestoneTick ??
            (
              result.rewardMilestoneReached
                ? result.state.tick
                : null
            );


          current = {
            ...current,

            gameState:
              result.state,

            randomStep:
              result.randomStep,

            rewardMilestoneTick,

            updatedAt:
              Date.now(),
          };


          runRef.current =
            current;


          steps +=
            1;


          /*
           * Save roughly every 0.5 seconds.
           *
           * localStorage only.
           */
          if (
            current.gameState.tick -
              lastLocalSaveTickRef.current >=
            30
          ) {

            lastLocalSaveTickRef.current =
              current.gameState.tick;


            persistRun(
              current,
            );
          }


          /*
           * Save the exact reward milestone
           * immediately.
           */
          if (
            result.rewardMilestoneReached
          ) {

            persistRun(
              current,
            );
          }


          if (
            result.gameOver
          ) {

            const canStillRevive =
              current.gameState.score <
                FLAPPY_REWARD_SCORE &&
              !current.gameState.reviveUsed;


            const needsRewardRecovery =
              current.rewardMilestoneTick !==
                null &&
              !current.rewardClaimed;


            /*
             * Keep only runs that can still:
             *
             * - use their one revive, or
             * - retry pending reward verification.
             */
            if (
              canStillRevive ||
              needsRewardRecovery
            ) {

              persistRun(
                current,
              );

            } else {

              persistRun(
                null,
              );
            }


            setScreen(
              "GAME_OVER",
            );


            break;
          }
        }


        if (
          current
        ) {

          setRun(
            current,
          );
        }


        animationFrameRef.current =
          window.requestAnimationFrame(
            frame,
          );
      };


    animationFrameRef.current =
      window.requestAnimationFrame(
        frame,
      );


    return () => {

      mounted =
        false;


      if (
        animationFrameRef.current !==
        null
      ) {

        window.cancelAnimationFrame(
          animationFrameRef.current,
        );

        animationFrameRef.current =
          null;
      }


      lastFrameTimeRef.current =
        0;

      accumulatorRef.current =
        0;
    };

  }, [
  screen,
  waitingForTap,
  isPaused,
  persistRun,
]);


  /*
   * =====================================================
   * SCORE / CRASH SOUND / BEST SCORE
   * =====================================================
   */

  useEffect(() => {

    const state =
      run
        ?.gameState;


    if (
      !state
    ) {
      return;
    }


    if (
      state.score >
      previousScoreRef.current
    ) {

      playGameSound(
        "flappy-gate",
      );


      if (
        state.score >
        bestScore
      ) {

        setBestScore(
          state.score,
        );

        saveBestScore(
          state.score,
        );
      }
    }


    previousScoreRef.current =
      state.score;


    if (
      state.isGameOver &&
      !previousGameOverRef.current
    ) {

      const current =
        runRef.current;


      if (
        current &&
        finalRecordRunIdRef.current !==
          current.runId
      ) {

        finalRecordRunIdRef.current =
          current.runId;


        void genZGamesApi
          .submitFlappyRocketFinalRecord({
            seed:
              current.seed,

            tickCount:
              current
                .gameState
                .tick,

            flapEvents:
              current
                .flapEvents,

            reviveTick:
              current
                .reviveTick,
          })
          .catch(
            error => {

              console.error(
                "Unable to submit Flappy Rocket final record:",
                error,
              );


              if (
                finalRecordRunIdRef.current ===
                  current.runId
              ) {

                finalRecordRunIdRef.current =
                  null;
              }
            },
          );
      }


      setCrashFlash(
        previous =>
          previous +
          1,
      );


      playGameSound(
        "game-failed",
      );


      const burst:
        Particle[] =
        Array.from(
          {
            length:
              8,
          },

          () => ({
            id:
              makeVisualId(),

            x:
              FLAPPY_PLAYER_X,

            y:
              state.rocketY,

            dx:
              visualRandomBetween(
                -3.4,
                3.4,
              ),

            dy:
              visualRandomBetween(
                -3.2,
                3.2,
              ),

            size:
              visualRandomBetween(
                5,
                12,
              ),

            life:
              visualRandomBetween(
                16,
                28,
              ),

            color:
              Math.random() >
              0.5
                ? "#fb7185"
                : "#f59e0b",
          }),
        );


      setParticles(
        previous => [
          ...previous,
          ...burst,
        ],
      );
    }


    previousGameOverRef.current =
      state.isGameOver;

  }, [
    run?.gameState,
    bestScore,
  ]);


  useEffect(() => {

    const milestoneReached =
      run
        ?.rewardMilestoneTick !==
      null &&
      run
        ?.rewardMilestoneTick !==
      undefined;


    if (
      milestoneReached &&
      !previousMilestoneRef.current
    ) {

      playGameSound(
        "game-complete",
      );
    }


    previousMilestoneRef.current =
      milestoneReached;

  }, [
    run?.rewardMilestoneTick,
  ]);


  /*
   * =====================================================
   * BACKEND REWARD CLAIM
   * =====================================================
   */

  const completeRun =
    useCallback(
      async () => {

        const current =
          runRef.current;


        const milestoneTick =
          current
            ?.rewardMilestoneTick ??
          null;


        if (
          !currentUser ||
          !current ||
          milestoneTick ===
            null ||
          current.rewardClaimed ||
          claiming ||
          claimInFlightRef.current
        ) {

          return;
        }


        claimInFlightRef.current =
          true;


        setClaiming(
          true,
        );


        setCompletionError(
          null,
        );


        try {

          const milestoneFlapEvents =
            current.flapEvents.filter(
              event =>
                event.tick <=
                milestoneTick,
            );


          const milestoneReviveTick =
            current.reviveTick !==
              null &&
            current.reviveTick <=
              milestoneTick
              ? current.reviveTick
              : null;


          const elapsedSeconds =
            Math.max(
              1,

              Math.min(
                86400,

                Math.floor(
                  (
                    Date.now() -
                    current.startedAt
                  ) /
                    1000,
                ),
              ),
            );


          /*
           * This is the ONE backend reward
           * verification call at score 50.
           */
          const result =
            await genZGamesApi
              .completeFlappyRocketRun({
                runId:
                  current.runId,

                seed:
                  current.seed,

                tickCount:
                  milestoneTick,

                flapEvents:
                  milestoneFlapEvents,

                reviveTick:
                  milestoneReviveTick,

                elapsedSeconds,
              });


          setClaimResult(
            result,
          );


          const latest =
            runRef.current;


          if (
            latest &&
            latest.runId ===
              current.runId
          ) {

            const claimedRun:
              SavedGenZFlappyRocketRun = {

                ...latest,

                rewardClaimed:
                  true,

                updatedAt:
                  Date.now(),
              };


            setRun(
              claimedRun,
            );

            runRef.current =
              claimedRun;


            /*
             * Continue endless play after 50.
             */
            if (
              !claimedRun
                .gameState
                .isGameOver
            ) {

              persistRun(
                claimedRun,
              );

            } else {

              persistRun(
                null,
              );
            }
          }


          if (
            result.diamondsGranted >
            0
          ) {

            setShowDiamondFly(
              true,
            );
          }


          /*
           * No second get-summary call.
           *
           * Update the already-loaded parent
           * summary from the callable response.
           */
          if (
            summary
          ) {

            const sameDiamondDay =
              summary
                .diamonds
                .dayKey ===
              result
                .diamondDayKey;


            onSummaryChange({
              ...summary,

              balancePaise:
                result.balancePaise,

              lifetimeEarningsPaise:
                result
                  .lifetimeEarningsPaise,

              diamonds: {
                ...summary.diamonds,

                dayKey:
                  result
                    .diamondDayKey,

                today:
                  result
                    .todayDiamonds,

                lifetime:
                  result
                    .lifetimeDiamonds,

                sudokuToday:
                  sameDiamondDay
                    ? summary
                        .diamonds
                        .sudokuToday
                    : 0,

                miningToday:
                  sameDiamondDay
                    ? summary
                        .diamonds
                        .miningToday
                    : 0,

                referralToday:
                  sameDiamondDay
                    ? summary
                        .diamonds
                        .referralToday
                    : 0,

                game2048Today:
                  sameDiamondDay
                    ? summary
                        .diamonds
                        .game2048Today
                    : 0,

                snakeToday:
                  sameDiamondDay
                    ? summary
                        .diamonds
                        .snakeToday
                    : 0,

                flappyRocketToday:
                  (
                    sameDiamondDay
                      ? summary
                          .diamonds
                          .flappyRocketToday
                      : 0
                  ) +
                  result
                    .diamondsGranted,
              },

              flappyRocket: {
                completedRuns:
                  result
                    .completedRuns,
              },
            });
          }


          if (
            result.rewardGranted
          ) {

            addToast(
              `${formatGamePaise(
                result.rewardPaise,
              )} + ${result.diamondsGranted} diamonds earned!`,
              "success",
            );

          } else {

            addToast(
              "This Flappy Rocket run was already verified.",
              "info",
            );
          }

        } catch (
          error
        ) {

          console.error(
            "Unable to verify Flappy Rocket reward:",
            error,
          );


          setCompletionError(
            "Unable to verify your reward. Your run is saved locally.",
          );


          const latest =
            runRef.current;


          if (
            latest
          ) {

            persistRun(
              latest,
            );
          }


          addToast(
            "Flappy Rocket reward verification failed.",
            "error",
          );

        } finally {

          claimInFlightRef.current =
            false;


          setClaiming(
            false,
          );
        }
      },
      [
        currentUser,
        claiming,
        summary,
        onSummaryChange,
        addToast,
        persistRun,
      ],
    );


  /*
   * Automatically verify when score 50
   * is first reached.
   */
  useEffect(() => {

    if (
      !run ||
      run.rewardMilestoneTick ===
        null ||
      run.rewardClaimed ||
      claiming ||
      completionError
    ) {

      return;
    }


    void completeRun();

  }, [
    run,
    claiming,
    completionError,
    completeRun,
  ]);


  /*
   * =====================================================
   * ONE PRE-50 REVIVE
   * =====================================================
   */

  const handleRewardRevive =
    useCallback(
      async () => {

        const current =
          runRef.current;


        if (
          !current ||
          reviving ||
          !current.gameState.isGameOver ||
          current.gameState.reviveUsed ||
          current.gameState.score >=
            FLAPPY_REWARD_SCORE
        ) {

          return;
        }


        setReviving(
          true,
        );


        try {

          const rewarded =
            await showGenZGamesRewardedAd();


          if (
            !rewarded
          ) {

            addToast(
              "Watch the full ad to use your one revive.",
              "info",
            );


            return;
          }


          const reviveTick =
            current.gameState.tick;


          const revivedState =
            reviveFlappyRocketState(
              current.gameState,
            );


          if (
            revivedState.isGameOver ||
            !revivedState.reviveUsed
          ) {

            addToast(
              "Unable to revive this run.",
              "error",
            );


            return;
          }


          const nextRun:
            SavedGenZFlappyRocketRun = {

              ...current,

              gameState:
                revivedState,

              reviveTick,

              updatedAt:
                Date.now(),
            };


          setRun(
            nextRun,
          );

          runRef.current =
            nextRun;


          persistRun(
            nextRun,
          );


          previousGameOverRef.current =
            false;

          lastFrameTimeRef.current =
  0;

accumulatorRef.current =
  0;


/*
 * Revive is now prepared, but frozen.
 *
 * The player decides when to continue,
 * so the rewarded revive can never be
 * wasted while the ad is closing.
 */
setIsPaused(
  false,
);


setWaitingForTap(
  true,
);


setScreen(
  "GAME",
);

          playTone(
            860,
            "triangle",
            0.16,
            0.34,
          );

        } finally {

          setReviving(
            false,
          );
        }
      },
      [
        reviving,
        addToast,
        persistRun,
      ],
    );


  const selectCharacter =
    (
      character:
        FlappyRocketCharacterKey,
    ) => {

      setSelectedCharacter(
        character,
      );

      saveCharacter(
        character,
      );


      playTone(
        620,
        "triangle",
        0.06,
        0.26,
      );
    };


 const handleGameBack =
  () => {

    const current =
      runRef.current;


    if (
      current
    ) {

      persistRun(
        current,
      );
    }


    setIsPaused(
      false,
    );


    setScreen(
      "HOME",
    );
  };


const pauseGame =
  () => {

    const current =
      runRef.current;


    if (
      screen !==
        "GAME" ||
      !current ||
      current.gameState.isGameOver ||
      waitingForTap ||
      isPaused
    ) {
      return;
    }


    accumulatorRef.current =
      0;

    lastFrameTimeRef.current =
      0;


    persistRun(
      current,
    );


    setIsPaused(
      true,
    );
  };


  const resumePausedGame =
    () => {

      if (
        !isPaused
      ) {
        return;
      }


      accumulatorRef.current =
        0;

      lastFrameTimeRef.current =
        0;


      setIsPaused(
        false,
      );
    };


  const rocketRotation =
    useMemo(
      () => {

        const velocity =
          gameState
            ?.rocketVelocity ??
          0;


        if (
          selectedCharacter ===
          "ball"
        ) {

          return clamp(
            velocity *
              8.5,

            -180,
            180,
          );
        }


        if (
          selectedCharacter ===
          "ufo"
        ) {

          return clamp(
            velocity *
              2.2,

            -8,
            12,
          );
        }


        if (
          selectedCharacter ===
          "bird"
        ) {

          return clamp(
            velocity *
              4.5,

            -22,
            40,
          );
        }


        return clamp(
          velocity *
            5.8,

          -28,
          65,
        );
      },
      [
        gameState
          ?.rocketVelocity,
        selectedCharacter,
      ],
    );


  /*
   * =====================================================
   * GAME BOARD
   * =====================================================
   */

  const gamePanel = (
    <div
      className="
        flex
        h-full
        min-h-0
        flex-col
        gap-3
      "
    >

      <div
        className="
          grid
          shrink-0
          grid-cols-3
          gap-2
        "
      >

        <div
          className="
            rounded-2xl
            border
            app-border
            app-surface
            p-3
            text-center
          "
        >
          <p
            className="
              text-[9px]
              font-black
              uppercase
              tracking-widest
              app-text-muted
            "
          >
            Score
          </p>

          <p
            className="
              mt-1
              text-2xl
              font-black
              text-orange-500
            "
          >
            {score}
          </p>
        </div>


        <div
          className="
            rounded-2xl
            border
            app-border
            app-surface
            p-3
            text-center
          "
        >
          <p
            className="
              text-[9px]
              font-black
              uppercase
              tracking-widest
              app-text-muted
            "
          >
            Best
          </p>

          <p
            className="
              mt-1
              text-2xl
              font-black
            "
          >
            {bestScore}
          </p>
        </div>


        <div
          className="
            rounded-2xl
            border
            app-border
            app-surface
            p-3
            text-center
          "
        >
          <p
            className="
              text-[9px]
              font-black
              uppercase
              tracking-widest
              app-text-muted
            "
          >
            Revive
          </p>

          <p
            className="
              mt-2
              text-xs
              font-black
            "
          >
            {
              score >=
              FLAPPY_REWARD_SCORE
                ? "Locked"
                : gameState
                    ?.reviveUsed
                  ? "Used"
                  : "Ready"
            }
          </p>
        </div>

      </div>


      <div
        className={`
          relative
          mx-auto
          min-h-0
          w-full
          max-w-[420px]
          flex-1
          overflow-hidden
          rounded-[30px]
          border
          border-white/30
          bg-slate-900
          shadow-2xl
          select-none
          touch-none
          ${
            crashFlash %
              2 ===
            1
              ? "ring-4 ring-red-400/50"
              : ""
          }
        `}
        style={{
          aspectRatio:
            `${FLAPPY_GAME_WIDTH}/${FLAPPY_GAME_HEIGHT}`,
        }}
        onPointerDown={
          event => {

            event.preventDefault();


            if (
              screen ===
              "GAME"
            ) {

              flap();
            }
          }
        }
      >

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-b
            from-sky-300
            via-cyan-200
            to-orange-100
            dark:from-slate-900
            dark:via-slate-800
            dark:to-slate-950
          "
        />


        <div
          className="
            absolute
            inset-0
            opacity-45
          "
        >

          {stars.map(
            star => (
              <div
                key={
                  star.id
                }
                className="
                  absolute
                  rounded-full
                  bg-white
                "
                style={{
                  left:
                    `${(
                      star.x /
                      FLAPPY_GAME_WIDTH
                    ) *
                    100}%`,

                  top:
                    `${(
                      star.y /
                      FLAPPY_GAME_HEIGHT
                    ) *
                    100}%`,

                  width:
                    star.size,

                  height:
                    star.size,

                  opacity:
                    star.alpha,

                  boxShadow:
                    "0 0 8px rgba(255,255,255,0.6)",
                }}
              />
            ),
          )}

        </div>


        <div
          className="
            absolute
            inset-0
          "
        >

          {clouds.map(
            cloud => (
              <div
                key={
                  cloud.id
                }
                className="
                  absolute
                  text-white/90
                  drop-shadow
                "
                style={{
                  left:
                    `${(
                      cloud.x /
                      FLAPPY_GAME_WIDTH
                    ) *
                    100}%`,

                  top:
                    `${(
                      cloud.y /
                      FLAPPY_GAME_HEIGHT
                    ) *
                    100}%`,

                  transform:
                    `scale(${cloud.scale})`,

                  fontSize:
                    38,
                }}
              >
                ☁️
              </div>
            ),
          )}

        </div>


        <div
          className="
            absolute
            bottom-[15%]
            left-[-5%]
            h-[16%]
            w-[48%]
            rounded-[50%]
            bg-emerald-500/40
          "
        />

        <div
          className="
            absolute
            bottom-[14%]
            left-[20%]
            h-[17%]
            w-[58%]
            rounded-[50%]
            bg-lime-500/35
          "
        />

        <div
          className="
            absolute
            bottom-[15%]
            right-[-8%]
            h-[17%]
            w-[55%]
            rounded-[50%]
            bg-green-500/35
          "
        />


        <div
          className="
            absolute
            bottom-0
            left-0
            right-0
            h-[20%]
            bg-gradient-to-t
            from-orange-700
            via-orange-500
            to-orange-300/20
          "
        />

        <div
          className="
            absolute
            bottom-0
            left-0
            right-0
            h-[14%]
            bg-gradient-to-t
            from-emerald-700
            via-emerald-500
            to-transparent
            opacity-75
          "
        />


        {gameState
          ?.obstacles
          .map(
            obstacle => {

              const gapTop =
                obstacle.gapY -
                obstacle.gapHeight /
                  2;


              const gapBottom =
                obstacle.gapY +
                obstacle.gapHeight /
                  2;


              return (
                <React.Fragment
                  key={
                    obstacle.id
                  }
                >

                  <div
                    className="
                      absolute
                      rounded-b-[14px]
                    "
                    style={{
                      left:
                        `${(
                          obstacle.x /
                          FLAPPY_GAME_WIDTH
                        ) *
                        100}%`,

                      top:
                        0,

                      width:
                        `${(
                          obstacle.width /
                          FLAPPY_GAME_WIDTH
                        ) *
                        100}%`,

                      height:
                        `${(
                          gapTop /
                          FLAPPY_GAME_HEIGHT
                        ) *
                        100}%`,

                      background:
                        "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
                    }}
                  />


                  <div
                    className="
                      absolute
                      rounded-t-[14px]
                    "
                    style={{
                      left:
                        `${(
                          obstacle.x /
                          FLAPPY_GAME_WIDTH
                        ) *
                        100}%`,

                      top:
                        `${(
                          gapBottom /
                          FLAPPY_GAME_HEIGHT
                        ) *
                        100}%`,

                      width:
                        `${(
                          obstacle.width /
                          FLAPPY_GAME_WIDTH
                        ) *
                        100}%`,

                      height:
                        `${(
                          (
                            FLAPPY_GAME_HEIGHT -
                            gapBottom
                          ) /
                          FLAPPY_GAME_HEIGHT
                        ) *
                        100}%`,

                      background:
                        "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
                    }}
                  />

                </React.Fragment>
              );
            },
          )}


        {particles.map(
          particle => (
            <div
              key={
                particle.id
              }
              className="
                pointer-events-none
                absolute
                rounded-full
              "
              style={{
                left:
                  `${(
                    particle.x /
                    FLAPPY_GAME_WIDTH
                  ) *
                  100}%`,

                top:
                  `${(
                    particle.y /
                    FLAPPY_GAME_HEIGHT
                  ) *
                  100}%`,

                width:
                  particle.size,

                height:
                  particle.size,

                opacity:
                  Math.max(
                    0,
                    particle.life /
                      24,
                  ),

                background:
                  particle.color,

                boxShadow:
                  `0 0 10px ${particle.color}`,
              }}
            />
          ),
        )}


        {gameState && (
          <div
            className="
              absolute
              z-20
            "
            style={{
              left:
                `${(
                  FLAPPY_PLAYER_X /
                  FLAPPY_GAME_WIDTH
                ) *
                100}%`,

              top:
                `${(
                  gameState.rocketY /
                  FLAPPY_GAME_HEIGHT
                ) *
                100}%`,

              width:
                FLAPPY_PLAYER_SIZE,

              height:
                FLAPPY_PLAYER_SIZE,

              transform:
                `
                  translate(-50%, -50%)
                  rotate(${rocketRotation}deg)
                  scale(${
                    tapPulse %
                      2 ===
                    1
                      ? 1.04
                      : 1
                  })
                `,

              transition:
                "transform 70ms linear",
            }}
          >

            <div
  className="
    absolute
    inset-0
    flex
    items-center
    justify-center
    text-[30px]
    drop-shadow-[0_8px_14px_rgba(0,0,0,0.28)]
  "
  style={{
    transform:
      selectedCharacter ===
      "bird"
        ? "scaleX(-1)"
        : undefined,
  }}
>
  {
    activeCharacter
      .emoji
  }
</div>

          </div>
        )}


        <div
          className="
            absolute
            left-3
            right-3
            top-3
            z-30
            flex
            items-start
            justify-between
            gap-3
          "
        >

          <div
  className="
    flex
    items-center
    gap-2
  "
>
  <button
    type="button"
    onPointerDown={
      event =>
        event
          .stopPropagation()
    }
    onClick={
      event => {

        event.stopPropagation();

        handleGameBack();
      }
    }
    className="
      flex
      h-11
      w-11
      items-center
      justify-center
      rounded-full
      border
      border-white/20
      bg-black/20
      text-white
      backdrop-blur
      active:scale-95
    "
    aria-label="Back"
  >
    <ArrowLeft
      className="
        h-5
        w-5
      "
    />
  </button>


  <button
    type="button"
    disabled={
      waitingForTap ||
      isPaused
    }
    onPointerDown={
      event =>
        event
          .stopPropagation()
    }
    onClick={
      event => {

        event.stopPropagation();

        pauseGame();
      }
    }
    className="
      flex
      h-11
      w-11
      items-center
      justify-center
      rounded-full
      border
      border-white/20
      bg-black/20
      text-white
      backdrop-blur
      active:scale-95
      disabled:opacity-40
    "
    aria-label="Pause"
  >
    <Pause
      className="
        h-5
        w-5
      "
    />
  </button>
</div>


          <div
            className="
              rounded-2xl
              bg-black/25
              px-3
              py-2
              text-center
              text-white
              backdrop-blur
            "
          >
            <p
              className="
                text-[8px]
                font-black
                uppercase
                tracking-widest
                text-white/70
              "
            >
              {
                score <
                FLAPPY_REWARD_SCORE
                  ? `${score}/${FLAPPY_REWARD_SCORE}`
                  : "Endless"
              }
            </p>

            <p
              className="
                text-lg
                font-black
              "
            >
              {score}
            </p>
          </div>

        </div>


        {score <
          FLAPPY_REWARD_SCORE && (
          <div
            className="
              absolute
              left-4
              right-4
              top-[72px]
              z-20
            "
          >

            <div
              className="
                h-1.5
                overflow-hidden
                rounded-full
                bg-black/20
              "
            >
              <div
                className="
                  h-full
                  rounded-full
                  bg-emerald-400
                  transition-all
                "
                style={{
                  width:
                    `${rewardProgress}%`,
                }}
              />
            </div>

          </div>
        )}


        {screen ===
  "GAME" &&
  waitingForTap && (
  <div
    className="
      pointer-events-none
      absolute
      inset-0
      z-30
      flex
      items-center
      justify-center
    "
  >
    <div
      className="
        animate-pulse
        rounded-2xl
        border
        border-white/20
        bg-black/35
        px-6
        py-4
        text-center
        text-white
        shadow-xl
        backdrop-blur-md
      "
    >
      <p
        className="
          text-lg
          font-black
        "
      >
        {
          gameState
            ?.reviveUsed ||
          (
            gameState
              ?.tick ??
            0
          ) >
            0
            ? "Tap to Continue"
            : "Tap to Start"
        }
      </p>

      <p
        className="
          mt-1
          text-[9px]
          font-bold
          uppercase
          tracking-[0.16em]
          text-white/75
        "
      >
        Tap Screen or Press Space
      </p>
    </div>
  </div>
)}

{screen ===
  "GAME" &&
  isPaused && (
  <div
    className="
      absolute
      inset-0
      z-40
      flex
      items-center
      justify-center
      bg-black/25
      backdrop-blur-[2px]
    "
    onPointerDown={
      event =>
        event
          .stopPropagation()
    }
  >
    <div
      className="
        rounded-3xl
        border
        border-white/20
        bg-black/55
        px-7
        py-6
        text-center
        text-white
        shadow-2xl
        backdrop-blur-md
      "
    >
      <Pause
        className="
          mx-auto
          h-8
          w-8
        "
      />

      <p
        className="
          mt-3
          text-2xl
          font-black
        "
      >
        Paused
      </p>

      <p
        className="
          mt-1
          text-[10px]
          font-bold
          uppercase
          tracking-widest
          text-white/70
        "
      >
        Your flight is frozen
      </p>


      <button
        type="button"
        onPointerDown={
          event =>
            event
              .stopPropagation()
        }
        onClick={
          event => {

            event.stopPropagation();

            resumePausedGame();
          }
        }
        className="
          mt-5
          inline-flex
          items-center
          gap-2
          rounded-2xl
          bg-orange-500
          px-6
          py-3
          text-sm
          font-black
          text-white
          active:scale-95
        "
      >
        <Play
          className="
            h-4
            w-4
          "
        />

        Resume
      </button>
    </div>
  </div>
)}


{screen ===
  "GAME" &&
  !waitingForTap &&
  !isPaused && (
  <div
    className="
      pointer-events-none
      absolute
      bottom-20
      left-1/2
      z-30
      -translate-x-1/2
    "
  >
    <div
      className="
        whitespace-nowrap
        rounded-full
        bg-black/20
        px-4
        py-2
        text-[9px]
        font-black
        uppercase
        tracking-[0.18em]
        text-white
        backdrop-blur
      "
    >
      Tap / Space to Fly
    </div>
  </div>
)}

      </div>

    </div>
  );


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <>

      {showDiamondFly &&
        claimResult &&
        claimResult.diamondsGranted >
          0 && (
          <DiamondFlyReward
            amount={
              claimResult
                .diamondsGranted
            }
            onDone={() =>
              setShowDiamondFly(
                false,
              )
            }
          />
        )}


      <div
  className="
    h-[100svh]
    w-full
    overflow-hidden
    bg-[var(--app-bg)]
    app-text
  "
  style={{
    paddingBottom:
      `calc(env(safe-area-inset-bottom) + ${BANNER_RESERVE_PX}px)`,
  }}
>

  <div
    className="
      mx-auto
      flex
      h-full
      w-full
      max-w-3xl
      flex-col
      overflow-hidden
      px-4
      pb-3
      pt-[calc(env(safe-area-inset-top)+12px)]
      sm:px-6
    "
  >

          {screen ===
            "HOME" && (
            <div
              className="
                flex-1
                overflow-y-auto
                overscroll-contain
                pb-6
              "
            >

              <div
                className="
                  relative
                  overflow-hidden
                  rounded-[30px]
                  bg-gradient-to-br
                  from-orange-600
                  via-orange-500
                  to-amber-400
                  px-5
                  pb-7
                  pt-5
                  text-white
                  shadow-xl
                "
              >

                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-3
                  "
                >

                  <button
                    type="button"
                    onClick={
                      onBack
                    }
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      bg-white/15
                      backdrop-blur
                      active:scale-95
                    "
                    aria-label="Back to GenZGames"
                  >
                    <ArrowLeft
                      className="
                        h-5
                        w-5
                      "
                    />
                  </button>


                  <DiamondCounter
                    compact
                    diamonds={
                      summary
                        ?.diamonds
                        .today ??
                      claimResult
                        ?.todayDiamonds ??
                      0
                    }
                  />

                </div>


                <div
                  className="
                    relative
                    z-10
                    mt-5
                    text-center
                  "
                >

                  <div
                    className="
                      text-6xl
                    "
                  >
                    🚀
                  </div>


                  <p
                    className="
                      mt-3
                      text-[9px]
                      font-black
                      uppercase
                      tracking-[0.3em]
                      text-white/75
                    "
                  >
                    GenZGames Arcade
                  </p>


                  <h1
                    className="
                      mt-1
                      text-3xl
                      font-black
                    "
                  >
                    Flappy Rocket
                  </h1>


                  <p
                    className="
                      mt-2
                      text-xs
                      font-bold
                      text-white/85
                    "
                  >
                    Fly to 50 • Earn • Continue Endless
                  </p>

                </div>

              </div>


              <div
                className="
                  mt-4
                  grid
                  grid-cols-3
                  gap-2
                "
              >

                <div
                  className="
                    rounded-2xl
                    border
                    app-border
                    app-surface
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-black
                      uppercase
                      app-text-muted
                    "
                  >
                    Best
                  </p>

                  <p
                    className="
                      mt-1
                      text-xl
                      font-black
                      text-orange-500
                    "
                  >
                    {bestScore}
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    border
                    border-emerald-500/20
                    bg-emerald-500/5
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-black
                      uppercase
                      text-emerald-500
                    "
                  >
                    Reward
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    {
                      formatGamePaise(
                        FLAPPY_REWARD_PAISE,
                      )
                    }
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    border
                    border-cyan-500/20
                    bg-cyan-500/5
                    p-3
                    text-center
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-black
                      uppercase
                      text-cyan-500
                    "
                  >
                    Diamonds
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-black
                    "
                  >
                    💎 {
                      FLAPPY_DIAMOND_REWARD
                    }
                  </p>
                </div>

              </div>


              <div
                className="
                  mt-4
                  rounded-[26px]
                  border
                  app-border
                  app-surface
                  p-4
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >

                  <div>
                    <p
                      className="
                        text-[10px]
                        font-black
                        uppercase
                        tracking-widest
                        app-text-muted
                      "
                    >
                      Reward Target
                    </p>

                    <p
                      className="
                        mt-1
                        text-lg
                        font-black
                      "
                    >
                      Pass {
                        FLAPPY_REWARD_SCORE
                      } Gates
                    </p>
                  </div>


                  <Trophy
                    className="
                      h-7
                      w-7
                      text-amber-500
                    "
                  />

                </div>


                <div
                  className="
                    mt-4
                    space-y-2
                    text-xs
                    font-semibold
                    app-text-secondary
                  "
                >
                  <p>
                    🎬 Rewarded ad starts each new run.
                  </p>

                  <p>
                    ❤️ One rewarded-ad revive is available only before 50.
                  </p>

                  <p>
                    💰 Reach 50 to earn ₹0.05 + 10 diamonds.
                  </p>

                  <p>
                    ♾️ After 50, continue for your best score. No revive after 50.
                  </p>
                </div>

              </div>


              <div
                className="
                  mt-4
                  rounded-[26px]
                  border
                  app-border
                  app-surface
                  p-4
                "
              >

                <p
                  className="
                    text-[10px]
                    font-black
                    uppercase
                    tracking-widest
                    app-text-muted
                  "
                >
                  Choose Player
                </p>


                <div
                  className="
                    mt-3
                    grid
                    grid-cols-4
                    gap-2
                  "
                >

                  {CHARACTERS.map(
                    character => {

                      const active =
                        character.key ===
                        selectedCharacter;


                      return (
                        <button
                          key={
                            character.key
                          }
                          type="button"
                          onClick={() =>
                            selectCharacter(
                              character.key,
                            )
                          }
                          className={`
                            rounded-2xl
                            border
                            p-3
                            text-center
                            transition
                            active:scale-95
                            ${
                              active
                                ? "border-orange-500 bg-orange-500 text-white shadow"
                                : "app-border app-surface-secondary"
                            }
                          `}
                        >
                          <div
                            className="
                              text-2xl
                            "
                          >
                            {
                              character
                                .emoji
                            }
                          </div>

                          <div
                            className="
                              mt-1
                              text-[9px]
                              font-black
                              uppercase
                            "
                          >
                            {
                              character
                                .label
                            }
                          </div>
                        </button>
                      );
                    },
                  )}

                </div>

              </div>


              {run && (
                <div
                  className="
                    mt-4
                    rounded-[26px]
                    border
                    border-orange-500/20
                    bg-orange-500/5
                    p-4
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >

                    <div>
                      <p
                        className="
                          text-[10px]
                          font-black
                          uppercase
                          tracking-widest
                          text-orange-500
                        "
                      >
                        Saved Run
                      </p>

                      <p
                        className="
                          mt-1
                          text-lg
                          font-black
                        "
                      >
                        Score {
                          run
                            .gameState
                            .score
                        }
                      </p>

                      <p
                        className="
                          mt-1
                          text-[10px]
                          app-text-muted
                        "
                      >
                        {
                          run
                            .gameState
                            .isGameOver
                            ? reviveAvailable
                              ? "Crash saved • one revive available"
                              : hasPendingReward
                                ? "Reward verification pending"
                                : "Run finished"
                            : run.rewardClaimed
                              ? "Reward earned • endless run active"
                              : "Flight saved locally"
                        }
                      </p>
                    </div>


                    <button
                      type="button"
                      onClick={
                        resumeRun
                      }
                      className="
                        flex
                        h-11
                        w-11
                        items-center
                        justify-center
                        rounded-full
                        bg-orange-500
                        text-white
                        active:scale-95
                      "
                    >
                      <Play
                        className="
                          h-5
                          w-5
                        "
                      />
                    </button>

                  </div>

                </div>
              )}


              {completionError && (
                <div
                  className="
                    mt-4
                    rounded-2xl
                    border
                    border-red-500/20
                    bg-red-500/10
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      text-red-500
                    "
                  >
                    {
                      completionError
                    }
                  </p>


                  <button
                    type="button"
                    disabled={
                      claiming
                    }
                    onClick={() => {

                      setCompletionError(
                        null,
                      );

                      void completeRun();
                    }}
                    className="
                      mt-3
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      bg-red-500
                      px-4
                      py-2
                      text-xs
                      font-black
                      text-white
                      disabled:opacity-50
                    "
                  >
                    <RefreshCw
                      className="
                        h-4
                        w-4
                      "
                    />

                    {
                      claiming
                        ? "Verifying..."
                        : "Retry Reward"
                    }
                  </button>
                </div>
              )}


              <button
                type="button"
                disabled={
                  starting ||
                  hasPendingReward
                }
                onClick={() =>
                  void startNewRun()
                }
                className="
                  mt-5
                  w-full
                  rounded-2xl
                  bg-orange-500
                  py-4
                  text-sm
                  font-black
                  uppercase
                  tracking-widest
                  text-white
                  shadow-lg
                  transition
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {
                  hasPendingReward
                    ? "Verify Saved Reward First"
                    : starting
                      ? "Loading Ad..."
                      : "🎬 Start New Flight"
                }
              </button>


              <p
                className="
                  mt-3
                  text-center
                  text-[9px]
                  app-text-muted
                "
              >
                Active gameplay is stored locally. Firebase reward verification happens at the 50-point milestone.
              </p>

            </div>
          )}


          {screen ===
            "GAME" &&
            gamePanel}


          {screen ===
            "GAME_OVER" && (
            <div
              className="
                relative
                flex-1
                min-h-0
              "
            >

              {gamePanel}


              <div
                className="
                  fixed
                  inset-0
                  z-[160]
                  flex
                  items-center
                  justify-center
                  bg-slate-950/75
                  p-4
                  backdrop-blur-sm
                "
              >

                <div
                  className="
                    max-h-[calc(100svh-24px)]
                    w-full
                    max-w-sm
                    overflow-y-auto
                    rounded-[30px]
                    border
                    app-border
                    app-surface
                    p-6
                    text-center
                    shadow-2xl
                  "
                >

                  <div
                    className="
                      text-6xl
                    "
                  >
                    💥
                  </div>


                  <h2
                    className="
                      mt-3
                      text-3xl
                      font-black
                    "
                  >
                    Mission Failed
                  </h2>


                  <p
                    className="
                      mt-2
                      text-sm
                      font-semibold
                      app-text-muted
                    "
                  >
                    {
                      score >=
                      FLAPPY_REWARD_SCORE
                        ? "Your reward milestone is secured. This endless flight is now over."
                        : reviveAvailable
                          ? "You can use your one rewarded-ad revive and continue toward 50."
                          : "Your revive has already been used. Start a new flight to try again."
                    }
                  </p>


                  <div
                    className="
                      mt-5
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >

                    <div
                      className="
                        rounded-2xl
                        bg-orange-500/10
                        p-4
                      "
                    >
                      <p
                        className="
                          text-[9px]
                          font-black
                          uppercase
                          app-text-muted
                        "
                      >
                        Score
                      </p>

                      <p
                        className="
                          mt-2
                          text-3xl
                          font-black
                          text-orange-500
                        "
                      >
                        {score}
                      </p>
                    </div>


                    <div
                      className="
                        rounded-2xl
                        app-surface-secondary
                        p-4
                      "
                    >
                      <p
                        className="
                          text-[9px]
                          font-black
                          uppercase
                          app-text-muted
                        "
                      >
                        Best
                      </p>

                      <p
                        className="
                          mt-2
                          text-3xl
                          font-black
                        "
                      >
                        {bestScore}
                      </p>
                    </div>

                  </div>


                  {claiming && (
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-cyan-500/20
                        bg-cyan-500/10
                        p-3
                        text-xs
                        font-bold
                        text-cyan-500
                      "
                    >
                      Verifying ₹0.05 + 10 diamonds...
                    </div>
                  )}


                  {completionError && (
                    <div
                      className="
                        mt-4
                        rounded-2xl
                        border
                        border-red-500/20
                        bg-red-500/10
                        p-3
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-bold
                          text-red-500
                        "
                      >
                        {
                          completionError
                        }
                      </p>


                      <button
                        type="button"
                        disabled={
                          claiming
                        }
                        onClick={() => {

                          setCompletionError(
                            null,
                          );

                          void completeRun();
                        }}
                        className="
                          mt-3
                          w-full
                          rounded-xl
                          bg-red-500
                          py-3
                          text-xs
                          font-black
                          text-white
                          disabled:opacity-50
                        "
                      >
                        {
                          claiming
                            ? "Verifying..."
                            : "Retry Reward Verification"
                        }
                      </button>

                    </div>
                  )}


                  <div
                    className="
                      mt-6
                      space-y-3
                    "
                  >

                    {reviveAvailable && (
                      <button
                        type="button"
                        disabled={
                          reviving
                        }
                        onClick={() =>
                          void handleRewardRevive()
                        }
                        className="
                          w-full
                          rounded-2xl
                          bg-emerald-500
                          px-4
                          py-3.5
                          text-sm
                          font-black
                          text-white
                          disabled:opacity-50
                        "
                      >
                        {
                          reviving
                            ? "Loading Ad..."
                            : "📺 Watch Ad to Revive"
                        }
                      </button>
                    )}


                    {!hasPendingReward && (
                      <button
                        type="button"
                        disabled={
                          starting
                        }
                        onClick={() =>
                          void startNewRun()
                        }
                        className="
                          w-full
                          rounded-2xl
                          bg-orange-500
                          px-4
                          py-3.5
                          text-sm
                          font-black
                          text-white
                          disabled:opacity-50
                        "
                      >
                        {
                          starting
                            ? "Loading Ad..."
                            : "🎬 Play Again"
                        }
                      </button>
                    )}


                    <button
                      type="button"
                      onClick={
                        handleGameBack
                      }
                      className="
                        w-full
                        rounded-2xl
                        border
                        app-border
                        app-surface-secondary
                        px-4
                        py-3.5
                        text-sm
                        font-black
                      "
                    >
                      Back to Flappy Menu
                    </button>

                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

      </div>

    </>
  );
};


export default GenZFlappyRocket;