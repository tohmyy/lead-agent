---
name: icp-refinement
description: Use when turning a user's lead-qualification objective into concrete ICP criteria, before any discovery or scraping tool calls.
---

# ICP Refinement

Adapted from `assets/icp-refinement-guide.md`. Turn a vague qualification objective into concrete ICP criteria before spending any tool calls on discovery or scraping.

## Goal

Understand who counts as a good-fit company before searching or scraping.

## Minimum criteria to clarify

- Target company type
- Industry or niche
- Geography
- Company size or headcount range
- Relevant buyer or operator persona
- Business problem the company may have
- Hard disqualifiers
- Soft preferences

## Hard filters vs. soft signals

Hard filters must be true for a lead to qualify. Examples: country must be United States; company must be B2B; headcount must be between 10 and 100.

Soft signals improve fit but must never automatically disqualify a company. Examples: recently hiring operations roles; uses tools that may connect to automation workflows; publishes content about scaling operations.

## Output

Call the `save_icp` tool with `criteria.hard_filters` (mandatory constraints) and `criteria.soft_signals` (fit evidence) kept separate, plus `geography`, `industry`, `employee_range`, `business_model`, and `target_personas` where the objective specifies them, and a short `reasoning` string explaining your interpretation.

## Rules

- Do not treat every user preference as a hard filter.
- Never invent a value for `geography`, `industry`, `employee_range`, `business_model`, or `target_personas` that the objective doesn't actually state or unambiguously imply. Each of these fields is optional — if the objective doesn't mention company size, leave `employee_range` unset entirely rather than guessing a "typical" range; the same goes for industry, geography, business model, and personas. A human should never see a criterion pre-filled that they never asked for.
- If the objective is too vague to fully specify criteria, still call `save_icp`, but only populate the structured fields above with what the objective text actually grounds. Put your interpretation, open questions, and reasonable possibilities you're uncertain about into `reasoning` (and, where genuinely useful, `soft_signals`) as discussion — never as a value in a structured field, since that renders as an already-selected, already-included criterion for the human reviewer.
- `hard_filters` requires at least one entry even for a vague objective. When nothing concrete was actually specified, prefer a hard filter that restates the one real constraint the objective does give (e.g. the literal business problem or need described) rather than manufacturing a company-size, industry, or geography filter just to satisfy the minimum.
- Preserve specific constraints the user gives; do not soften or drop them.
- Keep the ICP narrow enough to search, but not so narrow that no real company could ever match.
- Calling `save_icp` never starts discovery and never approves the ICP — a human approves it in the application before anything else happens.
