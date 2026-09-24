import "server-only";

import { query } from "@anthropic-ai/claude-agent-sdk";

import { buildSystemPrompt } from "@/agents/prompts/system-prompt";
import {
  buildLeadAgentToolServer,
  LEAD_AGENT_TOOL_NAMES,
  MCP_SERVER_NAME,
} from "@/agents/tools/tool-registry";
import type { ToolContext } from "@/agents/tools/tool-context";
import { AppError } from "@/domain/shared/errors";

const MODEL = "claude-sonnet-5";

export interface AgentTurnResult {
  isError: boolean;
  stopReason: string | null;
  totalCostUsd: number;
  numTurns: number;
}

/**
 * Runs one bounded agent turn against exactly the 9 lead-research tools
 * (ARCHITECTURE2.md section 11) — `tools: []` disables every Claude Code
 * built-in (Read, Write, Bash, Skill, ...), and `allowedTools` is the
 * closed list of our own MCP tools, so nothing else is ever reachable
 * (AGENTS.md #77 "Important Anti-Patterns"). `maxTurns`/`maxBudgetUsd` are
 * hard stops independent of anything the agent decides
 * (ARCHITECTURE2.md section 37 "the agent should not decide retry/continue
 * budgets").
 */
export async function runAgentTurn(
  ctx: ToolContext,
  input: { task: string; maxTurns: number; maxBudgetUsd: number },
): Promise<AgentTurnResult> {
  const systemPrompt = await buildSystemPrompt();
  const toolServer = buildLeadAgentToolServer(ctx);

  let last: AgentTurnResult = {
    isError: true,
    stopReason: "no_result",
    totalCostUsd: 0,
    numTurns: 0,
  };

  for await (const message of query({
    prompt: input.task,
    options: {
      model: MODEL,
      systemPrompt: { type: "custom", prompt: systemPrompt },
      tools: [],
      mcpServers: { [MCP_SERVER_NAME]: toolServer },
      allowedTools: LEAD_AGENT_TOOL_NAMES,
      maxTurns: input.maxTurns,
      maxBudgetUsd: input.maxBudgetUsd,
      settingSources: [],
      // Without this, the spawned Claude Code subprocess also picks up
      // this *host* environment's own MCP servers (e.g. project/user
      // .mcp.json, plugins) — in dev that leaked in the "Claude Docs" MCP
      // server from this coding session, and the model reported that our
      // own tools "aren't actually available" because it only saw that
      // unrelated server's tools instead.
      strictMcpConfig: true,
      includePartialMessages: false,
    },
  })) {
    if (message.type === "result") {
      last = {
        isError: message.is_error,
        stopReason: message.stop_reason,
        totalCostUsd: message.total_cost_usd,
        numTurns: message.num_turns,
      };
    }
  }

  return last;
}

export function assertAgentTurnSucceeded(
  result: AgentTurnResult,
  context: string,
): void {
  if (result.isError) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Agent turn (${context}) did not complete successfully (stop_reason: ${result.stopReason ?? "unknown"}).`,
    );
  }
}
