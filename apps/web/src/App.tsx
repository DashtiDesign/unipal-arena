import { useState } from "react";
import { Lang, getT } from "./i18n";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import IosInstallHint from "./components/IosInstallHint";
import type { Room, ArenaState } from "@arena/shared";

export type Screen = "home" | "lobby";

export interface Session {
  roomCode: string;
  playerId: string;
  room: Room;
  arena: ArenaState;
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<Session | null>(null);
  const t = getT(lang);

  function onJoined(s: Session) {
    setSession(s);
    setScreen("lobby");
  }

  function onLeave() {
    setSession(null);
    setScreen("home");
  }

  function onSessionUpdate(room: Room, arena: ArenaState) {
    setSession((prev) => prev ? { ...prev, room, arena } : prev);
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
          onLangToggle={() => setLang(lang === "en" ? "ar" : "en")}
          onJoined={onJoined}
        />
      )}
      {screen === "lobby" && session && (
        <Lobby
          t={t}
          lang={lang}
          onLangToggle={() => setLang(lang === "en" ? "ar" : "en")}
          session={session}
          onSessionUpdate={onSessionUpdate}
          onLeave={onLeave}
        />
      )}
      <IosInstallHint t={t} />
    </div>
  );
}
