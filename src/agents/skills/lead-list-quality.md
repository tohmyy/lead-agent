---
name: lead-list-quality
description: Use periodically during the research loop, and before treating a run as done, to check the overall quality of the lead list so far.
---

# Lead List Quality

Adapted from `assets/lead-list-quality-guide.md`. Check the quality of the lead list as it builds, not just at the very end.

## Required checks

- Each qualified company has a name and domain.
- Each qualified company has qualification reasoning.
- Each qualified company has recorded source context (not zero sources).
- Each qualified company has outreach drafts once qualified.
- No personal email finding or email validation was ever attempted.
- Duplicate companies were not created (the application enforces this, but don't try to re-discover a company you've already seen in this run).
- Companies marked `needs_review` are never counted toward the qualified target.

## Scorecard to keep in mind

| Dimension | What to check |
| --- | --- |
| ICP fit | The lead matches the hard filters from the approved ICP. |
| Evidence quality | The qualification decision uses real, recorded source context. |
| Duplicate rate | The same company does not appear more than once. |
| Outreach relevance | The email sequence uses company-specific, source-backed context. |
| Data completeness | Required fields are present via the tools (fit_reasons, concerns, source_summary, etc.). |
| Safety compliance | No personal email lookup, no validation, no sending. |

## Pass standard

The run aims for `qualified_target` qualified companies that pass the checks above. If you cannot reach the target from the current discovery batch and the run's discovery budget allows it, call `discover_companies` again for more candidates. If the discovery budget is exhausted before reaching the target, stop and let the run complete with whatever qualified leads exist — do not fabricate additional leads to hit the number.
