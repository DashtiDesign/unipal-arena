import { useState, useEffect } from "react";
import { T } from "../i18n";
import { Button } from "@heroui/react";

interface Props {
  t: T;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

const STORAGE_KEY = "ios-hint-dismissed";

export default function IosInstallHint({ t }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIos() && !isInStandaloneMode() && !sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed bottom-0 inset-x-0 z-50 px-4 pb-[calc(1rem+var(--sab))]"
    >
      <div className="flex flex-col gap-2 p-4 rounded-xl bg-(--surface) border border-(--border) shadow-xl text-sm">
        <div className="flex items-center gap-2 w-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-(--accent)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
          </svg>
          <span className="flex-1">{t.installHint}</span>
        </div>
        <Button variant="ghost" size="sm" className="self-end" onPress={dismiss}>
          {t.installHintClose}
        </Button>
      </div>
    </div>
  );
}
