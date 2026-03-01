import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
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
  const opponentId = duel
    ? (playerId === duel.aId ? duel.bId : duel.aId)
    : "";

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
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1 flex flex-col">
          <span className="text-base font-bold leading-tight">{gameName || t.appName}</span>
          <span className="text-xs text-base-content/50">{duelLabel}</span>
        </div>
        <div className="flex-none gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onLangToggle}>{t.lang}</button>
          <button className="btn btn-ghost btn-sm text-error" onClick={onLeave}>✕</button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-4 max-w-sm mx-auto w-full">
        {isBenched ? (
          <div className="card w-full bg-base-100 shadow-xl mt-4">
            <div className="card-body items-center gap-4 py-10">
              <span className="text-5xl">🪑</span>
              <p className="text-center font-semibold text-lg">{t.benchedThisDuel}</p>
              <p className="text-center text-base-content/60 text-sm">{duelLabel}</p>
            </div>
          </div>
        ) : amDueler && duel ? (
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body p-3">
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
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
