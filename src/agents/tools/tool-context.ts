/**
 * Trusted context for one agent run. Deliberately NOT derived from
 * model-supplied tool arguments — run_id and user_id are bound once, in a
 * closure, when the tool set is built for a given run (see tool-registry.ts)
 * and every tool call re-authorizes against the database from these values.
 * TOOLS-CONTRACT.md section 4: "The agent should not be allowed to override
 * this context."
 */
export interface ToolContext {
  runId: string;
  userId: string;
}
