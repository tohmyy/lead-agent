> **Draft.** This answers `docs/BUILD-PLAN.md` §62 from the decisions actually made in this codebase. Personalize it (voice, specific anecdotes from your own build/demo experience) before submitting.

# Reflection

## What was built

An AI Lead Research and Outreach Agent: a Next.js app where a user submits a plain-language qualification objective, Claude (via the Claude Agent SDK) refines it into a structured ICP, a human approves it, the agent discovers candidate companies through Apify, researches their public websites through Firecrawl, qualifies each one against the approved ICP with evidence, and drafts — never sends — a 3-step email sequence and LinkedIn message per qualified lead. Supabase is the audit trail throughout: every ICP version, discovered company, research source, qualification decision, tool call, and outreach draft is persisted and traceable back to the run that produced it.

## Why this architecture was chosen

The central principle, stated directly in `ARCHITECTURE2.md`: **Claude is the reasoning engine; the application is the control plane.** The agent decides what to research and how to qualify a company, but it never decides whether a tool call is allowed to execute, what limits apply, or whether a database mutation is valid — those are deterministic, server-side checks the model cannot talk its way around. This split matters most exactly where the stakes are highest: spending real money (Apify discovery), touching the open internet (website research), and representing a company to a stranger (outreach). Concretely, that meant a layered structure — UI → Application services (RunService, DiscoveryService, QualificationService, OutreachService) → Domain (framework-free validation) → Infrastructure adapters (Supabase, Apify, Firecrawl) — so business rules stay testable independently of any external provider, and a provider can be swapped (Firecrawl → Crawl4AI, for instance) without touching the agent's tool contract.

## How the Claude Agent SDK was used

The SDK drives two bounded agent turns per run: one that discovers, researches, and qualifies candidates against a target and a hard turn/cost budget, and a second, separately-bounded turn that generates outreach only for leads the *application* — not the agent's own narration — has confirmed are qualified (`src/application/runs/run-orchestrator.ts`). The agent has no built-in file or shell tools (`tools: []`); it can only act through the explicitly registered tool set (`get_run_context`, `discover_companies`, `research_website`, `record_source`, `get_company_context`, `save_lead`, `save_outreach_draft`, `record_run_event`). Skill guidance (ICP refinement, lead qualification, outbound copywriting, lead-list quality, outreach safety) is loaded server-side and embedded directly in the system prompt per turn (`src/agents/skills/load-skills.ts`), specifically because the SDK's own file-based skill discovery would require giving the model Read access — which was deliberately withheld.

## How tools were controlled

Every tool call passes through the same pipeline regardless of which tool it is: schema validation, authentication, run-ownership authorization, business-rule validation, cost/security checks, then (and only then) the application service and infrastructure adapter. A handful of examples make this concrete: `save_lead` cross-checks the agent's qualification verdict against structured research metadata and rejects "qualified" if a known employee count falls outside the approved ICP's range, regardless of what the agent's own reasoning concluded; `discover_companies` checks the run's remaining discovery slots before calling Apify at all; and every tool call is logged (tool name, purpose, status, duration, error) independently of whatever the agent says happened.

## How Apify costs were managed

Discovery is bounded by a per-run `discovery_limit` set at run creation and enforced server-side — the agent cannot request more, and a `MAX_DISCOVERY_LIMIT` environment variable is a hard ceiling regardless of what any individual run asks for. `ApifyDiscoveryProvider.assertNotRentalActor` rejects rental-pricing actors at runtime, restricting discovery to pay-per-event actors whose cost is predictable. Recorded spend (`discovery_cost_usd`, `agent_cost_usd`, added in `supabase/migrations/005_operator_workflow.sql`) is tracked per run and surfaced on the Overview tab, and a provider-readiness check (`src/lib/config/provider-readiness.ts`) tells the user upfront, before they create a run, whether discovery and research providers are actually configured — so a misconfigured run fails fast instead of burning budget partway through.

## How website content was treated as untrusted

Scraped page content only ever enters the system as tool *output* — data returned to the model for it to evaluate — never as text injected into the system prompt or interpreted as an instruction. The `outreach-safety` skill is always loaded on every agent turn regardless of what stage the turn is for, specifically to carry this standing rule. SSRF protection (`src/lib/security/url-safety.ts`, tested in `url-safety.test.ts`) rejects unsupported schemes, localhost, and private/loopback addresses before any research fetch happens, so even the choice of *what* to fetch is constrained independently of the agent's judgment.

## How qualification evidence was stored

Every fit reason and concern a lead receives carries `source_ids` pointing at specific `lead_sources` rows — a qualification claim without a backing source is a schema validation failure, not a style suggestion. Hard filters get their own explicit pass/fail/unknown verdict per filter (`hard_filter_results`), stored separately from the free-text `qualification_reasoning`, so a reviewer can see the deterministic checks and the agent's judgment side by side rather than collapsed into one opaque score. There is deliberately no single "AI Lead Score" anywhere in the UI.

## How outreach safety was handled

Outreach generation only runs for leads the application has independently confirmed are qualified — never for leads the agent merely claims are qualified in its own narration. Each personalization claim in a draft must reference a known source id (`assertClaimsReferenceKnownSources`), so copy can't invent a customer, a funding round, or a capability the research never surfaced. Review state is modeled explicitly (`not_reviewed` → `reviewed`/`edited` → `approved_for_export`), and there is no `sent` state and no send action anywhere in the codebase — outreach delivery is out of scope by design, not by omission.

## What would be improved next

- Supabase Realtime for the activity feed (it currently polls) — deferred per `README.md`'s "What's built vs. deferred."
- A dedicated automated test that simulates a prompt-injection attempt inside scraped website content and asserts the agent's resulting tool calls stay within run limits — the protection is architectural today (content only ever arrives as tool output) but isn't yet exercised by a test the way SSRF is.
- CI (no `.github/workflows` exists yet) so `npm run test`/`typecheck`/`lint` run automatically on every change, not just locally.
- A deployment artifact (Vercel config or similar) so "deploy" is a repeatable step rather than a manual one.
