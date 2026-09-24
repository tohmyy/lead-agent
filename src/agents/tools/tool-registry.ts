import "server-only";

import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

import { createDiscoverCompaniesTool } from "./discover-companies-tool";
import { createGetCompanyContextTool } from "./get-company-context-tool";
import { createGetRunContextTool } from "./get-run-context-tool";
import { createRecordRunEventTool } from "./record-run-event-tool";
import { createRecordSourceTool } from "./record-source-tool";
import { createResearchWebsiteTool } from "./research-website-tool";
import { createSaveIcpTool } from "./save-icp-tool";
import { createSaveLeadTool } from "./save-lead-tool";
import { createSaveOutreachDraftTool } from "./save-outreach-draft-tool";
import type { ToolContext } from "./tool-context";

export const MCP_SERVER_NAME = "lead-agent";

/**
 * The complete, closed set of capabilities available to the agent
 * (ARCHITECTURE2.md section 11 / TOOLS-CONTRACT.md section 58/59) — exactly
 * these 9 tools, each bound to one run via `ctx`, nothing else. There is no
 * execute_sql, send_email, arbitrary_http_request, or filesystem/shell
 * access anywhere in this server; see agent-runtime.ts for how this is
 * combined with `tools: []` to also disable every built-in Claude Code
 * tool.
 */
export function buildLeadAgentToolServer(ctx: ToolContext) {
  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
    // Without this, tools can be deferred behind a "tool search" step —
    // and since agent-runtime.ts sets `tools: []` (no built-in tools at
    // all, including any search mechanism), a deferred tool would be
    // completely unreachable: the model would have no way to discover it
    // and would just respond with text instead of ever calling save_icp,
    // discover_companies, etc.
    alwaysLoad: true,
    tools: [
      createGetRunContextTool(ctx),
      createSaveIcpTool(ctx),
      createDiscoverCompaniesTool(ctx),
      createResearchWebsiteTool(ctx),
      createRecordSourceTool(ctx),
      createGetCompanyContextTool(ctx),
      createSaveLeadTool(ctx),
      createSaveOutreachDraftTool(ctx),
      createRecordRunEventTool(ctx),
    ],
  });
}

/** Full `mcp__lead-agent__<tool>` names, for the `allowedTools` allow-list. */
export const LEAD_AGENT_TOOL_NAMES = [
  "get_run_context",
  "save_icp",
  "discover_companies",
  "research_website",
  "record_source",
  "get_company_context",
  "save_lead",
  "save_outreach_draft",
  "record_run_event",
].map((name) => `mcp__${MCP_SERVER_NAME}__${name}`);
