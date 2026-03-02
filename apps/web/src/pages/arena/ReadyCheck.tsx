import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Button, Card, Chip } from "@heroui/react";
import GameFrame from "../../components/GameFrame";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  room: Room;
  arena: ArenaState;
  playerId: string;
  roomCode: string;
  isBenched: boolean;
  isReady: boolean;
  onToggleReady: () => void;
  onLeave: () => void;
}

export default function ReadyCheck({
  t, lang, onLangToggle, room, arena, playerId, roomCode, isBenched, isReady, onToggleReady, onLeave,
}: Props) {
  const playerA = arena.duel ? room.players.find((p) => p.id === arena.duel!.aId) : null;
  const playerB = arena.duel ? room.players.find((p) => p.id === arena.duel!.bId) : null;

  const isDueling = arena.phase === "DUELING";
  const amDueler  = arena.duel ? (playerId === arena.duel.aId || playerId === arena.duel.bId) : false;
  const opponentId = arena.duel ? (playerId === arena.duel.aId ? arena.duel.bId : arena.duel.aId) : "";

  const duelLabel = t.duelAnnounce
    .replace("{a}", playerA?.name ?? "?")
    .replace("{b}", playerB?.name ?? "?");

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm">
        <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onLangToggle}>{t.lang}</Button>
          <Button variant="ghost" size="sm" className="text-(--danger)" onPress={onLeave}>✕</Button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-8 gap-6 max-w-sm mx-auto">
        {isBenched && (
          <Card className="w-full">
            <Card.Content className="flex flex-col items-center gap-4 py-10 px-4">
              <span className="text-5xl">🪑</span>
              <p className="text-center font-semibold text-lg">{t.benchedThisDuel}</p>
              <p className="text-center text-(--muted) text-sm">{duelLabel}</p>
            </Card.Content>
          </Card>
        )}

        {!isBenched && !isDueling && (
          <Card className="w-full">
            <Card.Content className="flex flex-col items-center gap-4 py-8 px-4">
              <p className="text-sm text-(--muted) uppercase tracking-widest">🥊</p>
              <p className="text-2xl font-bold text-center">{duelLabel}</p>
              {!isReady ? (
                <>
                  <p className="text-sm text-(--muted) text-center">{t.tapToReady}</p>
                  <Button variant="primary" fullWidth onPress={onToggleReady}>{t.ready}</Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Chip size="lg" color="success" variant="soft">✓ {t.ready}</Chip>
                  <p className="text-sm text-(--muted)">{t.waitingForOpponent}</p>
                </div>
              )}
            </Card.Content>
          </Card>
        )}

        {!isBenched && isDueling && amDueler && arena.duel && (
          <Card className="w-full">
            <Card.Content className="p-4">
              <GameFrame
                roomCode={roomCode}
                matchId={arena.duel.matchId}
                gameId={arena.gameId}
                gameDefId={arena.duel.gameDefId}
                playerId={playerId}
                opponentId={opponentId}
                lang={lang}
                durationMs={arena.gameMeta?.durationMs ?? 10000}
              />
            </Card.Content>
          </Card>
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
