import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Button, Card } from "@heroui/react";
import GameFrame from "../../components/GameFrame";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  room: Room;
  arena: ArenaState;
  playerId: string;
  roomCode: string;
  onLeave: () => void;
}

export default function InGame({
  t, lang, onLangToggle, room, arena, playerId, roomCode, onLeave,
}: Props) {
  const duel = arena.duel;
  const isBenched = arena.benchedId === playerId;
  const amDueler = duel ? (playerId === duel.aId || playerId === duel.bId) : false;
  const opponentId = duel ? (playerId === duel.aId ? duel.bId : duel.aId) : "";

  const playerA = duel ? room.players.find((p) => p.id === duel.aId) : null;
  const playerB = duel ? room.players.find((p) => p.id === duel.bId) : null;
  const duelLabel = t.duelAnnounce
    .replace("{a}", playerA?.name ?? "?")
    .replace("{b}", playerB?.name ?? "?");

  const gameName = arena.gameMeta
    ? (lang === "ar" ? arena.gameMeta.displayName.ar : arena.gameMeta.displayName.en)
    : "";

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm">
        <div className="flex flex-col">
          <span className="text-base font-bold leading-tight">{gameName || t.appName}</span>
          <span className="text-xs text-(--muted)">{duelLabel}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onLangToggle}>{t.lang}</Button>
          <Button variant="ghost" size="sm" className="text-(--danger)" onPress={onLeave}>✕</Button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-4 max-w-sm mx-auto w-full">
        {isBenched ? (
          <Card className="w-full mt-4">
            <Card.Content className="flex flex-col items-center gap-4 py-10 px-4">
              <span className="text-5xl">🪑</span>
              <p className="text-center font-semibold text-lg">{t.benchedThisDuel}</p>
              <p className="text-center text-(--muted) text-sm">{duelLabel}</p>
            </Card.Content>
          </Card>
        ) : amDueler && duel ? (
          <Card className="w-full">
            <Card.Content className="p-3">
              <GameFrame
                roomCode={roomCode}
                matchId={duel.matchId}
                gameId={arena.gameId}
                gameDefId={duel.gameDefId}
                playerId={playerId}
                opponentId={opponentId}
                lang={lang}
                durationMs={arena.gameMeta?.durationMs ?? 10000}
              />
            </Card.Content>
          </Card>
        ) : null}
      </main>
    </>
  );
}
