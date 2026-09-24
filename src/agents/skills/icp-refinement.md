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
- If the objective is too vague to search meaningfully, still produce a best-effort ICP with your interpretation explicit in `reasoning` — a human reviews and can edit it before anything paid happens.
- Preserve specific constraints the user gives; do not soften or drop them.
- Keep the ICP narrow enough to search, but not so narrow that no real company could ever match.
- Calling `save_icp` never starts discovery and never approves the ICP — a human approves it in the application before anything else happens.
