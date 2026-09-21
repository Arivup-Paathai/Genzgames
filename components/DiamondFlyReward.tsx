import React, {
  useEffect,
} from "react";


interface DiamondFlyRewardProps {
  amount:
    number;

  onDone:
    () => void;
}


export const DiamondFlyReward:
React.FC<
  DiamondFlyRewardProps
> = ({
  amount,
  onDone,
}) => {

  useEffect(
    () => {

      const timer =
        window.setTimeout(
          () => {
            onDone();
          },
          1550,
        );


      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      onDone,
    ],
  );


  if (
    amount <=
    0
  ) {
    return null;
  }


  return (
    <div className="pointer-events-none fixed inset-0 z-[240] overflow-hidden">

      <style>
        {`
          @keyframes genzDiamondRewardPop {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.55);
            }

            18% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.12);
            }

            72% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }

            100% {
              opacity: 0;
              transform: translate(-50%, -70%) scale(0.8);
            }
          }


          @keyframes genzDiamondFly {
            0% {
              opacity: 0;
              transform:
                translate(-50%, -50%)
                scale(0.55)
                rotate(0deg);
            }

            15% {
              opacity: 1;
            }

            45% {
              transform:
                translate(
                  calc(-50% + var(--diamond-x-mid)),
                  calc(-50% + var(--diamond-y-mid))
                )
                scale(1)
                rotate(120deg);
            }

            100% {
              opacity: 0;
              transform:
                translate(
                  calc(-50% + 42vw),
                  calc(-50% - 44vh)
                )
                scale(0.25)
                rotate(300deg);
            }
          }
        `}
      </style>


      <div
        className="absolute left-1/2 top-1/2 rounded-2xl border border-cyan-300/30 bg-slate-950/90 px-5 py-3 text-center text-white shadow-2xl backdrop-blur-md animate-[genzDiamondRewardPop_1.45s_ease-out_forwards]"
      >
        <p className="text-2xl">
          💎
        </p>

        <p className="mt-1 text-xl font-black text-cyan-300">
          +
          {
            amount
          }
        </p>

        <p className="text-[9px] font-black uppercase tracking-widest text-white/60">
          Daily Diamonds
        </p>
      </div>


      {Array.from({
        length:
          12,
      }).map(
        (
          _,
          index,
        ) => {

          const xMid =
            (
              index %
              5
            ) *
              20 -
            40;

          const yMid =
            -40 -
            Math.floor(
              index /
              5,
            ) *
              24;


          return (
            <span
              key={
                index
              }
              className="absolute left-1/2 top-1/2 text-2xl animate-[genzDiamondFly_1.35s_ease-in_forwards]"
              style={
                {
                  animationDelay:
                    `${index * 45}ms`,

                  "--diamond-x-mid":
                    `${xMid}px`,

                  "--diamond-y-mid":
                    `${yMid}px`,
                } as
                  React.CSSProperties
              }
            >
              💎
            </span>
          );
        },
      )}

    </div>
  );
};