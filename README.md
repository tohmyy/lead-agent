# AI Lead Research and Outreach Agent

A Next.js application where a user submits a lead-qualification objective, Claude (via the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)) refines it into an ICP, a human approves it, the agent discovers candidate companies through Apify, researches their websites through Firecrawl, qualifies them against the ICP with evidence, and drafts — but never sends — a 3-step email sequence and LinkedIn message for each qualified lead. Supabase is the audit trail throughout.

**One-pager (how it works & how to use it):** [`docs/ONE-PAGER.md`](docs/ONE-PAGER.md)

See `docs/` for the full spec set (PRD, UI spec, data model, architecture, tool contracts, build plan, test plan, agent instructions) and `C:\Users\TF\.claude\plans\initialize-and-build-with-deep-glade.md` for the implementation plan this build followed, including how conflicts between the spec documents were resolved.

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Claude Agent SDK · Supabase (Postgres + Auth) · Apify · Firecrawl · Zod · Vitest · Playwright

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** and configure `.env.local` (copy `.env.example`). Server-only secrets never get a `NEXT_PUBLIC_` prefix.

3. **Apply the database schema.** Either:
   - Paste the files in `supabase/migrations/` into the Supabase SQL editor, in order; or
   - Set `DATABASE_URL` in `.env.local` (Project Settings → Database → Connection string) and run:
     ```bash
     npm run db:migrate
     ```

4. **Seed example data** (optional, for local UI development without spending real Apify/Firecrawl budget):

   ```bash
   npm run db:seed
   ```

   Creates a dev user (`SEED_USER_EMAIL`/`SEED_USER_PASSWORD` in `.env.local`, defaults in `.env.example`) and one example run with a qualified lead and outreach drafts.

5. **Configure Apify.** Set `APIFY_API_TOKEN` (from the team account, not a personal one) and `APIFY_DISCOVERY_ACTOR_ID` to an approved, pay-per-event actor — never a rental actor. Test with a run of 1–2 results first and check the cost in the Apify console before scaling up.

6. **Run the app**
   ```bash
   npm run dev
   ```
   Sign up at `/login`, or sign in with the seed user if you ran `db:seed`.

## Scripts

| Command                                                 | Purpose                                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                           | Start the dev server                                                                                                             |
| `npm run build` / `npm run start`                       | Production build / start                                                                                                         |
| `npm run lint` / `npm run typecheck` / `npm run format` | Code quality                                                                                                                     |
| `npm run test` / `npm run test:watch`                   | Vitest unit/integration tests (no live provider credentials required)                                                            |
| `npm run test:e2e`                                      | Playwright end-to-end test — requires a live Supabase project and real Anthropic/Apify/Firecrawl credentials; spends real budget |
| `npm run db:migrate` / `npm run db:seed`                | Apply migrations / seed example data                                                                                             |

## How it's organized

```
src/
├── app/                 Next.js routes, server actions, UI
├── components/          UI components (shadcn/ui primitives + app components)
├── domain/               Framework-free business rules and validation
├── application/         Services coordinating domain + infrastructure (RunService, DiscoveryService, ...)
├── infrastructure/      Supabase repositories, Apify/Firecrawl adapters
├── agents/              Claude Agent SDK tools, skills, prompts, orchestrator
└── lib/                 Config, security (SSRF guard), logging (redaction)
supabase/migrations/     SQL schema, in order
```

The core architectural boundary: **Claude reasons and selects tools; the application enforces every limit, authorization check, and safety rule** — see `docs/AGENTS.md` and `ARCHITECTURE2.md`.

## What's built vs. deferred

This build covers the full vertical slice: objective → ICP refinement → human approval gate → bounded Apify discovery → Firecrawl research → evidence-backed qualification → outreach drafting → human review → CSV/outreach-pack export, with Supabase Auth, RLS, and an initial safety-focused test suite.

Deferred to a follow-up pass (see the implementation plan): Supabase Realtime for the activity feed (currently polls), the full UI-SPEC visual design pass, the remainder of TEST-PLAN.md's test matrix, and deployment.

## Assets → skills

The five guidance documents in `assets/` were adapted (YAML frontmatter added, confidence scale corrected to match the app's 0–100 integer scale, field names aligned to the actual tool schemas) into `src/agents/skills/`. They're loaded server-side and embedded directly in the agent's system prompt rather than through the Claude Agent SDK's file-based skill discovery, because that mechanism depends on the model having Read/Bash access — which this agent deliberately does not have. See the comment in `src/agents/skills/load-skills.ts`.
