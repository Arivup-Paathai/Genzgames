let sharedAudioContext: AudioContext | null = null;
let unlockInstalled = false;
let isAudioUnlocked = false;
let pendingSounds: Array<() => void> = [];

function getNativeAudioContextClass() {
  const w = window as any;
  return w.AudioContext || w.webkitAudioContext || null;
}

export function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = getNativeAudioContextClass();
    if (!AudioContextClass) return null;

    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioContextClass();
    }

    return sharedAudioContext;
  } catch {
    return null;
  }
}

async function warmUpAudioContext(ctx: AudioContext) {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    gain.gain.value = 0.0001;

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(0);
  } catch {
    // ignore warmup errors
  }
}

export async function unlockAudio(): Promise<AudioContext | null> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return null;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    await warmUpAudioContext(ctx);
    isAudioUnlocked = true;

    if (pendingSounds.length > 0) {
      const queued = [...pendingSounds];
      pendingSounds = [];
      queued.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore queued sound errors
        }
      });
    }

    return ctx;
  } catch {
    return null;
  }
}

export function installGlobalAudioUnlock() {
  if (typeof window === "undefined") return;
  if (unlockInstalled) return;

  unlockInstalled = true;

  const unlock = () => {
    void unlockAudio();

    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("touchend", unlock);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("mousedown", unlock);
  };

  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("touchend", unlock, { passive: true });
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("mousedown", unlock);
}

function internalPlayTone(
  frequency: number,
  type: OscillatorType,
  duration: number,
  volume: number
) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(Math.max(volume, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore cleanup errors
      }
    };
  } catch {
    // ignore sound errors
  }
}

export function playTone(
  frequency: number,
  type: OscillatorType = "sine",
  duration: number = 0.08,
  volume: number = 0.08
) {
  if (!isAudioUnlocked) {
    pendingSounds.push(() => internalPlayTone(frequency, type, duration, volume));
    void unlockAudio();
    return;
  }

  internalPlayTone(frequency, type, duration, volume);
}

export function playSequence(
  tones: Array<{
    frequency: number;
    type?: OscillatorType;
    duration?: number;
    volume?: number;
    delayMs?: number;
  }>
) {
  tones.forEach((tone) => {
    window.setTimeout(() => {
      playTone(
        tone.frequency,
        tone.type ?? "sine",
        tone.duration ?? 0.08,
        tone.volume ?? 0.08
      );
    }, tone.delayMs ?? 0);
  });
}