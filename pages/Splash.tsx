import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import splashLogo from "../assets/splash-logo.png";
import { getAudioContext } from "../audioManager";

const Splash: React.FC = () => {
  const navigate = useNavigate();
  const playSplashSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const playTone = (
      freq: number,
      delay: number,
      duration = 0.2,
      volume = 0.26,
      type: OscillatorType = "triangle"
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + delay + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore cleanup errors
        }
      };
    };

    playTone(420, 0, 0.16, 0.28, "sine");
    playTone(620, 0.12, 0.18, 0.32, "triangle");
    playTone(920, 0.28, 0.24, 0.36, "triangle");
  } catch {
    // ignore audio errors
  }
};


   useEffect(() => {
  playSplashSound();

  const t = setTimeout(() => {
    navigate("/home");
  }, 2200);

  return () => clearTimeout(t);
}, [navigate]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center orange-gradient relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>

      {/* floating particles */}
      <div className="absolute top-[18%] left-[20%] w-4 h-4 rounded-full bg-white/20 blur-sm animate-ping"></div>
      <div className="absolute top-[28%] right-[22%] w-5 h-5 rounded-full bg-white/20 blur-sm animate-pulse"></div>
      <div className="absolute bottom-[28%] left-[24%] w-3 h-3 rounded-full bg-white/25 blur-sm animate-ping"></div>
      <div className="absolute bottom-[22%] right-[18%] w-6 h-6 rounded-full bg-white/15 blur-md animate-pulse"></div>

            {/* logo glow burst */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-72 h-72 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
        <div className="absolute w-56 h-56 rounded-full border border-white/20 animate-ping opacity-40"></div>

        {/* cropped icon from current logo image */}
        <div className="relative animate-[splashPop_1.2s_ease-out]">
          <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-[2rem] overflow-hidden flex items-center justify-center drop-shadow-[0_14px_30px_rgba(0,0,0,0.35)] bg-transparent">
  <img
    src={splashLogo}
    alt="GenZGames"
    className="w-full h-full object-contain"
  />
</div>
        </div>
      </div>

            {/* title */}
      <div className="mt-6 text-white text-center animate-[titleRise_1s_ease-out]">
        <h1 className="text-4xl font-black tracking-tight drop-shadow-md uppercase">
          GenZGames
        </h1>

                <p className="text-sm font-medium opacity-90 mt-2 uppercase tracking-widest bg-black/10 inline-block px-4 py-1 rounded-full backdrop-blur-sm shadow-md">
          Play and Enjoy
        </p>
      </div>

      {/* loader */}
      <div className="absolute bottom-12">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>

      <style>{`
        @keyframes splashPop {
          0% {
            transform: scale(0.72);
            opacity: 0;
          }
          45% {
            transform: scale(1.08);
            opacity: 1;
          }
          70% {
            transform: scale(0.96);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes titleRise {
          0% {
            transform: translateY(24px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Splash;