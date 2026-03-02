import { T } from "../../i18n";
import type { LeaderboardEntry } from "@arena/shared";
import { Button, Card } from "@heroui/react";

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
  const myPosition = leaderboard.findIndex((e) => e.id === playerId) + 1;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm">
        <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onLangToggle}>{t.lang}</Button>
          <Button variant="ghost" size="sm" className="text-(--danger)" onPress={onLeave}>✕</Button>
        </div>
      </div>

      <main className="flex flex-col items-center justify-center px-4 py-12 gap-6 max-w-sm mx-auto min-h-[70vh]">
        <Card className="w-full">
          <Card.Content className="flex flex-col items-center gap-4 py-10 px-4">
            <span className="text-6xl">{isChampion ? "🥇" : myPosition === 2 ? "🥈" : myPosition === 3 ? "🥉" : "🏁"}</span>
            {isChampion ? (
              <p className="text-2xl font-bold text-center">You are the Champion! 🏆</p>
            ) : (
              <>
                <p className="text-2xl font-bold text-center">You placed #{myPosition}</p>
                <p className="text-sm text-(--muted)">Winner: {champion?.name ?? "?"}</p>
              </>
            )}
          </Card.Content>
        </Card>

        <Card className="w-full">
          <Card.Content className="flex flex-col gap-2 py-4 px-4">
            <h3 className="font-semibold text-(--muted) uppercase text-xs tracking-widest">{t.finalLeaderboard}</h3>
            <ul className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <li key={entry.id} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-(--muted) w-4">{i + 1}.</span>
                    <span className={entry.id === playerId ? "font-bold" : ""}>{entry.name}</span>
                  </span>
                  <span className="tabular-nums font-mono">{entry.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>

        <Button variant="primary" fullWidth onPress={onPlayAgain}>{t.playAgain}</Button>
      </main>
    </>
  );
}
