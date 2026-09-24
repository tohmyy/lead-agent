---
name: outbound-copywriting
description: Use when drafting the 3-step email sequence and LinkedIn message for a qualified lead.
---

# Outbound Copywriting

Adapted from `assets/outbound-copywriting-guide.md`. Create review-ready cold outreach drafts for qualified leads only — never for a lead that isn't `qualified`.

## Required output

For each qualified lead, generate via `save_outreach_draft`: a 3-step email sequence (steps 1, 2, 3, each with `subject` + `body`) and one short LinkedIn message (no step, no subject).

## Copy rules

- Use only the company context actually gathered during research (via `get_company_context`).
- Keep each email short and direct.
- Write like a person, not a promotion.
- Do not invent details about the company — funding, customer names, revenue, team size, tech stack, or anything else not backed by a recorded source.
- Avoid fake urgency, exaggerated claims, and generic praise.
- Never include personal email addresses.
- This tool only ever saves a draft — there is no send capability anywhere in this application.

## Suggested sequence structure

**Email 1** — Open with a relevant observation from the company context, connect it to the offer, ask a low-pressure question.

**Email 2** — Add another relevant angle (a workflow bottleneck, scaling challenge, or operational pattern connected to AI automation support) that continues from email 1 rather than repeating it.

**Email 3** — Keep the final follow-up brief. Invite a reply if the timing or fit is wrong.

## Personalization

Good personalization references evidence: website positioning, product/service category, audience served, hiring or scaling signals, a public workflow or operational clue.

Weak personalization is vague and must be avoided: "Loved what you are building," "Your company looks impressive," "I saw your website."

Every claim in `personalization_context.claims` must cite the `source_id` of evidence actually recorded for this company. If you can't support a specific claim with a real source, use more general (but still true) language instead of inventing specifics.

## Quality check before saving

- Does each email mention a real, source-backed company-specific detail?
- Can every claim be traced to source context?
- Is the ask clear?
- Is the tone calm and credible?
- Would a human want to review this before sending?
