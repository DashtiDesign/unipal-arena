import { GameComponentProps } from "./types";

interface State { taps: Record<string, number>; done: boolean }

export default function TappingSpeed({ publicState, playerId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myTaps  = s.taps[playerId]    ?? 0;

  return (
    <div className="flex flex-col items-center gap-4 py-6 w-full select-none">
      <div className="flex flex-col items-center">
        <span className="text-xs text-(--muted) uppercase">Your taps</span>
        <span className="text-5xl font-bold tabular-nums text-(--accent)">{myTaps}</span>
      </div>

      <p className="text-sm text-(--muted) tabular-nums">{Math.ceil(remainingMs / 1000)}s left</p>

      <button
        className="w-full rounded-2xl bg-(--accent) text-(--accent-foreground) flex items-center justify-center text-5xl font-bold active:scale-95 transition-transform"
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
