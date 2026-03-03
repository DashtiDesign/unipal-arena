import { useEffect, useState } from "react";
import { Lang, getT } from "./i18n";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import IosInstallHint from "./components/IosInstallHint";
import NavBar from "./components/NavBar";
import type { Room, ArenaState } from "@arena/shared";

export type Screen = "home" | "lobby";
export type Theme = "light" | "dark";

export interface Session {
  roomCode: string;
  playerId: string;
  room: Room;
  arena: ArenaState;
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const t = getT(lang);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function onThemeToggle() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  function onJoined(s: Session) {
    setSession(s);
    setScreen("lobby");
  }

  function onLeave() {
    setSession(null);
    setScreen("home");
  }

  function onSessionUpdate(room: Room, arena: ArenaState) {
    setSession((prev) => (prev ? { ...prev, room, arena } : prev));
  }

  // ── Compute NavBar left content based on current screen/phase ─────────────

  const arena = session?.arena;
  const isInGame = screen === "lobby" && arena?.phase === "DUELING";

  const navLeft = isInGame && arena?.gameMeta ? (
    <div className="flex flex-col">
      <span className="text-base font-bold leading-tight">
        {lang === "ar" ? arena.gameMeta.displayName.ar : arena.gameMeta.displayName.en}
      </span>
      {arena.duel && session && (() => {
        const players = session.room.players;
        const a = players.find((p) => p.id === arena.duel!.aId)?.name ?? "?";
        const b = players.find((p) => p.id === arena.duel!.bId)?.name ?? "?";
        return <span className="text-xs text-(--muted)">{t.duelAnnounce.replace("{a}", a).replace("{b}", b)}</span>;
      })()}
    </div>
  ) : null;

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-(--background)"
    >
      <NavBar
        theme={theme}
        onThemeToggle={onThemeToggle}
        lang={lang}
        onLangChange={setLang}
        left={navLeft}
      />

      {screen === "home" && (
        <Home t={t} onJoined={onJoined} />
      )}
      {screen === "lobby" && session && (
        <Lobby
          t={t}
          lang={lang}
          session={session}
          onSessionUpdate={onSessionUpdate}
          onLeave={onLeave}
        />
      )}
      <IosInstallHint t={t} />
    </div>
  );
}
