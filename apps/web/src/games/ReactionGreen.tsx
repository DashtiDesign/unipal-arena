import { useEffect, useRef, useState } from "react";
import { GameComponentProps } from "./types";
import { Chip } from "@heroui/react";

interface State {
  triggerAt: number;
  endsAt: number;
  reacted: Record<string, boolean>;
  earlyTap: Record<string, boolean>;
}

export default function ReactionGreen({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
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
    // Send clientNowMs — server applies clock offset to compute eventServerTime
    onInput({ clientNowMs: Date.now() });
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
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-base font-semibold text-center min-h-[1.5rem]">{statusMsg}</p>
        <Chip size="sm" color="default" variant="secondary">{Math.ceil(remainingMs / 1000)}s</Chip>
      </div>

      <button
        className={`w-full rounded-2xl flex items-center justify-center text-5xl font-bold transition-all active:scale-95 ${bgClass}`}
        style={{ height: "260px", touchAction: "none" }}
        onPointerDown={handleTap}
      >
        {label}
      </button>

      {oppStatus && <p className="text-xs text-(--muted) text-center">{oppStatus}</p>}
    </div>
  );
}
