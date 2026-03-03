import { useRef, useState } from "react";
import { GameComponentProps } from "./types";
import { Button, Chip, Input, Spinner } from "@heroui/react";

type Hint = "higher" | "lower" | "correct";

interface HintEvent {
  round: number;
  hint: Hint;
  guess: number;
}

interface PublicState {
  round: number;
  submitted: Record<string, boolean>;
  winner: string | null;
  isDraw: boolean;
  finished: boolean;
}

const HINT_ICON: Record<Hint, string> = { higher: "⬆️", lower: "⬇️", correct: "✅" };
const HINT_LABEL: Record<Hint, string> = { higher: "Higher", lower: "Lower", correct: "Correct!" };
const HINT_CLASS: Record<Hint, string> = {
  higher: "text-(--warning)",
  lower: "text-(--accent)",
  correct: "text-(--success) font-bold",
};

interface FloatAnim { key: number; hint: Hint }
let _floatKey = 0;

export default function HigherLower({
  publicState, playerId, opponentId, onInput, remainingMs, privateState,
}: GameComponentProps) {
  const s = publicState as PublicState;
  const hints = (privateState ?? []) as HintEvent[];
  const [input, setInput] = useState("");

  // Floating hint animation driven by new server hints
  const prevHintCountRef = useRef(0);
  const [floats, setFloats] = useState<FloatAnim[]>([]);
  const floatTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  if (hints.length > prevHintCountRef.current) {
    const newHint = hints[hints.length - 1];
    prevHintCountRef.current = hints.length;
    const key = _floatKey++;
    Promise.resolve().then(() => {
      setFloats((prev) => [...prev, { key, hint: newHint.hint }]);
      const t = setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.key !== key));
        floatTimers.current.delete(key);
      }, 1500);
      floatTimers.current.set(key, t);
    });
  }

  const iSubmitted = s.submitted[playerId] ?? false;
  const oppSubmitted = s.submitted[opponentId] ?? false;
  const lastHint = hints.length > 0 ? hints[hints.length - 1] : null;

  if (s.finished) {
    const iWon = s.winner === playerId;
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-5xl">{s.isDraw ? "🤝" : iWon ? "🎉" : "😢"}</p>
        <p className="text-2xl font-bold">{s.isDraw ? "It's a draw!" : iWon ? "You guessed it!" : "Opponent got it first!"}</p>
      </div>
    );
  }

  function submit() {
    const n = Number(input);
    if (!input || isNaN(n) || n < 1 || n > 100) return;
    onInput({ guess: n });
    setInput("");
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full relative">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-base font-semibold">Round {s.round} — Guess 1–100</p>
        <Chip size="sm" color="default" variant="secondary">{Math.ceil(remainingMs / 1000)}s</Chip>
      </div>

      {/* Floating hint text anchored near top-center of component */}
      {floats.map((f) => (
        <div
          key={f.key}
          className={`absolute left-1/2 top-12 pointer-events-none font-bold text-3xl leading-none z-10 ${HINT_CLASS[f.hint]}`}
          style={{ animation: "hl-float 1.5s ease-out forwards" }}
        >
          {HINT_ICON[f.hint]} {HINT_LABEL[f.hint]}
        </div>
      ))}

      {hints.length > 0 && (
        <div className="w-full flex flex-col gap-1 max-h-64 overflow-y-auto">
          {hints.map((h, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${HINT_CLASS[h.hint]}`}>
              <span className="text-(--muted) tabular-nums w-16 shrink-0">R{h.round}</span>
              <span className="tabular-nums font-mono w-8 shrink-0">{h.guess}</span>
              <span>{HINT_ICON[h.hint]}</span>
              <span>{HINT_LABEL[h.hint]}</span>
            </div>
          ))}
        </div>
      )}

      {!iSubmitted ? (
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            type="tel"
            inputMode="numeric"
            fullWidth
            className="text-center text-2xl font-mono"
            value={input}
            autoFocus
            maxLength={3}
            placeholder="?"
            onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button
            variant="primary"
            isDisabled={!input}
            onPress={submit}
            className="h-14 px-6 text-base font-semibold"
          >
            ✓
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          {lastHint && (
            <p className={`text-lg font-semibold ${HINT_CLASS[lastHint.hint]}`}>
              {HINT_ICON[lastHint.hint]} {HINT_LABEL[lastHint.hint]}
            </p>
          )}
          {!oppSubmitted ? (
            <>
              <Spinner size="md" />
              <p className="text-xs text-(--muted)">Waiting for opponent…</p>
            </>
          ) : (
            <Chip size="sm" color="accent" variant="soft">Both submitted — next round…</Chip>
          )}
        </div>
      )}

      <div className="flex justify-between w-full px-2 text-xs text-(--muted)">
        <span>Your guesses: {hints.length}</span>
        <span>Opponent: {oppSubmitted ? "✓ submitted" : "thinking…"}</span>
      </div>

      <style>{`
        @keyframes hl-float {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1.1); }
          40%  { opacity: 1; transform: translateX(-50%) translateY(-20px) scale(1);   }
          100% { opacity: 0; transform: translateX(-50%) translateY(-50px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
