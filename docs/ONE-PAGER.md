# Oluwatofunmi Adeyinka
# Lead Research & Outreach Agent

## 1. Purpose & Problem

Koya Talent grows by outbound to founders, ops leads, and agency owners who may need AI automation assistants. Today that work is manual: define the persona, hunt for companies, read websites, decide fit, then write cold outreach from scratch. Throughput is low, quality varies, and evidence for “why this company” is often lost. The core business problem is **qualified list volume with consistent judgment**—reaching a target number of good companies while keeping hard filters honest, personalization source-backed, and a human in the loop before anything leaves the building. This agent automates ICP refinement, company discovery, website research, qualification, and outreach drafting while enforcing discovery limits and a strict human approval gate before any copy is treated as ready to use.

## 2. What Success Looks Like

- **Objective-to-List:** An operator submits a plain-language qualification objective and receives a reviewable set of qualified companies (target: 10) with confidence, fit reasons, and concerns.
- **Traceable Evidence:** Reviewers can open each lead, inspect hard-filter verdicts and supporting source URLs, and trust that claims are grounded in recorded research—not invented context.
- **Review-Ready Outreach:** Every qualified lead gets a 3-step email sequence and one LinkedIn message, personalized only from sources the agent actually recorded.
- **Fail-Safe Delivery:** Zero emails or LinkedIn messages are sent by the system; export and human send remain the only path out. Spend and tool failures are visible in the run UI.

## 3. Architecture & Tech Stack

- **Next.js:** UI, auth, run intake, ICP approval, live run workspace, review, and export.
- **Claude Agent SDK:** Agent runtime; the model selects tools; the application validates inputs, enforces limits, and logs every call.
- **Supabase (Postgres + Auth + RLS):** Shared state for runs, ICPs, companies, leads, sources, tool calls, run events, and outreach drafts.
- **Apify:** Company discovery only, with a hard per-run result ceiling.
- **Firecrawl:** Website research for qualification evidence.
- **Model:** Claude Sonnet (ICP, research/qualify loop, outreach) guided by project skills (ICP refinement, qualification, list quality, copywriting, outreach safety).

## 4. End-to-End Pipeline

1. **Intake:** Operator enters a free-text objective, qualified-lead target, and discovery maximum.
2. **ICP:** Agent drafts structured criteria (hard filters, soft signals, personas, geography/industry include/exclude). Human approves, edits, or regenerates—**no paid discovery before approval**.
3. **Discover:** Apify returns candidate companies up to the discovery maximum (application-enforced; agent cannot raise it).
4. **Research & Qualify:** Firecrawl scrapes public pages; agent records sources, then saves a qualification decision. Hard-filter failures cannot be marked qualified; scraped text is untrusted data, never instructions.
5. **Outreach:** Agent drafts email steps 1–3 and a LinkedIn message per qualified lead; personalization claims must cite recorded `source_id`s.
6. **Review & Export:** Human reviews leads and copy (edit, note, approve for export), then exports CSV / outreach pack for use outside the app.

## 5. Appendix: Assumptions & Limitations

**Assumptions:** Runs start from an explicit operator objective; ICP approval is required before discovery; “qualified” means evidence-backed fit against the approved ICP, not predicted reply rate; export-ready does not mean sent.

**Limitations:**  
(i) Discovery and research consume Apify/Firecrawl/Anthropic budget; thin or unreachable websites yield thinner evidence and more `needs_review` / not-qualified outcomes.  
(ii) The agent does not find personal emails, validate addresses, scrape LinkedIn profiles, or send outreach—by design. Failed discovery is not auto-retried; the operator investigates and starts a new run (or continues only where the product explicitly allows).
