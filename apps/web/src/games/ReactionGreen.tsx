import { useEffect, useRef, useState } from "react";
import { GameComponentProps } from "./types";

interface State {
  triggerAt: number;
  endsAt: number;
  reacted: Record<string, boolean>;
  earlyTap: Record<string, boolean>;
}

export default function ReactionGreen({ publicState, playerId, opponentId, onInput }: GameComponentProps) {
  const s = publicState as State;
  const [isGreen, setIsGreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Records the performance.now() timestamp exactly when the UI turns green
  const greenShownAtPerfRef = useRef<number | null>(null);

  const IReacted   = s.reacted[playerId]    ?? false;
  const IWasEarly  = s.earlyTap[playerId]   ?? false;
  const oppReacted = s.reacted[opponentId]  ?? false;
  const oppEarly   = s.earlyTap[opponentId] ?? false;

  useEffect(() => {
    const delay = s.triggerAt - Date.now();
    if (delay <= 0) {
      greenShownAtPerfRef.current = performance.now();
      setIsGreen(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      greenShownAtPerfRef.current = performance.now();
      setIsGreen(true);
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [s.triggerAt]);

  function handleTap(e: React.PointerEvent) {
    e.preventDefault();
    if (IReacted || IWasEarly) return;
    const tapAtPerf = performance.now();
    // Compute display-only reaction time from client-perceived green moment
    const displayReactionMs = greenShownAtPerfRef.current != null
      ? Math.round(tapAtPerf - greenShownAtPerfRef.current)
      : undefined;
    // Send clientNowMs — server applies clock offset to compute eventServerTime
    onInput({ clientNowMs: Date.now(), displayReactionMs });
  }

  let label: string;
  let bgClass: string;
  if (IWasEarly) {
    label = "❌ Too Early!";
    bgClass = "bg-(--danger) text-(--danger-foreground) cursor-not-allowed";
  } else if (IReacted) {
    label = "✓ Tapped!";
    bgClass = "bg-(--success) text-(--success-foreground) cursor-not-allowed";
  } else if (isGreen) {
    label = "TAP NOW!";
    bgClass = "bg-(--success) text-(--success-foreground)";
  } else {
    label = "Wait…";
    bgClass = "bg-(--danger) text-(--danger-foreground)";
  }

  let statusMsg = "";
  if (IWasEarly) statusMsg = "You tapped too early — you lose!";
  else if (isGreen && !IReacted) statusMsg = "GO! TAP IT!";
  else if (!isGreen) statusMsg = "Stay still… wait for green";

  let oppStatus = "";
  if (oppEarly)        oppStatus = "Opponent tapped early!";
  else if (oppReacted) oppStatus = "Opponent tapped!";

  return (
    <div className="flex flex-col items-center gap-4 py-6 w-full select-none">
      <p className="text-base font-semibold text-center min-h-[1.5rem]">{statusMsg}</p>

      <button
        className={`w-full rounded-2xl flex items-center justify-center text-5xl font-bold transition-all active:scale-95 ${bgClass}`}
        style={{ height: "260px", touchAction: "none" }}
        onPointerDown={handleTap}
      >
        {label}
      </button>

      {oppStatus && <p className="text-sm text-(--muted) text-center">{oppStatus}</p>}
    </div>
  );
}
