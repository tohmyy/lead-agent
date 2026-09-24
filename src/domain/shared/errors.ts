/**
 * Canonical tool/application error codes. Merged from the two conflicting
 * TOOL-CONTRACTS drafts per the implementation plan's "Resolved Conflicts"
 * table — this is the one list the rest of the codebase uses.
 */
export const ERROR_CODES = [
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "RUN_NOT_FOUND",
  "RUN_NOT_ACTIVE",
  "ICP_NOT_APPROVED",
  "DISCOVERY_LIMIT_EXCEEDED",
  "TARGET_ALREADY_REACHED",
  "PROVIDER_ERROR",
  "PROVIDER_TIMEOUT",
  "INVALID_URL",
  "SSRF_BLOCKED",
  "INVALID_PROVIDER_RESPONSE",
  "DUPLICATE_RECORD",
  "DATABASE_ERROR",
  "OUTREACH_NOT_ALLOWED",
  "EVIDENCE_REQUIRED",
  "COMPANY_NOT_FOUND",
  "LEAD_NOT_FOUND",
  "INVALID_OUTREACH_CHANNEL",
  "SAFETY_VALIDATION_FAILED",
  "INVALID_DISCOVERY_PROVIDER",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set([
  "PROVIDER_TIMEOUT",
  "DATABASE_ERROR",
]);

/**
 * A structured, agent-safe error. `message` must never contain secrets —
 * it is surfaced to Claude as a tool result and to the UI as an event.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, retryable?: boolean) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = retryable ?? RETRYABLE_CODES.has(code);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
