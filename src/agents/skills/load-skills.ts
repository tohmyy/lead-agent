import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * These 5 files are adapted from `assets/*.md` (BUILD-PLAN.md Phase 9) with
 * YAML frontmatter added for documentation/authoring consistency with the
 * standard skill format. They are NOT loaded via the Claude Agent SDK's
 * built-in `skills` option / Skill tool, because that mechanism depends on
 * the model being able to invoke Read (skill files "remain on disk and are
 * reachable via Read/Bash" per the SDK's own docs) — and this agent
 * deliberately has `tools: []` (no built-in file/shell tools at all; see
 * agent-runtime.ts). Instead, this server-side loader reads their content
 * directly and the caller embeds it in the system prompt, so the skill
 * guidance is always present without ever giving the model file access.
 */
const SKILL_FILES = [
  "outreach-safety.md", // standing scope boundaries — always first
  "icp-refinement.md",
  "lead-qualification.md",
  "outbound-copywriting.md",
  "lead-list-quality.md",
] as const;

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

let cached: string | undefined;

export async function loadSkillsText(): Promise<string> {
  if (cached) return cached;

  const dir = path.join(process.cwd(), "src", "agents", "skills");
  const contents = await Promise.all(
    SKILL_FILES.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      return stripFrontmatter(raw);
    }),
  );

  cached = contents.join("\n\n---\n\n");
  return cached;
}
