import React from "react";


interface DiamondCounterProps {
  diamonds:
    number;

  compact?:
    boolean;

  label?:
    string;

  className?:
    string;
}


export const DiamondCounter:
React.FC<
  DiamondCounterProps
> = ({
  diamonds,
  compact = false,
  label = "Today",
  className = "",
}) => {

  const safeDiamonds =
    Math.max(
      0,
      Math.floor(
        diamonds,
      ),
    );


  if (
    compact
  ) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-2 ${className}`}
      >
        <span
          className="text-base leading-none"
          aria-hidden="true"
        >
          💎
        </span>

        <span className="text-xs font-black text-cyan-500">
          {
            safeDiamonds
          }
        </span>
      </div>
    );
  }


  return (
    <div
      className={`rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-indigo-500/10 p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3">

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">
            {
              label
            } Diamonds
          </p>

          <p className="mt-1 text-3xl font-black app-text">
            {
              safeDiamonds
            }
          </p>

          <p className="mt-1 text-[11px] app-text-muted">
            Daily leaderboard score
          </p>
        </div>


        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl shadow-inner">
          💎
        </div>

      </div>
    </div>
  );
};