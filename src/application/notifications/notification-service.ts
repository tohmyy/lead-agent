import "server-only";

import { getServerEnv } from "@/lib/config/env";
import { sendEmail } from "@/lib/email/resend-client";
import { NotificationRepository } from "@/infrastructure/supabase/repositories/notification-repository";
import { createServiceRoleSupabaseClient } from "@/infrastructure/supabase/service-role-client";
import { log } from "@/lib/logging/logger";
import type { NotificationRow } from "@/infrastructure/supabase/types";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function failureEmailText(input: {
  objective: string;
  message: string;
  runId: string;
  runUrl: string | null;
}): string {
  const lines = [
    "Your research run failed.",
    "",
    `Objective: ${input.objective}`,
    `Reason: ${input.message}`,
    "",
  ];
  lines.push(
    input.runUrl
      ? `View the run: ${input.runUrl}`
      : `Run ID: ${input.runId} — open the app and find this run on your dashboard.`,
  );
  return lines.join("\n");
}

function failureEmailHtml(input: {
  objective: string;
  message: string;
  runId: string;
  runUrl: string | null;
}): string {
  const link = input.runUrl
    ? `<p><a href="${input.runUrl}">View the run</a></p>`
    : `<p>Run ID: ${input.runId} — open the app and find this run on your dashboard.</p>`;
  return [
    "<p>Your research run failed.</p>",
    `<p><strong>Objective:</strong> ${escapeHtml(input.objective)}</p>`,
    `<p><strong>Reason:</strong> ${escapeHtml(input.message)}</p>`,
    link,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class NotificationService {
  constructor(
    private readonly notifications = new NotificationRepository(),
  ) {}

  async listRecent(userId: string, limit = 20): Promise<NotificationRow[]> {
    return this.notifications.listForUser(userId, { limit });
  }

  async markRead(id: string, userId: string): Promise<void> {
    return this.notifications.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    return this.notifications.markAllRead(userId);
  }

  /**
   * Called from RunOrchestrator.fail(). MUST NEVER THROW — a delivery
   * failure here must never mask that the run itself already failed and
   * was correctly recorded. Every side effect below has its own try/catch;
   * the whole method is also wrapped as a final safety net.
   */
  async notifyRunFailed(input: {
    runId: string;
    userId: string;
    objective: string;
    message: string;
  }): Promise<void> {
    try {
      try {
        await this.notifications.create({
          userId: input.userId,
          runId: input.runId,
          type: "run_failed",
          title: "Research run failed",
          message: input.message,
        });
      } catch (err) {
        log.error("[notifications:create] failed to record notification", {
          runId: input.runId,
          message: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const db = createServiceRoleSupabaseClient();
        const { data, error } = await db.auth.admin.getUserById(
          input.userId,
        );
        const email = data?.user?.email;
        if (error || !email) {
          log.warn("[notifications:email] could not resolve owner email", {
            runId: input.runId,
            userId: input.userId,
          });
          return;
        }

        const env = getServerEnv();
        const runUrl = env.APP_URL ? `${env.APP_URL}/runs/${input.runId}` : null;
        const emailInput = {
          objective: input.objective,
          message: input.message,
          runId: input.runId,
          runUrl,
        };
        const result = await sendEmail({
          to: email,
          subject: `Research run failed: "${truncate(input.objective, 80)}"`,
          html: failureEmailHtml(emailInput),
          text: failureEmailText(emailInput),
        });
        if (!result.ok) {
          log.error("[notifications:email] send failed", {
            runId: input.runId,
            reason: result.reason,
          });
        }
      } catch (err) {
        log.error("[notifications:email] unexpected error", {
          runId: input.runId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      // Final safety net — should be unreachable given the two inner
      // try/catches above, but guarantees this method truly cannot throw.
      log.error("[notifications:notifyRunFailed] unexpected error", {
        runId: input.runId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
