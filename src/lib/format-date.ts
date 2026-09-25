/**
 * Always pass an explicit locale/options — `toLocaleString()` with no
 * arguments uses the runtime's default locale, which differs between the
 * Node server (SSR) and the browser, producing a React hydration mismatch
 * on every timestamp in the UI (server "23/09/2026, 19:26:56" vs. client
 * "2026-09-23, 7:26:56 p.m."). Fixing the locale makes server and client
 * render identical text.
 */
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeStyle: "medium",
};

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-US", DATE_TIME_OPTIONS);
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-US", TIME_OPTIONS);
}

/** Whole minutes, so a server-rendered dashboard does not flicker on hydration. */
export function formatElapsed(fromIso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(fromIso).getTime());
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
