# AI Lead Research and Outreach Agent — How It Works

## What it does

You give the agent a lead-qualification objective in plain language — for example, "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support." Claude turns that into structured qualification criteria, then researches real companies against those criteria using their public websites as evidence, and drafts (but never sends) a 3-step email sequence and one LinkedIn message for every company that qualifies.

## How a run moves through the system

1. **You submit an objective**, along with a qualified-lead target (how many good leads you want) and a discovery maximum (how many candidate companies the agent may look at while searching — this is a hard ceiling, not a suggestion).
2. **The agent refines your objective into an ICP** (Ideal Customer Profile) — explicit hard filters (must-haves), soft signals (nice-to-haves), and target personas. This step is free; no paid research has happened yet.
3. **You review and approve the ICP.** This is the one required checkpoint before any paid discovery or research runs. Edit it, ask the agent to regenerate it, or approve it as-is.
4. **The agent discovers candidate companies** (via Apify) up to your discovery maximum, then **researches each one's public website** (via Firecrawl) — homepage, product, about, pricing pages as relevant.
5. **The agent qualifies each company** against your approved ICP, using only what it found during research. Every fit reason and concern is tied to a specific source page; nothing is asserted without evidence. A company that clearly fails one of your hard filters is never marked qualified, even if the agent's own reasoning suggested otherwise — the application enforces this independently.
6. **For every qualified company, the agent drafts outreach** — three emails and one LinkedIn message — personalized only with claims that trace back to real research evidence.
7. **You review everything.** Read the drafts, edit them, mark them reviewed, and approve the ones you want to keep. Export approved leads and outreach as CSV/Markdown.

## What you control

- The objective, the qualified-lead target, and the discovery maximum, all set when you create a run.
- Whether the ICP is right — you approve, edit, or ask for a new one before anything is spent.
- What happens to every generated draft — review, edit, approve, or ignore it.

## What it deliberately does not do

- It never sends an email or a LinkedIn message. There is no "Send" button anywhere in the app — outreach is prepared for you to send yourself through whatever channel you choose.
- It never exceeds the discovery maximum you set, no matter what it finds while researching (including anything a scraped website might say — page content is always treated as data to evaluate, never as an instruction to follow).
- It doesn't look up personal emails, verify addresses, scrape LinkedIn profiles, or integrate with a CRM.
- It doesn't invent facts. If the evidence doesn't support a claim, the claim is left out rather than guessed.

## Where to see what happened

Every run has an **Overview** (progress and spend), **ICP**, **Activity** (a live feed of what the agent did, plus a technical tool-call log), **Leads**, and **Outreach** tab. Every discovered company, researched source, qualification decision, and outreach draft is stored and auditable — nothing lives only in the agent's head.
