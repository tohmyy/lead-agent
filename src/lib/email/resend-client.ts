import "server-only";

import { getServerEnv } from "@/lib/config/env";

/**
 * Whether email delivery has what it needs. Callers pass the raw env
 * strings in and get only a boolean back — this module never returns a key
 * (mirrors src/lib/config/provider-readiness.ts's pattern).
 */
export function isEmailConfigured(env: {
  resendApiKey?: string;
  emailFrom?: string;
}): boolean {
  return Boolean(env.resendApiKey?.trim() && env.emailFrom?.trim());
}

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends via Resend's REST API directly (no SDK dependency). Deliberately
 * never throws — every branch (unconfigured, a non-2xx response, a network
 * error) resolves to a tagged result, so callers can treat email as pure
 * best-effort and never need a try/catch around this call.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const env = getServerEnv();
  if (!isEmailConfigured({ resendApiKey: env.RESEND_API_KEY, emailFrom: env.EMAIL_FROM })) {
    return {
      ok: false,
      reason: "Email is not configured (RESEND_API_KEY/EMAIL_FROM unset).",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Resend API returned ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
