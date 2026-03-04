import { useEffect, useRef, useState } from "react";
import { T, Lang } from "../i18n";
import type { Theme } from "../App";

interface Props {
  t: T;
  lang: Lang;
  theme: Theme;
  onThemeToggle: () => void;
  onLangChange: (l: Lang) => void;
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export default function SettingsDropdown({ t, lang, theme, onThemeToggle, onLangChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const segBase = "flex items-center justify-center flex-1 h-9 transition-colors text-sm font-medium";
  const segActive = "bg-(--accent) text-(--accent-foreground)";
  const segInactive = "text-(--foreground) hover:bg-(--surface-secondary)";

  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-(--border) bg-(--surface) text-sm font-medium text-(--foreground) hover:bg-(--surface-secondary) transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.settings}
      >
        <GearIcon />
        <span>{t.settings}</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 z-50 w-52 rounded-2xl border border-(--border) bg-(--surface) shadow-xl p-3 flex flex-col gap-3">
          {/* Theme */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-(--muted) uppercase tracking-wider">Theme</p>
            <div className="flex rounded-lg border border-(--border) overflow-hidden">
              <button
                className={`${segBase} gap-1 ${theme === "light" ? segActive : segInactive}`}
                onClick={() => theme !== "light" && onThemeToggle()}
                aria-label="Light mode"
              >
                <SunIcon /><span className="text-xs">Light</span>
              </button>
              <button
                className={`${segBase} gap-1 ${theme === "dark" ? segActive : segInactive}`}
                onClick={() => theme !== "dark" && onThemeToggle()}
                aria-label="Dark mode"
              >
                <MoonIcon /><span className="text-xs">Dark</span>
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-(--muted) uppercase tracking-wider">Language</p>
            <div className="flex rounded-lg border border-(--border) overflow-hidden">
              <button
                className={`${segBase} ${lang === "en" ? segActive : segInactive}`}
                onClick={() => onLangChange("en")}
                aria-label="English"
              >
                EN
              </button>
              <button
                className={`${segBase} ${lang === "ar" ? segActive : segInactive}`}
                onClick={() => onLangChange("ar")}
                aria-label="Arabic"
              >
                AR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
