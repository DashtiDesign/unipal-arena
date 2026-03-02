import { useEffect, useRef, useState } from "react";
import { GameComponentProps } from "./types";

interface State {
  triggerAt: number;                 // absolute epoch ms
  reacted: Record<string, boolean>;  // has tapped (early or valid)
  earlyTap: Record<string, boolean>; // tapped before green
}

export default function ReactionGreen({ publicState, playerId, opponentId, onInput }: GameComponentProps) {
  const s = publicState as State;
  const [isGreen, setIsGreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const IReacted   = s.reacted[playerId]    ?? false;
  const IWasEarly  = s.earlyTap[playerId]   ?? false;
  const oppReacted = s.reacted[opponentId]  ?? false;
  const oppEarly   = s.earlyTap[opponentId] ?? false;

  useEffect(() => {
    const delay = s.triggerAt - Date.now();
    if (delay <= 0) { setIsGreen(true); return; }
    timerRef.current = setTimeout(() => setIsGreen(true), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [s.triggerAt]);

  function handleTap(e: React.PointerEvent) {
    e.preventDefault();
    if (IReacted || IWasEarly) return;
    onInput({});
  }

  let label: string;
  let colorClass: string;
  if (IWasEarly) {
    label = "❌ Too Early!";
    colorClass = "bg-error text-error-content cursor-not-allowed";
  } else if (IReacted) {
    label = "✓ Tapped!";
    colorClass = "bg-success text-success-content cursor-not-allowed";
  } else if (isGreen) {
    label = "TAP NOW!";
    colorClass = "bg-success text-success-content";
  } else {
    label = "Wait…";
    colorClass = "bg-error text-error-content";
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
        className={`w-full rounded-2xl flex items-center justify-center text-5xl font-bold transition-all active:scale-95 ${colorClass}`}
        style={{ height: "260px", touchAction: "none" }}
        onPointerDown={handleTap}
      >
        {label}
      </button>

      {oppStatus && (
        <p className="text-xs text-base-content/50 text-center">{oppStatus}</p>
      )}
    </div>
  );
}
