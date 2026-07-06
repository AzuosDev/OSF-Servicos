import { useCallback, useEffect, useRef } from "react";

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "click", "scroll"] as const;

export function useInactivityLock(lock: () => void, isLocked: boolean) {
  const lastActivity = useRef(Date.now());

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    if (isLocked) return;

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    // Verifica periodicamente enquanto a aba está ativa.
    // setTimeout é throttled/pausado em abas em background pelo browser, por isso usamos
    // também visibilitychange para checar imediatamente ao voltar ao foreground.
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > INACTIVITY_TIMEOUT_MS) {
        lock();
      }
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActivity.current > INACTIVITY_TIMEOUT_MS) {
          lock();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLocked, lock, resetTimer]);
}
