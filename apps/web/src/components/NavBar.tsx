import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import type { Theme } from "../App";

interface Props {
  theme: Theme;
  onThemeToggle: () => void;
  left: ReactNode;
  right?: ReactNode;
}

export default function NavBar({ theme, onThemeToggle, left, right }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-(--surface) border-b border-(--border) shadow-sm sticky top-0 z-10">
      <div className="flex-1 min-w-0">{left}</div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onPress={onThemeToggle} aria-label="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </Button>
        {right}
      </div>
    </div>
  );
}
