Oluwatofunmi Adeyinka
AI Lead Research and Outreach Agent

## 1. Purpose & Problem

Outbound growth at Koya Talent — reaching founders, operations leads, and agency owners who could use an AI automation assistant on their team — currently runs on manual labor: a human defines the target persona, searches for candidate companies, checks each one against the persona by hand, reads through company websites for context, and writes cold outreach from scratch. The core business problem is throughput with evidence: qualifying more leads per week without qualification quality (or outreach personalization) degrading, and without losing the paper trail needed to trust a "qualified" verdict. This agent automates objective refinement, company discovery, website research, evidence-backed qualification, and outreach drafting, while keeping spend and message-sending under deterministic, human-controlled limits — never the agent's own judgment.

## 2. What Success Looks Like

- **Objective-to-ICP:** A user submits a plain-language qualification objective and gets back a structured ICP (hard filters, soft signals, personas) to review before anything is spent.
- **Evidence-backed qualification:** Every qualified/not-qualified verdict carries fit reasons and concerns tied to specific sourced pages; hard filters are re-checked independently by the application, not just asserted by the agent.
- **Review-ready outreach:** Each qualified lead gets a 3-step email sequence and one LinkedIn message, personalized only with claims traceable to real research evidence.
- **Full audit trail:** Every ICP version, discovered company, research source, qualification decision, tool call, and outreach draft is recorded in Supabase and visible in the UI.
- **Zero uncontrolled spend or send:** Discovery never exceeds the run's hard limit; there is no "send" action anywhere in the app.

## 3. Architecture & Tech Stack

- **Next.js (App Router):** Frontend UI, auth, run creation, ICP approval, and review workflows.
- **Claude Agent SDK:** Agent runtime, run as two separately-bounded turns per run — discover/research/qualify, then draft outreach only for leads the application has confirmed qualified. The agent has no file/shell tools, only the explicit tool set it's given.
- **Supabase (Postgres + Auth + RLS):** System of record for run configs, ICPs, discovered companies, leads, sources, tool-call logs, and outreach drafts.
- **Apify:** Company discovery, restricted to pay-per-event actors (rental actors are rejected at runtime).
- **Firecrawl:** Public website research per candidate company.
- **Layering:** UI → Application services (RunService, DiscoveryService, QualificationService, OutreachService) → Domain (framework-free business rules) → Infrastructure adapters — so qualification and safety rules stay testable independent of any provider.

## 4. End-to-End Pipeline

1. **Intake:** User submits an objective plus a qualified-lead target and a discovery maximum (a hard ceiling, not a suggestion).
2. **ICP Refinement:** Claude turns the objective into a structured ICP. No paid step has run yet.
3. **Human Approval Gate:** User reviews, edits, or regenerates the ICP — the one required checkpoint before any discovery or research spend.
4. **Discovery:** Apify finds candidate companies up to the discovery maximum, enforced server-side regardless of what the agent requests.
5. **Research:** Firecrawl scrapes each candidate's public website (homepage, product, about, pricing as relevant).
6. **Qualification:** The agent scores each company against the approved ICP with source-tied fit reasons and concerns; the application independently re-verifies every hard filter before a lead can be marked qualified.
7. **Outreach Drafting:** For qualified leads only, Claude drafts three emails and one LinkedIn message, personalized strictly with claims that trace back to recorded sources.
8. **Review & Export:** User reviews, edits, and approves leads and drafts, then exports a CSV/Markdown outreach pack. There is no publishing or sending step — outreach delivery is entirely manual, by design.

## 5. Appendix: Assumptions & Limitations

**Assumptions:** The qualification objective is supplied as free text and is always human-approved (as a refined ICP) before any paid discovery or research runs; a "qualified" verdict reflects both the agent's reasoning and the application's independent hard-filter check passing, not the agent's narration alone; each run operates against a single user-owned workspace.

**Limitations:**
(i) Discovery is capped by a hard-coded `MAX_DISCOVERY_LIMIT` regardless of what any individual run requests, and depends on a correctly configured pay-per-event Apify actor; qualification and outreach quality are bounded by how much a target company's public website actually discloses — thin sites yield thinner evidence and thinner drafts.
(ii) Not yet deployed to a public URL (runs locally today; see `docs/DEPLOYMENT.md` for the deployment checklist); the live activity feed currently polls rather than using Supabase Realtime; sending outreach (email or LinkedIn) is out of scope by design — no code path in the app can send on the user's behalf.
