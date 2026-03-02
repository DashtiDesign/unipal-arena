import { useEffect, useState } from "react";
import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Button, Card, Chip } from "@heroui/react";

interface Props {
  t: T;
  lang: Lang;
  room: Room;
  arena: ArenaState;
  playerId: string;
  isReady: boolean;
  onToggleReady: () => void;
  onLeave: () => void;
}

const COUNTDOWN_MS = 3000;

export default function PreRound({
  t, lang, room, arena, playerId, isReady, onToggleReady, onLeave,
}: Props) {
  const meta = arena.gameMeta;
  const duel = arena.duel;
  const isBenched = arena.benchedId === playerId;
  const amDueler = duel ? (playerId === duel.aId || playerId === duel.bId) : false;

  const playerA = duel ? room.players.find((p) => p.id === duel.aId) : null;
  const playerB = duel ? room.players.find((p) => p.id === duel.bId) : null;
  const duelLabel = t.duelAnnounce
    .replace("{a}", playerA?.name ?? "?")
    .replace("{b}", playerB?.name ?? "?");

  const instrText = meta ? (lang === "ar" ? meta.instructions.ar : meta.instructions.en) : "";
  const gameName  = meta ? (lang === "ar" ? meta.displayName.ar : meta.displayName.en) : "";

  // 3-2-1 countdown — derived locally from countdownStartAt
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!arena.countdownStartAt) {
      setCountdown(null);
      return;
    }
    function tick() {
      const elapsed = Date.now() - arena.countdownStartAt!;
      const remaining = Math.ceil((COUNTDOWN_MS - elapsed) / 1000);
      if (remaining <= 0) {
        setCountdown(null);
      } else {
        setCountdown(remaining);
      }
    }
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [arena.countdownStartAt]);

  // Show full-screen countdown overlay once both are ready
  if (countdown !== null) {
    return (
      <main className="flex flex-col items-center justify-center px-4 gap-4 min-h-[60vh]">
        <p className="text-xs text-(--muted) uppercase tracking-widest">{gameName}</p>
        <p className="text-9xl font-bold tabular-nums text-(--accent)">{countdown}</p>
        <p className="text-sm text-(--muted)">{duelLabel}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 py-6 gap-4 max-w-sm mx-auto">
        <Card className="w-full">
          <Card.Content className="flex flex-col items-center gap-2 py-5 px-4">
            <p className="text-xs text-(--muted) uppercase tracking-widest">🥊 Next Duel</p>
            <p className="text-2xl font-bold text-center">{duelLabel}</p>
            {isBenched && <Chip size="sm" color="default" variant="secondary">{t.benchedThisDuel}</Chip>}
          </Card.Content>
        </Card>

        {meta && (
          <Card className="w-full bg-(--accent) text-(--accent-foreground)">
            <Card.Content className="flex flex-col gap-3 py-6 px-4">
              <p className="text-xs uppercase tracking-widest opacity-70">Game</p>
              <p className="text-3xl font-bold">{gameName}</p>
              <hr className="opacity-30" />
              <p className="text-sm leading-relaxed opacity-90">{instrText}</p>
              <p className="text-xs opacity-60">⏱ {meta.durationMs / 1000}s</p>
            </Card.Content>
          </Card>
        )}

        {amDueler && !isBenched && (
          !isReady ? (
            <Button variant="primary" fullWidth size="lg" onPress={onToggleReady}>
              {t.ready}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <Chip size="lg" color="success" variant="soft">✓ {t.ready}</Chip>
              <p className="text-sm text-(--muted)">{t.waitingForOpponent}</p>
            </div>
          )
        )}

        <Card className="w-full">
          <Card.Content className="flex flex-col gap-2 py-4 px-4">
            <h3 className="font-semibold text-(--muted) uppercase text-xs tracking-widest">{t.players}</h3>
            <ul className="flex flex-col gap-1">
              {[...room.players].sort((a, b) => b.score - a.score).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className={p.id === playerId ? "font-bold" : ""}>{p.name}</span>
                  <span className="tabular-nums">{p.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
    </main>
  );
}
