import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Button, Card, Chip } from "@heroui/react";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  room: Room;
  arena: ArenaState;
  playerId: string;
  isReady: boolean;
  onToggleReady: () => void;
  onLeave: () => void;
}

export default function PreRound({
  t, lang, onLangToggle, room, arena, playerId, isReady, onToggleReady, onLeave,
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

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm">
        <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onLangToggle}>{t.lang}</Button>
          <Button variant="ghost" size="sm" className="text-(--danger)" onPress={onLeave}>✕</Button>
        </div>
      </div>

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
    </>
  );
}
