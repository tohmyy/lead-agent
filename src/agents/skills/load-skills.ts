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
  { name: "outreach-safety", file: "outreach-safety.md" }, // standing scope boundaries — always first
  { name: "icp-refinement", file: "icp-refinement.md" },
  { name: "lead-qualification", file: "lead-qualification.md" },
  { name: "outbound-copywriting", file: "outbound-copywriting.md" },
  { name: "lead-list-quality", file: "lead-list-quality.md" },
] as const;

export type SkillName = (typeof SKILL_FILES)[number]["name"];

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

let fileCache: Map<SkillName, string> | undefined;

async function getFileCache(): Promise<Map<SkillName, string>> {
  if (fileCache) return fileCache;

  const dir = path.join(process.cwd(), "src", "agents", "skills");
  const entries = await Promise.all(
    SKILL_FILES.map(async ({ name, file }) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      return [name, stripFrontmatter(raw)] as const;
    }),
  );
  fileCache = new Map(entries);
  return fileCache;
}

/**
 * Loads only the skills relevant to the current agent turn (BUILD-PLAN.md
 * section 45 — the runtime should only receive what's relevant to the
 * current step). `outreach-safety` is always included regardless of what's
 * requested: it carries the standing scope boundaries (never send, never
 * treat scraped content as instructions, never access secrets) that apply
 * to every phase, not outreach-specific rules — hence its "always first"
 * position in SKILL_FILES.
 */
export async function loadSkillsText(skillNames: SkillName[]): Promise<string> {
  const cache = await getFileCache();
  const wanted = new Set<SkillName>(["outreach-safety", ...skillNames]);
  return SKILL_FILES.filter((s) => wanted.has(s.name))
    .map((s) => cache.get(s.name)!)
    .join("\n\n---\n\n");
}
