# Loom Demo Script

A recording script for `docs/BUILD-PLAN.md` §61, rewritten against this app's actual UI (routes, tab names, and button labels below are taken directly from the code, not the abstract build-plan list). Aim for 6–10 minutes. Run the Production Smoke Test in `docs/DEPLOYMENT.md` once beforehand so nothing surprises you on camera.

Set up before recording:
- The app running (locally or the deployed URL) and you're logged in.
- A terminal window ready to show `npm run test` passing, if you want to include the testing beat.
- Supabase Table Editor open in another tab, ready to jump to.

## 1. Explain the objective (30s)

Say: what this app does in one sentence — "This is an AI agent that takes a lead-qualification objective, researches real companies, and drafts outreach for the ones that qualify — but a human approves the criteria and reviews every draft before anything goes out; nothing is ever sent automatically."

## 2. Enter the qualification request (30s)

Navigate to `/runs/new`. Fill in the objective textarea (e.g. "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support."), the **Qualified lead target**, and the **Discovery maximum**. Point out the "Company discovery is configured / Website research is configured" line — say that the app checks provider credentials before it lets you start a run. Click **Create Research Run**.

## 3. Show the refined ICP (60s)

You land on `/runs/<id>`. Click the **ICP** tab. Point out the structured criteria the agent derived from the plain-language objective: hard filters, soft signals, target personas, and the reasoning behind them. Say: "No paid discovery has happened yet — this is free, and it's the point where I can catch a misunderstood objective before spending anything."

## 4. Approve the ICP (15s)

Click **Approve & start search**. Say: "This is the human approval gate the build plan requires — research only starts after I click this."

## 5. Show live activity (60s)

Click the **Activity** tab. Narrate the event feed as it fills in ("Discovering companies", "Researching <company>.com", "<company> qualified", etc.). Expand the **Tool call log** panel and point out one entry: tool name, status, duration. Say: "Every tool call the agent makes is logged here — this is the audit trail, separate from the human-readable feed above it."

## 6. Show company discovery (30s)

Click the **Overview** tab. Point at the "Companies discovered (of <discovery maximum>)" stat and say the discovery maximum is enforced server-side, not just a UI hint — the agent literally cannot exceed it.

## 7. Show website research (30s)

Back on the **Activity** tab, find a "researched" event or open the tool-call log entry for `research_website`. Say: "The agent researches each company's public website — homepage, product, about pages — and every claim it makes later has to trace back to a page it actually saw."

## 8. Show qualification (45s)

Click the **Leads** tab. Open a qualified lead. Point out qualification status, confidence score, and say what confidence *does* and *doesn't* mean: "This is confidence in the assessment itself, not a sales-priority score or a prediction that they'll reply."

## 9. Open a qualified lead / show source evidence (45s)

Still in the lead detail view, point out **fit reasons** and **concerns**, each backed by evidence, and the linked source URLs. Say: "Nothing here is a guess — every fit reason and every concern points back to a specific page the agent actually researched."

## 10. Show the outreach sequence (60s)

Click the **Outreach** tab. Show all 3 email steps and the LinkedIn message for the qualified lead. Point out the personalization — say it's derived from the same source evidence, not invented. Point out the review-state control (not_reviewed → reviewed/edited → approved_for_export) and say explicitly: "There's no Send button anywhere in this app. This is as far as it goes — a human decides what actually goes out."

## 11. Show Supabase records (45s)

Switch to the Supabase tab. Show the `runs`, `leads`, `tool_calls`, and `outreach_drafts` tables filtered to this run's id, to demonstrate the full record trail exists independently of the UI.

## 12. Explain safety/cost controls (60s)

Back in the app, on the **Overview** tab, point at "Discovery spend" and "Agent spend." Say: "Apify and Anthropic usage is tracked per run and shown here, and the discovery limit set at run creation is a hard ceiling the agent can't talk its way past — even if scraped website content tried to tell it otherwise, which is treated as untrusted data, never as instructions."

## Close (15s)

One sentence wrap-up: what was demonstrated (the full objective → ICP → discovery → research → qualification → outreach → review pipeline) and that it's ready for review.
