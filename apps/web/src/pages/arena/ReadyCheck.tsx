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
  const opponentId = arena.duel
    ? (playerId === arena.duel.aId ? arena.duel.bId : arena.duel.aId)
    : "";

  const duelLabel = t.duelAnnounce
    .replace("{a}", playerA?.name ?? "?")
    .replace("{b}", playerB?.name ?? "?");

  return (
    <>
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex-none gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onLangToggle}>{t.lang}</button>
          <button className="btn btn-ghost btn-sm text-error" onClick={onLeave}>✕</button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-8 gap-6 max-w-sm mx-auto">
        {/* Benched */}
        {isBenched && (
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body items-center gap-4 py-10">
              <span className="text-5xl">🪑</span>
              <p className="text-center font-semibold text-lg">{t.benchedThisDuel}</p>
              <p className="text-center text-base-content/60 text-sm">{duelLabel}</p>
            </div>
          </div>
        )}

        {/* READY_CHECK – duel participant waiting */}
        {!isBenched && !isDueling && (
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body items-center gap-4 py-8">
              <p className="text-sm text-base-content/60 uppercase tracking-widest">🥊</p>
              <p className="text-2xl font-bold text-center">{duelLabel}</p>
              {!isReady ? (
                <>
                  <p className="text-sm text-base-content/60 text-center">{t.tapToReady}</p>
                  <button className="btn btn-primary btn-block mt-2" onClick={onToggleReady}>
                    {t.ready}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="badge badge-success badge-lg">✓ {t.ready}</span>
                  <p className="text-sm text-base-content/60">{t.waitingForOpponent}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DUELING – game frame */}
        {!isBenched && isDueling && amDueler && arena.duel && (
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body">
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
            </div>
          </div>
        )}

        {/* Leaderboard snapshot */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-2 py-4">
            <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">{t.players}</h3>
            <ul className="flex flex-col gap-1">
              {[...room.players].sort((a, b) => b.score - a.score).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className={p.id === playerId ? "font-bold" : ""}>{p.name}</span>
                  <span className="tabular-nums">{p.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
