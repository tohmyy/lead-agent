import "server-only";

import { tool } from "@anthropic-ai/claude-agent-sdk";
import type {
  AnyZodRawShape,
  InferShape,
} from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";

import { AppError, isAppError } from "@/domain/shared/errors";
import { sanitizeForLog } from "@/lib/logging/sanitize";
import { ToolCallRepository } from "@/infrastructure/supabase/repositories/tool-call-repository";

const toolCalls = new ToolCallRepository();

/**
 * Wraps a business-logic function as a registered agent tool, with
 * automatic tool_calls logging around every execution (TOOLS-CONTRACT.md
 * section 38 — this is the "later track" resolution from the
 * implementation plan: the agent cannot skip or fake this logging, because
 * it isn't the agent doing it).
 */
export function defineRunTool<Schema extends AnyZodRawShape>(config: {
  name: string;
  description: string;
  shape: Schema;
  outputSchema: z.ZodType<unknown>;
  purpose: string;
  runId: string;
  execute: (args: InferShape<Schema>) => Promise<unknown>;
}) {
  return tool(config.name, config.description, config.shape, async (args) => {
    const startedAtMs = Date.now();
    const toolCallId = await toolCalls.start({
      runId: config.runId,
      toolName: config.name,
      purpose: config.purpose,
      inputSummary: sanitizeForLog(args) as Record<string, unknown>,
    });

    try {
      const data = config.outputSchema.parse(await config.execute(args));
      if (toolCallId) {
        await toolCalls.complete(toolCallId, {
          status: "success",
          resultSummary: sanitizeForLog(data) as Record<string, unknown>,
          startedAtMs,
        });
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, data }),
          },
        ],
      };
    } catch (err) {
      const appError = isAppError(err)
        ? err
        : new AppError(
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
            false,
          );

      if (toolCallId) {
        await toolCalls.complete(toolCallId, {
          status: "failed",
          errorMessage: appError.message,
          startedAtMs,
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: appError.code,
                message: appError.message,
                retryable: appError.retryable,
              },
            }),
          },
        ],
        isError: true,
      };
    }
  });
}
