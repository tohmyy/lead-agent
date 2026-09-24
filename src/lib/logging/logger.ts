import "server-only";

import { getServerEnv } from "@/lib/config/env";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

/**
 * Minimal leveled logger gated by LOG_LEVEL, tagged with APP_ENV
 * (BUILD-PLAN.md section 7 — both were validated by env.ts but had no
 * consumer). Not a log-shipping/transport system; just console output with
 * a threshold, which is all Phase 2 calls for.
 */
function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const env = getServerEnv();
  if (LEVELS[level] < LEVELS[env.LOG_LEVEL]) return;

  const line = `[${env.APP_ENV}] [${level}] ${message}`;
  const console_ = console[level === "debug" ? "debug" : level];
  if (meta !== undefined) console_(line, meta);
  else console_(line);
}

export const log = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", message, meta),
};
