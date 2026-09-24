const SECRET_KEY_PATTERN =
  /key|token|secret|password|authorization|credential/i;
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 6;

/**
 * Defense-in-depth redaction for anything written to tool_calls/run_events
 * (data-model.md section 27, AGENTS.md #22): no tool input schema in this
 * app should ever legitimately carry a secret, but this guarantees it even
 * if one did, and keeps logged payloads small.
 */
export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeForLog(val, depth + 1);
    }
    return out;
  }

  return value;
}
