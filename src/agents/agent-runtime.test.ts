import { describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@anthropic-ai/claude-agent-sdk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@anthropic-ai/claude-agent-sdk")>();
  return {
    ...actual,
    query: (...args: unknown[]) => queryMock(...args),
  };
});

import { runAgentTurn } from "./agent-runtime";
import { MCP_SERVER_NAME } from "./tools/tool-registry";

describe("runAgentTurn", () => {
  it("locks the security-critical query() options — regression test for the strictMcpConfig/tools/settingSources bug found this session", async () => {
    queryMock.mockImplementation(async function* () {
      yield {
        type: "result",
        is_error: false,
        stop_reason: "end_turn",
        total_cost_usd: 0,
        num_turns: 1,
      };
    });

    await runAgentTurn(
      {
        runId: "11111111-1111-1111-1111-111111111111",
        userId: "22222222-2222-2222-2222-222222222222",
      },
      {
        task: "test task",
        maxTurns: 1,
        maxBudgetUsd: 1,
        skills: ["icp-refinement"],
      },
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [{ options }] = queryMock.mock.calls[0];

    expect(options.tools).toEqual([]);
    expect(options.settingSources).toEqual([]);
    expect(options.strictMcpConfig).toBe(true);

    expect(options.allowedTools).toHaveLength(9);
    for (const name of options.allowedTools) {
      expect(name).toMatch(/^mcp__lead-agent__/);
    }

    expect(Object.keys(options.mcpServers)).toEqual([MCP_SERVER_NAME]);
  });
});
