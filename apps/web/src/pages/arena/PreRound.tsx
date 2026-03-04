import { useEffect, useState } from "react";
import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";
import { Button, Card, Chip } from "@heroui/react";
import type { Theme } from "../../App";
import SettingsDropdown from "../../components/SettingsDropdown";

interface Props {
  t: T;
  lang: Lang;
  theme: Theme;
  room: Room;
  arena: ArenaState;
  playerId: string;
  isReady: boolean;
  onToggleReady: () => void;
  onLeave: () => void;
  onThemeToggle: () => void;
  onLangChange: (l: Lang) => void;
}

const COUNTDOWN_MS = 3000;

export default function PreRound({
  t, lang, theme, room, arena, playerId, isReady, onToggleReady, onThemeToggle, onLangChange,
}: Props) {
  const meta = arena.gameMeta;
  const isBenched = arena.benchedId === playerId;
  const myDuel = arena.duels.find((d) => d.aId === playerId || d.bId === playerId) ?? null;
  const amDueler = myDuel !== null;
  const otherDuels = arena.duels.filter((d) => d.aId !== playerId && d.bId !== playerId);

  const instrText = meta ? (lang === "ar" ? meta.instructions.ar : meta.instructions.en) : "";
  const gameName  = meta ? (lang === "ar" ? meta.displayName.ar : meta.displayName.en) : "";

  const opponentId = myDuel ? (myDuel.aId === playerId ? myDuel.bId : myDuel.aId) : null;
  const opponentName = opponentId ? (room.players.find((p) => p.id === opponentId)?.name ?? "?") : null;
  const benchedPlayer = arena.benchedId ? room.players.find((p) => p.id === arena.benchedId) : null;

  // countdownActive: true once countdown starts; stays true until parent switches phase to DUELING.
  // This prevents flashing back to the pre-game card while waiting for the DUELING phase update.
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!arena.countdownStartAt) {
      setCountdownActive(false);
      setCountdown(3);
      return;
    }
    setCountdownActive(true);
    function tick() {
      const remaining = Math.ceil((COUNTDOWN_MS - (Date.now() - arena.countdownStartAt!)) / 1000);
      setCountdown(Math.max(1, remaining)); // clamp to 1 so we show "1" not "0" during transition
    }
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [arena.countdownStartAt]);

  function pName(id: string) { return room.players.find((p) => p.id === id)?.name ?? "?"; }

  if (countdownActive) {
    return (
      <main className="flex flex-col items-center justify-center px-4 gap-4 min-h-[60vh]">
        <p className="text-xs text-(--muted) uppercase tracking-widest">{gameName}</p>
        <p className="text-9xl font-bold tabular-nums text-(--accent)">{countdown}</p>
        {amDueler && opponentName && <p className="text-sm text-(--muted)">vs {opponentName}</p>}
        {isBenched && <p className="text-sm text-(--muted)">{t.benchedThisDuel}</p>}
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 py-6 gap-4 max-w-sm mx-auto">

      {/* Settings button — visible on ready screen, hidden during countdown */}
      <div className="flex justify-end w-full">
        <SettingsDropdown t={t} lang={lang} theme={theme} onThemeToggle={onThemeToggle} onLangChange={onLangChange} />
      </div>

      {/* My status card */}
      <Card className="w-full">
        <Card.Content className="flex flex-col items-center gap-2 py-5 px-4">
          {isBenched ? (
            <>
              <span className="text-3xl">🪑</span>
              <p className="text-lg font-bold text-center">{t.benchedThisDuel}</p>
              <p className="text-sm text-(--muted) text-center">Sit back and watch this round</p>
            </>
          ) : amDueler && opponentName ? (
            <>
              <p className="text-xs text-(--muted) uppercase tracking-widest">You are playing</p>
              <p className="text-2xl font-bold text-center">vs {opponentName}</p>
            </>
          ) : (
            <p className="text-base text-(--muted)">Waiting for round to start…</p>
          )}
        </Card.Content>
      </Card>

      {/* Game info */}
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

      {/* Ready button — only for duelers */}
      {amDueler && (
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

      {/* Other matches this round */}
      {(otherDuels.length > 0 || benchedPlayer) && (
        <Card className="w-full">
          <Card.Content className="flex flex-col gap-2 py-4 px-4">
            <h3 className="font-semibold text-(--muted) uppercase text-xs tracking-widest">Other matches</h3>
            <ul className="flex flex-col gap-1">
              {otherDuels.map((d) => (
                <li key={d.matchId} className="text-sm flex items-center gap-2">
                  <span className="font-semibold">{pName(d.aId)}</span>
                  <span className="text-(--muted)">vs</span>
                  <span className="font-semibold">{pName(d.bId)}</span>
                </li>
              ))}
              {benchedPlayer && (
                <li className="text-sm text-(--muted)">🪑 Benched: {benchedPlayer.name}</li>
              )}
            </ul>
          </Card.Content>
        </Card>
      )}

      {/* Players + connection status */}
      <Card className="w-full">
        <Card.Content className="flex flex-col gap-2 py-4 px-4">
          <h3 className="font-semibold text-(--muted) uppercase text-xs tracking-widest">{t.players}</h3>
          <ul className="flex flex-col gap-1">
            {[...room.players].sort((a, b) => b.score - a.score).map((p) => {
              const isDisconnected = p.connectionStatus === "disconnected";
              return (
                <li key={p.id} className={`flex items-center justify-between gap-2 text-sm ${isDisconnected ? "opacity-60" : ""}`}>
                  <span className={p.id === playerId ? "font-bold truncate" : "truncate"}>{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDisconnected && (
                      <Chip size="sm" variant="primary" color="danger">{t.disconnected}</Chip>
                    )}
                    <span className="tabular-nums text-(--muted)">{p.score} {t.pts}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {room.disconnectedPlayers && room.disconnectedPlayers.length > 0 && (
            <>
              <p className="text-xs text-(--muted) uppercase tracking-widest mt-1">{t.leftPlayers}</p>
              <ul className="flex flex-col gap-1">
                {room.disconnectedPlayers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm opacity-40">
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-(--muted)">{p.score} {t.pts}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card.Content>
      </Card>
    </main>
  );
}
