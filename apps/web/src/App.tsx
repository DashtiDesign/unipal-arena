import { useEffect, useState } from "react";
import { Lang, getT } from "./i18n";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import IosInstallHint from "./components/IosInstallHint";
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

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-(--background)"
    >
      {screen === "home" && (
        <Home
          t={t}
          lang={lang}
          theme={theme}
          onJoined={onJoined}
          onThemeToggle={onThemeToggle}
          onLangChange={setLang}
        />
      )}
      {screen === "lobby" && session && (
        <Lobby
          t={t}
          lang={lang}
          theme={theme}
          session={session}
          onSessionUpdate={onSessionUpdate}
          onLeave={onLeave}
          onThemeToggle={onThemeToggle}
          onLangChange={setLang}
        />
      )}
      <IosInstallHint t={t} />
    </div>
  );
}
