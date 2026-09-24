import { describe, expect, it } from "vitest";

import { LEAD_AGENT_TOOL_NAMES } from "./tool-registry";

/** TEST-PLAN.md SAFETY-001 / TOOLS-CONTRACT.md section 59, section 71. */
const FORBIDDEN_SUBSTRINGS = [
  "execute_sql",
  "send_email",
  "send_linkedin",
  "send_message",
  "delete_database",
  "modify_run_limits",
  "modify_user_permissions",
  "read_secrets",
  "read_environment",
  "arbitrary_http_request",
  "execute_shell",
];

describe("LEAD_AGENT_TOOL_NAMES", () => {
  it("registers exactly the 9 documented tools (TOOLS-CONTRACT.md section 3)", () => {
    expect(LEAD_AGENT_TOOL_NAMES).toHaveLength(9);
    for (const name of LEAD_AGENT_TOOL_NAMES) {
      expect(name).toMatch(/^mcp__lead-agent__/);
    }
  });

  it("never exposes a send/delete/secret/shell/sql capability", () => {
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(
        LEAD_AGENT_TOOL_NAMES.some((name) => name.includes(forbidden)),
      ).toBe(false);
    }
  });
});
