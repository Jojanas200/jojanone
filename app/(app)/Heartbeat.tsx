"use client";
import { useEffect } from "react";

// Pings the session heartbeat so any active user counts toward DAU/WAU/MAU.
// Fires on mount, when the tab regains focus, and every 15 minutes for long
// sessions (e.g. crossing a day boundary). The server throttles per user, so
// these pings collapse to at most one event per window. Best-effort - failures
// are ignored and never surfaced to the user.
export function Heartbeat() {
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      fetch("/api/events/heartbeat", { method: "POST", keepalive: true }).catch(
        () => {},
      );
    };

    ping();
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(ping, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  return null;
}
