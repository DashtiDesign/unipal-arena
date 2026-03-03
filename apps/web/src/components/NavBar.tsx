import type { ReactNode } from "react";
import type { Theme } from "../App";
import type { Lang } from "../i18n";

interface Props {
  theme: Theme;
  onThemeToggle: () => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  left: ReactNode;
  extra?: ReactNode;
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

function getLogoSrc(lang: Lang, theme: Theme): string {
  if (lang === "en" && theme === "light") return "/logo-en-light.svg";
  if (lang === "en" && theme === "dark")  return "/logo-en-dark.svg";
  if (lang === "ar" && theme === "light") return "/logo-ar-light.svg";
  return "/logo-ar-dark.svg";
}

export default function NavBar({ theme, onThemeToggle, lang, onLangChange, left, extra }: Props) {
  const segBase = "flex items-center justify-center w-9 h-9 transition-colors";
  const segActive = "bg-(--accent) text-(--accent-foreground)";
  const segInactive = "text-(--foreground) hover:bg-(--surface-secondary)";

  const logoSrc = getLogoSrc(lang, theme);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm sticky top-0 z-10 gap-3">
      <div className="flex-1 min-w-0">
        {left ?? (
          <img
            src={logoSrc}
            alt="Unipal Arena"
            className="h-8 w-auto object-contain object-left"
            key={logoSrc}
          />
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Theme segmented control — sun/moon icons */}
        <div className="flex rounded-lg border border-(--border) overflow-hidden">
          <button
            className={`${segBase} ${theme === "light" ? segActive : segInactive}`}
            onClick={() => theme !== "light" && onThemeToggle()}
            aria-label="Light mode"
          >
            <SunIcon />
          </button>
          <button
            className={`${segBase} ${theme === "dark" ? segActive : segInactive}`}
            onClick={() => theme !== "dark" && onThemeToggle()}
            aria-label="Dark mode"
          >
            <MoonIcon />
          </button>
        </div>

        {/* Language segmented control */}
        <div className="flex rounded-lg border border-(--border) overflow-hidden">
          <button
            className={`${segBase} px-3 text-sm font-medium ${lang === "en" ? segActive : segInactive}`}
            onClick={() => onLangChange("en")}
            aria-label="English"
          >
            EN
          </button>
          <button
            className={`${segBase} px-3 text-sm font-medium ${lang === "ar" ? segActive : segInactive}`}
            onClick={() => onLangChange("ar")}
            aria-label="Arabic"
          >
            AR
          </button>
        </div>

        {extra}
      </div>
    </div>
  );
}
