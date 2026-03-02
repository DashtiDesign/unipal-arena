import { GameComponentProps } from "./types";

interface State { taps: Record<string, number>; done: boolean }

export default function TappingSpeed({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myTaps  = s.taps[playerId]    ?? 0;
  const oppTaps = s.taps[opponentId]  ?? 0;

  return (
    <div className="flex flex-col items-center gap-4 py-6 w-full select-none">
      {/* Live tap count — own taps only during the round */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-base-content/60 uppercase">Your taps</span>
        <span className="text-5xl font-bold tabular-nums text-primary">{myTaps}</span>
      </div>

      <p className="badge badge-neutral tabular-nums text-sm">{Math.ceil(remainingMs / 1000)}s left</p>

      {/* Big tap target — full width so fat fingers hit it */}
      <button
        className="w-full rounded-2xl bg-primary text-primary-content flex items-center justify-center text-5xl font-bold active:scale-95 transition-transform"
        style={{ height: "220px", touchAction: "none" }}
        disabled={s.done}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!s.done) onInput({});
        }}
      >
        {s.done ? "⏱" : "TAP!"}
      </button>
    </div>
  );
}
