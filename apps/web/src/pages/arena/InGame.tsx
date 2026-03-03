import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Card } from "@heroui/react";
import GameFrame from "../../components/GameFrame";

interface Props {
  t: T;
  lang: Lang;
  room: Room;
  arena: ArenaState;
  playerId: string;
  roomCode: string;
  onLeave: () => void;
}

export default function InGame({
  t, lang, room, arena, playerId, roomCode,
}: Props) {
  const isBenched = arena.benchedId === playerId;
  // `arena.duel` is personalized — it's the duel this player is in (null if benched)
  const myDuel = arena.duel ?? arena.duels.find((d) => d.aId === playerId || d.bId === playerId) ?? null;
  const opponentId = myDuel ? (myDuel.aId === playerId ? myDuel.bId : myDuel.aId) : "";

  function pName(id: string) { return room.players.find((p) => p.id === id)?.name ?? "?"; }

  return (
    <main className="flex flex-col items-center px-4 py-4 max-w-sm mx-auto w-full gap-4">
      {isBenched ? (
        <Card className="w-full mt-4">
          <Card.Content className="flex flex-col items-center gap-4 py-8 px-4">
            <span className="text-5xl">🪑</span>
            <p className="text-center font-semibold text-lg">{t.benchedThisDuel}</p>
            {arena.duels.length > 0 && (
              <div className="w-full flex flex-col gap-2 mt-2">
                <p className="text-xs text-(--muted) uppercase tracking-widest text-center">Active matches</p>
                <ul className="flex flex-col gap-1">
                  {arena.duels.map((d) => (
                    <li key={d.matchId} className="text-sm flex items-center justify-center gap-2">
                      <span className="font-semibold">{pName(d.aId)}</span>
                      <span className="text-(--muted)">vs</span>
                      <span className="font-semibold">{pName(d.bId)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card.Content>
        </Card>
      ) : myDuel ? (
        <Card className="w-full">
          <Card.Content className="p-3">
            <GameFrame
              roomCode={roomCode}
              matchId={myDuel.matchId}
              gameId={arena.gameId}
              gameDefId={myDuel.gameDefId}
              playerId={playerId}
              opponentId={opponentId}
              lang={lang}
              durationMs={arena.gameMeta?.durationMs ?? 10000}
            />
          </Card.Content>
        </Card>
      ) : null}
    </main>
  );
}
