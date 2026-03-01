import { T } from "../../i18n";
import type { LeaderboardEntry } from "@arena/shared";

interface Props {
  t: T;
  onLangToggle: () => void;
  playerId: string;
  leaderboard: LeaderboardEntry[];
  onPlayAgain: () => void;
  onLeave: () => void;
}

export default function WinnerScreen({ t, onLangToggle, playerId, leaderboard, onPlayAgain, onLeave }: Props) {
  const champion = leaderboard[0];
  const isChampion = champion?.id === playerId;
  const myPosition = leaderboard.findIndex((e) => e.id === playerId) + 1; // 1-based

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

      <main className="flex flex-col items-center justify-center px-4 py-12 gap-6 max-w-sm mx-auto min-h-[70vh]">
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body items-center gap-4 py-10">
            <span className="text-6xl">{isChampion ? "🥇" : myPosition === 2 ? "🥈" : myPosition === 3 ? "🥉" : "🏁"}</span>
            {isChampion ? (
              <p className="text-2xl font-bold text-center">You are the Champion! 🏆</p>
            ) : (
              <>
                <p className="text-2xl font-bold text-center">You placed #{myPosition}</p>
                <p className="text-sm text-base-content/60">Winner: {champion?.name ?? "?"}</p>
              </>
            )}
          </div>
        </div>

        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-2 py-4">
            <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">
              {t.finalLeaderboard}
            </h3>
            <ul className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <li key={entry.id} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-base-content/40 w-4">{i + 1}.</span>
                    <span className={entry.id === playerId ? "font-bold" : ""}>{entry.name}</span>
                  </span>
                  <span className="tabular-nums font-mono">{entry.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button className="btn btn-primary btn-block" onClick={onPlayAgain}>
          {t.playAgain}
        </button>
      </main>
    </>
  );
}
