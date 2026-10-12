"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "splitwisely-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function InstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    if (ios && safari) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred && !iosHint) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Splitwisely</p>
          <p className="mt-0.5 text-xs text-muted">
            {deferred ? "Add it to your home screen and open it like an app." : "Tap Share, then Add to Home Screen."}
          </p>
        </div>
        {deferred ? (
          <button type="button" onClick={install} className="h-10 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg">
            Install
          </button>
        ) : (
          <Share size={16} className="mt-1 shrink-0 text-muted" aria-hidden />
        )}
        <button type="button" onClick={dismiss} className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle" aria-label="Dismiss install prompt">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
