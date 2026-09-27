let sharedAudioContext:
  AudioContext |
  null =
  null;

let unlockInstalled =
  false;

let isAudioUnlocked =
  false;

let pendingSounds:
  Array<
    () => void
  > =
  [];


function getNativeAudioContextClass() {
  const browserWindow =
    window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };

  return (
    window.AudioContext ||
    browserWindow.webkitAudioContext ||
    null
  );
}


export function getAudioContext():
  AudioContext |
  null {
  try {
    const AudioContextClass =
      getNativeAudioContextClass();

    if (
      !AudioContextClass
    ) {
      return null;
    }


    if (
      !sharedAudioContext ||
      sharedAudioContext.state ===
        "closed"
    ) {
      sharedAudioContext =
        new AudioContextClass();
    }


    return sharedAudioContext;
  } catch {
    return null;
  }
}


async function warmUpAudioContext(
  ctx:
    AudioContext,
) {
  try {
    const buffer =
      ctx.createBuffer(
        1,
        1,
        22050,
      );

    const source =
      ctx.createBufferSource();

    const gain =
      ctx.createGain();


    gain.gain.value =
      0.0001;


    source.buffer =
      buffer;

    source.connect(
      gain,
    );

    gain.connect(
      ctx.destination,
    );


    source.start(
      0,
    );
  } catch {
    // Ignore audio warm-up errors.
  }
}


export async function unlockAudio():
  Promise<
    AudioContext |
    null
  > {
  try {
    const ctx =
      getAudioContext();

    if (
      !ctx
    ) {
      return null;
    }


    if (
      ctx.state ===
      "suspended"
    ) {
      await ctx.resume();
    }


    await warmUpAudioContext(
      ctx,
    );


    isAudioUnlocked =
      true;


    if (
      pendingSounds.length >
      0
    ) {
      const queued =
        [
          ...pendingSounds,
        ];

      pendingSounds =
        [];


      queued.forEach(
        (
          sound,
        ) => {
          try {
            sound();
          } catch {
            // Ignore queued sound errors.
          }
        },
      );
    }


    return ctx;
  } catch {
    return null;
  }
}


export function installGlobalAudioUnlock() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }


  if (
    unlockInstalled
  ) {
    return;
  }


  unlockInstalled =
    true;


  const unlock =
    () => {
      void unlockAudio();


      window.removeEventListener(
        "touchstart",
        unlock,
      );

      window.removeEventListener(
        "touchend",
        unlock,
      );

      window.removeEventListener(
        "pointerdown",
        unlock,
      );

      window.removeEventListener(
        "click",
        unlock,
      );

      window.removeEventListener(
        "keydown",
        unlock,
      );

      window.removeEventListener(
        "mousedown",
        unlock,
      );
    };


  window.addEventListener(
    "touchstart",
    unlock,
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    "touchend",
    unlock,
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    "pointerdown",
    unlock,
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    "click",
    unlock,
  );

  window.addEventListener(
    "keydown",
    unlock,
  );

  window.addEventListener(
    "mousedown",
    unlock,
  );
}


const GAME_AUDIO_VOLUME_BOOST =
  3;


const GAME_AUDIO_MAX_VOLUME =
  0.90;


function internalPlayTone(
  frequency:
    number,

  type:
    OscillatorType,

  duration:
    number,

  volume:
    number,
) {
  try {
    const ctx =
      getAudioContext();

    if (
      !ctx
    ) {
      return;
    }


        const now =
      ctx.currentTime;


    const boostedVolume =
      Math.min(
        GAME_AUDIO_MAX_VOLUME,

        Math.max(
          volume *
            GAME_AUDIO_VOLUME_BOOST,

          0.0001,
        ),
      );


    const oscillator =
      ctx.createOscillator();


    const gain =
      ctx.createGain();


    oscillator.type =
      type;

    oscillator.frequency
      .setValueAtTime(
        frequency,
        now,
      );


      gain.gain
      .setValueAtTime(
        boostedVolume,

        now,
      );

    gain.gain
      .exponentialRampToValueAtTime(
        0.0001,
        now +
          duration,
      );


    oscillator.connect(
      gain,
    );

    gain.connect(
      ctx.destination,
    );


    oscillator.start(
      now,
    );

    oscillator.stop(
      now +
        duration +
        0.02,
    );


    oscillator.onended =
      () => {
        try {
          oscillator.disconnect();
          gain.disconnect();
        } catch {
          // Ignore cleanup errors.
        }
      };
  } catch {
    // Sound must never break gameplay.
  }
}


export function playTone(
  frequency:
    number,

  type:
    OscillatorType =
      "sine",

  duration:
    number =
      0.08,

  volume:
    number =
      0.08,
) {
  if (
    !isAudioUnlocked
  ) {
    pendingSounds.push(
      () =>
        internalPlayTone(
          frequency,
          type,
          duration,
          volume,
        ),
    );


    void unlockAudio();

    return;
  }


  internalPlayTone(
    frequency,
    type,
    duration,
    volume,
  );
}


export function playSequence(
  tones:
    Array<{
      frequency:
        number;

      type?:
        OscillatorType;

      duration?:
        number;

      volume?:
        number;

      delayMs?:
        number;
    }>,
) {
  tones.forEach(
    (
      tone,
    ) => {
      window.setTimeout(
        () => {
          playTone(
            tone.frequency,
            tone.type ??
              "sine",
            tone.duration ??
              0.08,
            tone.volume ??
              0.08,
          );
        },
        tone.delayMs ??
          0,
      );
    },
  );
}


export type GameSoundEffect =
  | "sudoku-number-complete"
  | "sudoku-box-complete"
  | "wrong-move"
  | "game-complete"
  | "game-failed"
  | "mining-start"
  | "mining-hit"
  | "mining-collect"
  | "2048-merge"
  | "snake-food"
  | "snake-special-food"
  | "flappy-tap"
  | "flappy-gate"
  | "knife-wood-hit"
  | "knife-metal-hit"
  | "knife-apple-hit"
  | "brick-hit"
  | "candy-move"
  | "candy-match";


export function playGameSound(
  effect:
    GameSoundEffect,

  value =
    0,
) {
  switch (
    effect
  ) {

    case "sudoku-number-complete":
      playSequence([
        {
          frequency:
            660,

          type:
            "sine",

          duration:
            0.06,

          volume:
            0.16,
        },

        {
          frequency:
            820,

          type:
            "triangle",

          duration:
            0.08,

          volume:
            0.18,

          delayMs:
            55,
        },
      ]);

      return;


    case "sudoku-box-complete":
      playSequence([
        {
          frequency:
            520,

          type:
            "triangle",

          duration:
            0.07,

          volume:
            0.18,
        },

        {
          frequency:
            700,

          type:
            "triangle",

          duration:
            0.08,

          volume:
            0.20,

          delayMs:
            60,
        },

        {
          frequency:
            920,

          type:
            "triangle",

          duration:
            0.11,

          volume:
            0.22,

          delayMs:
            125,
        },
      ]);

      return;


    case "wrong-move":
      playSequence([
        {
          frequency:
            185,

          type:
            "sawtooth",

          duration:
            0.08,

          volume:
            0.22,
        },

        {
          frequency:
            135,

          type:
            "square",

          duration:
            0.13,

          volume:
            0.18,

          delayMs:
            65,
        },
      ]);

      return;


    case "game-complete":
      playSequence([
        {
          frequency:
            620,

          type:
            "triangle",

          duration:
            0.10,

          volume:
            0.20,
        },

        {
          frequency:
            820,

          type:
            "triangle",

          duration:
            0.12,

          volume:
            0.22,

          delayMs:
            85,
        },

        {
          frequency:
            1080,

          type:
            "triangle",

          duration:
            0.18,

          volume:
            0.24,

          delayMs:
            180,
        },
      ]);

      return;


    case "game-failed":
      playSequence([
        {
          frequency:
            240,

          type:
            "sawtooth",

          duration:
            0.10,

          volume:
            0.22,
        },

        {
          frequency:
            170,

          type:
            "sawtooth",

          duration:
            0.12,

          volume:
            0.20,

          delayMs:
            85,
        },

        {
          frequency:
            105,

          type:
            "square",

          duration:
            0.18,

          volume:
            0.18,

          delayMs:
            175,
        },
      ]);

      return;


    case "mining-start":
      playSequence([
        {
          frequency:
            210,

          type:
            "square",

          duration:
            0.08,

          volume:
            0.13,
        },

        {
          frequency:
            315,

          type:
            "triangle",

          duration:
            0.12,

          volume:
            0.16,

          delayMs:
            70,
        },
      ]);

      return;


    case "mining-hit":
      playSequence([
        {
          frequency:
            1180,

          type:
            "square",

          duration:
            0.025,

          volume:
            0.11,
        },

        {
          frequency:
            430,

          type:
            "sawtooth",

          duration:
            0.055,

          volume:
            0.09,

          delayMs:
            8,
        },
      ]);

      return;


    case "mining-collect":
      playSequence([
        {
          frequency:
            760,

          type:
            "sine",

          duration:
            0.07,

          volume:
            0.18,
        },

        {
          frequency:
            980,

          type:
            "triangle",

          duration:
            0.09,

          volume:
            0.20,

          delayMs:
            65,
        },

        {
          frequency:
            1240,

          type:
            "triangle",

          duration:
            0.11,

          volume:
            0.20,

          delayMs:
            135,
        },
      ]);

      return;


    case "2048-merge": {
      const safeValue =
        Math.max(
          4,
          value,
        );


      const pitch =
        Math.min(
          980,

          300 +
            Math.log2(
              safeValue,
            ) *
              62,
        );


      playSequence([
        {
          frequency:
            pitch,

          type:
            "sine",

          duration:
            0.045,

          volume:
            0.14,
        },

        {
          frequency:
            pitch *
            1.18,

          type:
            "triangle",

          duration:
            0.055,

          volume:
            0.12,

          delayMs:
            28,
        },
      ]);

      return;
    }


    case "snake-food":
      playTone(
        640,
        "sine",
        0.055,
        0.16,
      );

      return;


    case "snake-special-food":
      playSequence([
        {
          frequency:
            820,

          type:
            "triangle",

          duration:
            0.06,

          volume:
            0.18,
        },

        {
          frequency:
            1080,

          type:
            "triangle",

          duration:
            0.09,

          volume:
            0.20,

          delayMs:
            55,
        },
      ]);

      return;


    case "flappy-tap":
      playTone(
        510,
        "triangle",
        0.035,
        0.10,
      );

      return;


    case "flappy-gate":
      playTone(
        780,
        "sine",
        0.06,
        0.17,
      );

      return;


    case "knife-wood-hit":
      playSequence([
        {
          frequency:
            165,

          type:
            "triangle",

          duration:
            0.035,

          volume:
            0.18,
        },

        {
          frequency:
            95,

          type:
            "square",

          duration:
            0.045,

          volume:
            0.10,

          delayMs:
            8,
        },
      ]);

      return;


    case "knife-metal-hit":
      playSequence([
        {
          frequency:
            1280,

          type:
            "square",

          duration:
            0.045,

          volume:
            0.18,
        },

        {
          frequency:
            860,

          type:
            "sawtooth",

          duration:
            0.08,

          volume:
            0.15,

          delayMs:
            18,
        },
      ]);

      return;


    case "knife-apple-hit":
      playSequence([
        {
          frequency:
            720,

          type:
            "sine",

          duration:
            0.05,

          volume:
            0.16,
        },

        {
          frequency:
            960,

          type:
            "triangle",

          duration:
            0.08,

          volume:
            0.18,

          delayMs:
            45,
        },
      ]);

      return;


    case "brick-hit":
      playTone(
        470,
        "square",
        0.025,
        0.07,
      );

      return;


    case "candy-move":
      playTone(
        380,
        "sine",
        0.035,
        0.08,
      );

      return;


    case "candy-match":
      playSequence([
        {
          frequency:
            580,

          type:
            "triangle",

          duration:
            0.045,

          volume:
            0.12,
        },

        {
          frequency:
            760,

          type:
            "triangle",

          duration:
            0.055,

          volume:
            0.13,

          delayMs:
            35,
        },
      ]);

      return;
  }
}