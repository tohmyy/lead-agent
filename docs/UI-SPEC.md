Below is the complete first artifact. I’m treating the decisions as **v0.1 Agile baseline** so later changes can be incorporated without rewriting the project direction from scratch.

# `UI-SPEC.md`

````md
# AI Lead Research & Outreach Agent — UI Specification

**Version:** 0.1  
**Status:** Baseline / Agile  
**Project:** Koya Talent — Week 5  
**Application:** AI Lead Research and Outreach Agent

---

## 1. Purpose

The AI Lead Research and Outreach Agent is a web application that allows a user to define a lead qualification objective and have an AI agent:

1. Refine the objective into explicit ICP criteria.
2. Discover potential companies.
3. Research company websites.
4. Qualify companies against the refined ICP.
5. Store research and qualification evidence.
6. Generate review-ready outbound messaging.
7. Present the results for human review.
8. Export the qualified lead list and outreach material.

The application does **not**:

- Find personal email addresses.
- Validate email addresses.
- Send emails.
- Send LinkedIn messages.
- Automatically contact prospects.
- Allow scraped website content to control agent behavior.
- Allow the agent to override user-defined or system-enforced limits.

The UI should make the agent's work sufficiently visible that a human can understand:

- What the user asked for.
- How the ICP was refined.
- What companies were discovered.
- What research was performed.
- Why a company qualified or failed.
- What sources support the qualification.
- How the outreach copy was generated.

---

# 2. Product Principles

## 2.1 Human-in-the-loop

The agent performs research and reasoning, but the user remains responsible for approving:

- The refined ICP.
- Qualified leads.
- Outreach copy.
- Any eventual external outreach.

The application should never imply that AI-generated qualification or copy is automatically correct.

---

## 2.2 Evidence over unsupported claims

Every qualification decision should be traceable to source context.

Lead details should distinguish between:

- Facts found in sources.
- Agent interpretation.
- Qualification reasoning.
- Outreach personalization.

The UI should make source-backed reasoning visible.

---

## 2.3 Agent transparency

The user should be able to see meaningful agent activity without being forced to inspect raw technical logs.

Default:

> Human-readable activity feed.

Expandable:

> Detailed tool-call information.

---

## 2.4 Safety by design

Website content is untrusted research input.

Scraped content must never be presented to the user as agent instructions.

The UI should not expose:

- API keys.
- Internal prompts.
- Secrets.
- Hidden system instructions.
- Sensitive tool credentials.

---

## 2.5 Cost awareness

Apify is a shared paid resource.

The application must make run limits explicit and visible.

The agent must not determine its own unrestricted discovery budget.

---

# 3. Primary User

## Content / Growth / Sales Operator

The primary user is someone at Koya Talent who wants to create a qualified outbound lead list.

Typical workflow:

> Define target → Review ICP → Research → Review leads → Review outreach → Export

The user does not need to understand:

- Claude Agent SDK internals.
- Apify actor implementation.
- Firecrawl implementation.
- Supabase internals.

The UI should expose business-level concepts rather than infrastructure details by default.

---

# 4. Core User Journey

```text
Dashboard
    │
    ▼
Create Research Run
    │
    ▼
Enter Qualification Objective
    │
    ▼
Agent Refines ICP
    │
    ▼
Human Reviews ICP
    │
    ├─────────────── Edit ──────────────┐
    │                                  │
    ▼                                  │
Approve & Search ◄────────────────────┘
    │
    ▼
Company Discovery
    │
    ▼
Website Research
    │
    ▼
Lead Qualification
    │
    ├── Qualified
    │
    └── Not Qualified
    │
    ▼
Outreach Generation
    │
    ▼
Review Qualified Leads
    │
    ▼
Review Outreach
    │
    ▼
Export
````

---

# 5. Application Information Architecture

```text
Application
│
├── Dashboard
│   ├── Recent Runs
│   ├── Run Status
│   └── Create Run
│
├── New Research Run
│   └── Qualification Objective
│
├── Research Run
│   ├── Overview
│   ├── ICP
│   ├── Activity
│   ├── Leads
│   └── Outreach
│
└── Settings
    └── Application configuration
```

The initial implementation should keep navigation simple.

No separate CRM, campaign management, email sending, or contact management module is required.

---

# 6. Dashboard

## Purpose

The dashboard is the application's entry point.

It should answer:

* What research runs exist?
* What is currently running?
* How many qualified leads were produced?
* What runs need review?
* How do I start a new run?

---

## 6.1 Dashboard Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Koya Lead Research                         + New Research   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Recent Research                                             │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ US B2B SaaS — AI Automation                             │ │
│ │ 10 qualified · Completed                                │ │
│ │ Sep 23, 2026                                             │ │
│ │                                          [Open Run]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ US Agencies — Operations Automation                      │ │
│ │ Researching · 6/10 qualified                            │ │
│ │ Running for 02:14                                       │ │
│ │                                          [Open Run]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6.2 Run Statuses

A run may have:

* `draft`
* `awaiting_icp_approval`
* `researching`
* `generating_outreach`
* `awaiting_review`
* `completed`
* `failed`
* `cancelled`

Status should be visually obvious but not dependent on color alone.

Example:

```text
● Awaiting review
● Researching
✓ Completed
! Failed
```

Use icons and text alongside visual status indicators.

---

# 7. Create Research Run

## 7.1 Qualification Objective

The primary input should be a large text field.

Example:

```text
Find 10 US B2B SaaS companies with 10 to 100 employees
that may need AI automation support.
```

Supporting UI:

```text
Qualification objective

┌─────────────────────────────────────────────────────────────┐
│ Find 10 US B2B SaaS companies with 10 to 100 employees     │
│ that may need AI automation support.                        │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Example:
"Find 10 US B2B SaaS companies with 10–100 employees
that may need AI automation support."

                           [Create Research Run]
```

---

## 7.2 Objective Requirements

The user should be able to express naturally:

* Number of desired qualified leads.
* Geography.
* Industry.
* Company size.
* Business model.
* Target persona.
* Business signals.
* Qualification requirements.
* Other campaign-specific constraints.

The UI should not force the user to fill every field.

The agent is responsible for refining natural-language objectives.

---

# 8. ICP Refinement Screen

After the initial objective is submitted, the application enters:

```text
Awaiting ICP approval
```

The agent produces structured ICP criteria.

---

## 8.1 ICP Screen

```text
┌─────────────────────────────────────────────────────────────┐
│ Review Research Criteria                                    │
│                                                             │
│ Original objective                                          │
│ "Find 10 US B2B SaaS companies..."                          │
│                                                             │
│ Refined ICP                                                 │
│                                                             │
│ Geography                                                   │
│ United States                                               │
│                                                             │
│ Industry                                                    │
│ B2B SaaS                                                    │
│                                                             │
│ Employee range                                              │
│ 10–100                                                      │
│                                                             │
│ Target company type                                         │
│ Early-stage / growing SaaS companies                       │
│                                                             │
│ Relevant signals                                            │
│ • Repetitive operational workflows                          │
│ • Growing operations complexity                             │
│ • Evidence of manual processes                             │
│                                                             │
│ Qualification requirements                                  │
│ • Must be a B2B company                                     │
│ • Must operate primarily in the US                          │
│ • Must fall within employee range                           │
│                                                             │
│ [Edit Criteria]                     [Approve & Start Search] │
└─────────────────────────────────────────────────────────────┘
```

---

## 8.2 Hard vs Soft Criteria

The UI should distinguish:

### Hard filters

Must be satisfied.

Example:

```text
Geography: United States
Employees: 10–100
Business model: B2B SaaS
```

### Soft signals

Used to determine likely fit.

Example:

```text
Operational complexity
Manual workflows
Growth signals
Automation opportunities
```

This distinction is important because a company failing a hard filter should not be qualified merely because it has strong soft signals.

---

## 8.3 Editing ICP

The user should be able to edit the refined criteria before approval.

Possible editable fields:

* Geography
* Industry
* Company size
* Business model
* Target personas
* Required characteristics
* Exclusion criteria
* Qualification signals

The user should not directly modify system-enforced:

* Apify budget controls.
* Maximum discovery limit.
* Security constraints.
* Tool permissions.

---

# 9. Research Run Workspace

Once the ICP is approved, the main workspace becomes available.

Recommended layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Runs    US B2B SaaS Research                  ● Researching │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Overview | ICP | Activity | Leads | Outreach                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Main workspace                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The run should remain the primary object throughout the workflow.

---

# 10. Run Overview

The Overview tab should summarize the run.

Example:

```text
US B2B SaaS Research

Status
Researching

Qualified leads
6 / 10

Companies discovered
14

Companies researched
11

Companies qualified
6

Companies rejected
5

Current activity
Researching company #12

Started
Sep 23, 2026 · 3:14 PM
```

---

# 11. Run Limits

The run workspace should expose the enforced discovery limit.

Example:

```text
Research limits

Qualified target       10
Discovery maximum      20
Companies discovered   14 / 20

Apify usage
Tracked by run
```

The discovery maximum should be established when the run is created.

The agent cannot increase it.

If the maximum is reached:

```text
Discovery limit reached

The agent reviewed the maximum number of companies
allowed for this run.

8 qualified leads were found.

[Complete Run] [Review Leads]
```

---

# 12. Activity Feed

The activity feed is the default transparency mechanism.

Example:

```text
Research Activity

✓ ICP refined
  3:14:02 PM

✓ ICP approved
  3:14:31 PM

✓ Company discovery started
  3:14:32 PM

✓ 10 companies discovered
  3:14:38 PM

✓ Researching Acme
  3:14:40 PM

✓ Acme qualified — 91% confidence
  3:14:46 PM

✓ Researching Beta
  3:14:48 PM

◉ Researching Gamma
  3:14:52 PM
```

---

## 12.1 Activity Categories

Activity events should include:

* ICP refinement
* ICP approval
* Company discovery
* Website scraping
* Lead qualification
* Outreach generation
* Lead rejection
* Run completion
* Run failure

---

# 13. Expandable Tool Inspector

Each activity event may be expanded.

Example:

```text
✓ Firecrawl — Website research

Purpose
Research company website for qualification evidence.

Input
URL: https://example.com

Result
Status: success
Pages researched: 4
Source URLs: 4

Duration
3.2 seconds

[View source context]
```

The default view should remain human-readable.

Technical details should be progressive disclosure.

---

## 13.1 Tool Inspector Security

Never display:

* API keys
* Authentication headers
* Access tokens
* Secrets
* Full internal prompts
* Sensitive environment variables

Inputs and outputs should be summarized where necessary.

---

# 14. Leads Tab

The Leads tab uses a **table-first layout with a detail drawer**.

Example:

```text
Qualified Leads

10 qualified

┌─────────────────────────────────────────────────────────────┐
│ Company       Status       Confidence    Industry     →     │
├─────────────────────────────────────────────────────────────┤
│ Acme Inc.     Qualified    91%            SaaS         →   │
│ Beta Labs     Qualified    87%            SaaS         →   │
│ Gamma Corp.   Qualified    84%            SaaS         →   │
└─────────────────────────────────────────────────────────────┘
```

---

# 15. Lead Table

Initial columns:

* Company
* Qualification status
* Confidence
* Industry
* Employee range
* Domain
* Review state

Optional columns can be toggled.

The table should not attempt to display every field stored in Supabase.

---

# 16. Lead Detail Drawer

Clicking a lead opens a right-side drawer.

```text
┌──────────────────────────────────────────────┐
│ Acme Inc.                              ×     │
│ acme.com                                     │
├──────────────────────────────────────────────┤
│                                              │
│ Qualified                                   │
│ 91% confidence                              │
│                                              │
│ Company                                      │
│ B2B SaaS                                     │
│ 45 employees                                 │
│ United States                                │
│                                              │
│ Why it fits                                 │
│ • Matches company-size criteria              │
│ • B2B SaaS business model                    │
│ • Evidence of operational complexity         │
│                                              │
│ Concerns                                    │
│ • Employee count source is approximate       │
│                                              │
│ Source context                               │
│ Company website indicates...                 │
│                                              │
│ Sources                                      │
│ [Website] [Additional source]               │
│                                              │
│ Outreach                                     │
│ [View Outreach]                              │
└──────────────────────────────────────────────┘
```

---

# 17. Qualification Confidence

Every qualified lead must display a confidence score.

Example:

```text
91% confidence
```

The score should also have an expandable breakdown.

```text
Confidence breakdown

Overall                         91%

ICP match                      95%
Company evidence               88%
Source quality                 92%
Qualification consistency      90%
```

The exact scoring methodology is an agent/business-rule concern and will be defined outside the UI specification.

The UI should not imply mathematical certainty.

---

# 18. Qualification Evidence

The lead detail view should contain:

### Fit reasons

Evidence explaining why the company fits.

### Concerns

Potential reasons to review or question the qualification.

### Source summary

Short summary of relevant source material.

### Source URLs

Clickable source references.

### Qualification reasoning

The agent's structured explanation of how the company was evaluated.

---

# 19. Rejected Leads

Rejected/non-qualified companies should be stored but hidden from the main qualified-lead view.

The UI may provide:

```text
Reviewed companies (7)
```

or:

```text
Show reviewed / not qualified
```

When enabled:

```text
Company       Status             Reason
Delta Inc.    Not qualified      Outside employee range
Echo Labs     Not qualified      B2C business model
Foxtrot       Needs review       Insufficient evidence
```

Rejected leads should not be mixed into the qualified lead list.

---

# 20. Outreach Tab

The Outreach tab focuses only on qualified leads.

Example:

```text
Outreach

10 qualified leads

┌─────────────────────────────────────────────────────────────┐
│ Acme Inc.        Ready for review                           │
│ Beta Labs        Ready for review                           │
│ Gamma Corp.      Ready for review                           │
└─────────────────────────────────────────────────────────────┘
```

Selecting a lead opens the outreach workspace.

---

# 21. Outreach Workspace

Use tabs for each channel/step:

```text
┌─────────────────────────────────────────────────────────────┐
│ Acme Inc.                                                   │
│                                                             │
│ Email 1       Email 2       Email 3       LinkedIn          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Subject: Reduce manual ops work at Acme                    │
│                                                             │
│ Hi {{first name}},                                          │
│                                                             │
│ ...                                                         │
│                                                             │
│ [Edit draft]                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The initial system generates drafts.

The user can edit the drafts before export.

No send functionality is included.

---

# 22. Email Sequence

Each qualified lead receives:

### Email 1

Initial personalized outreach.

### Email 2

Follow-up based on the original context.

### Email 3

Final follow-up.

The sequence should preserve continuity rather than generate three unrelated emails.

---

# 23. LinkedIn Message

The outreach workspace includes a separate LinkedIn tab.

Example:

```text
LinkedIn

┌─────────────────────────────────────────────────────────────┐
│                                                               │
│ Hi there — noticed Acme is growing its operations around... │
│                                                               │
│ We've been helping teams automate repetitive workflows...    │
│                                                               │
│ Would be open to connecting?                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

The system must not claim that a personal LinkedIn profile was researched unless that information was actually obtained from an approved source.

---

# 24. Personalization Safety

The UI should make it possible to inspect the context behind personalization.

Example:

```text
Personalization source

"Acme's website describes its customer onboarding
workflow and growing operations team."

Source:
acme.com/about
```

If an outreach claim has no supporting source context, it should not be generated.

---

# 25. Outreach Review State

Each lead can have:

* `not_reviewed`
* `reviewed`
* `edited`
* `approved_for_export`

These states refer to human review only.

They do not mean the message has been sent.

---

# 26. Export

The run should support:

### Qualified lead CSV

Contains structured qualified lead information.

Suggested fields:

```text
company_name
domain
qualification_status
confidence_score
fit_reasons
concerns
source_urls
source_summary
```

---

### Outreach sample pack

A human-readable package containing:

```text
Qualification objective

Refined ICP

Company

Source context

Qualification reasoning

Email 1
Email 2
Email 3

LinkedIn message
```

The exact output format can be decided during implementation.

---

# 27. Empty States

## No research runs

```text
No research runs yet.

Create a qualification objective and let the
agent research your first lead list.

[Create Research Run]
```

---

## No qualified leads yet

During research:

```text
No qualified leads yet.

The agent is still researching companies.
```

After completion:

```text
No companies matched the qualification criteria.

Review the research activity or refine the ICP
and start another run.
```

---

# 28. Loading States

The UI should use meaningful progress states rather than generic spinners.

Bad:

```text
Loading...
```

Preferred:

```text
Researching company 7 of 14

Scraping website and evaluating qualification signals...
```

For ICP refinement:

```text
Analyzing qualification objective...

Identifying geography, company size, industry,
and qualification signals.
```

---

# 29. Error States

Errors should be understandable to a business user.

### Tool failure

```text
Website research failed

The company website could not be researched.

The agent will record the failure and continue
where possible.

[View details]
```

### Apify failure

```text
Company discovery failed

The discovery service did not complete successfully.

No additional discovery run was started automatically.

[View error]
```

This is important because the PRD explicitly requires stopping and investigating abnormal Apify behavior rather than blindly retrying.

---

# 30. Run Failure

If the run cannot continue:

```text
Research run failed

The agent could not complete this research run.

Completed:
8 companies researched
5 qualified leads

No automatic retry was started.

[Review Results]
```

Existing records should remain available.

---

# 31. Partial Completion

The application should preserve useful work if the run stops early.

Example:

```text
Research stopped

The run ended before reaching the target of 10 qualified leads.

Qualified: 7
Reviewed: 14
Discovery limit: 20

[Review Leads]
[Export Results]
```

---

# 32. Responsive Behavior

The application should support:

* Desktop
* Tablet
* Smaller laptop screens

The primary target is desktop because research workflows require:

* Tables.
* Side drawers.
* Activity feeds.
* Multiple information areas.

---

## 32.1 Desktop

Use the full layout:

```text
Navigation
    +
Main workspace
    +
Optional detail drawer
```

---

## 32.2 Tablet

Collapse navigation.

Lead drawer becomes a larger overlay.

---

## 32.3 Mobile

Mobile is not the primary research experience.

At minimum:

* Objective entry should work.
* Run status should be visible.
* Lead cards/details should remain accessible.
* Tables can become stacked cards.

Complex tool inspection can be simplified.

---

# 33. Accessibility

The application should follow WCAG-oriented practices.

Requirements:

* Keyboard navigable controls.
* Visible focus states.
* Semantic buttons and links.
* Accessible form labels.
* Status updates announced where appropriate.
* Do not rely on color alone for qualification status.
* Adequate text contrast.
* Drawer can be opened and closed via keyboard.
* Tabs use accessible tab semantics.
* Tables have appropriate headers.

---

# 34. Visual Design Direction

The visual direction is:

> Modern SaaS + subtle AI-agent console.

The application should feel like a professional B2B research platform rather than a developer debugging interface.

Characteristics:

* Spacious layout.
* Clear hierarchy.
* Neutral base palette.
* Restrained use of accent color.
* Compact but readable data presentation.
* Rounded cards where appropriate.
* Minimal visual noise.
* Strong typography.
* Subtle activity indicators.
* Consistent status treatments.

Avoid:

* Excessive gradients.
* "AI magic" animations.
* Chatbot-first layouts.
* Excessive neon colors.
* Developer-console aesthetics.
* Dense terminal-like interfaces.

---

# 35. Design Tokens

## 35.1 Typography

Use a modern sans-serif typeface.

Suggested hierarchy:

```text
Display / Page title
32px / 40px

Section heading
20px / 28px

Card heading
16px / 24px

Body
14px / 20px

Secondary text
13px / 18px

Metadata
12px / 16px
```

Typography should prioritize readability over visual novelty.

---

## 35.2 Spacing

Use a consistent spacing scale.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Default page spacing:

```text
Desktop horizontal padding: 32px
Section gap: 32px
Card padding: 20–24px
Table cell padding: 12–16px
```

---

## 35.3 Radius

Suggested:

```text
Small controls: 6px
Inputs: 8px
Cards: 10–12px
Drawers: 12px
Large containers: 16px
```

Avoid excessive pill-shaped UI except for statuses/tags.

---

# 36. Color Semantics

Color should communicate meaning consistently.

Semantic categories:

```text
Neutral
Information
Success
Warning
Error
Accent
```

Qualification status:

```text
Qualified     → Success semantic
Needs review  → Warning semantic
Not qualified → Neutral/error semantic depending on context
Running       → Information semantic
Failed        → Error semantic
```

The exact color values will be defined in the implementation design-token system.

---

# 37. Tailwind Mapping

The UI should use semantic tokens rather than hardcoding colors throughout components.

Conceptual mapping:

```text
background
foreground
muted
muted-foreground

primary
primary-foreground

secondary
secondary-foreground

border
input
ring

success
warning
destructive
info

card
card-foreground
popover
popover-foreground
```

Components should consume semantic tokens.

Example:

```text
bg-background
text-foreground
text-muted-foreground
border-border
bg-card
text-success
text-warning
text-destructive
```

The exact Tailwind configuration will be finalized in the architecture/build phase.

---

# 38. Core Components

The initial component system should include:

## Navigation

* `AppShell`
* `Sidebar`
* `TopBar`

## Run management

* `RunList`
* `RunCard`
* `RunStatus`
* `RunProgress`

## Objective

* `ObjectiveForm`
* `ObjectiveEditor`

## ICP

* `ICPReview`
* `ICPSection`
* `ICPField`
* `CriteriaBadge`
* `HardFilter`
* `SoftSignal`

## Activity

* `ActivityFeed`
* `ActivityItem`
* `ToolCallInspector`

## Leads

* `LeadTable`
* `LeadRow`
* `LeadDetailDrawer`
* `LeadStatus`
* `ConfidenceScore`
* `ConfidenceBreakdown`
* `QualificationEvidence`
* `SourceList`

## Outreach

* `OutreachWorkspace`
* `OutreachTabs`
* `EmailPreview`
* `LinkedInPreview`
* `OutreachEditor`
* `ReviewStatus`

## Export

* `ExportMenu`
* `ExportDialog`

---

# 39. Important UI States

Every major component should account for:

```text
Default
Loading
Empty
Success
Error
Disabled
Partial
```

Research-specific states:

```text
Awaiting ICP approval
Researching
Generating outreach
Awaiting review
Completed
Failed
Cancelled
```

---

# 40. Agent/User Boundary

The UI must clearly distinguish actions performed by the agent from actions performed by the user.

Example:

```text
Agent
✓ Refined ICP
✓ Discovered 14 companies
✓ Researched Acme
✓ Qualified Acme

User
✓ Approved ICP
✓ Edited outreach draft
```

This distinction is especially useful for debugging and Loom demonstrations.

---

# 41. No Autonomous Outreach

The application must not contain:

* Send email button.
* Send LinkedIn button.
* Auto-send toggle.
* Outreach automation scheduler.
* Contact enrichment workflow.
* Personal email finder.

Allowed:

```text
Review
Edit
Approve for export
Export
Copy
```

---

# 42. Source Handling

Source URLs should be displayed as references.

Example:

```text
Sources

Company website
https://example.com/

About
https://example.com/about

Operations
https://example.com/operations
```

Where possible, the UI should show:

* Source title.
* Domain.
* Relevant source summary.

The system should not dump entire scraped pages into the main lead view.

---

# 43. Untrusted Website Content

Website content should be visually treated as evidence.

Example:

```text
Source context

The company website states that the company provides
automated onboarding workflows...

Source: example.com/product
```

Do not present scraped text as:

```text
SYSTEM INSTRUCTION
...
```

or otherwise allow it to appear as trusted application instructions.

---

# 44. Tool Call Visibility

The activity feed should map business activity to technical tools where useful.

Example:

```text
Company discovery
└── Apify

Website research
└── Firecrawl

Qualification
└── Claude Agent

Database persistence
└── Supabase
```

The exact tool implementation is defined in `TOOL-CONTRACTS.md`.

---

# 45. Cost/Limit UI

Because Apify is shared and paid, discovery limits should always be visible.

Example:

```text
Discovery budget

Maximum companies: 20
Used: 14

The agent cannot discover more than this limit.
```

The UI should not expose internal account credentials or billing secrets.

---

# 46. Confirmation Dialogs

Confirmation is required for:

### Starting research

Show:

```text
Start research?

Target qualified leads: 10
Maximum companies to discover: 20

Once started, the agent will use the configured
research tools within these limits.

[Cancel] [Start Research]
```

### Export

No destructive confirmation is necessary.

### Cancelling research

Show:

```text
Stop research?

Current progress will be preserved, but the agent
will not continue researching additional companies.

[Keep Running] [Stop Research]
```

---

# 47. Navigation During Active Runs

Users should be able to leave an active run.

The run continues independently of the current page.

Returning to the run should restore the current state from persisted data.

The browser should not be the source of truth for agent execution.

---

# 48. Real-Time Updates

The UI should update while research is running.

Examples:

```text
14 companies discovered
15 companies discovered
```

and:

```text
Acme → Qualified
Beta → Not qualified
Gamma → Researching
```

The exact real-time mechanism will be determined in the architecture phase.

Supabase is the expected persistence layer.

---

# 49. Run Completion

When the run finishes:

```text
Research complete

10 qualified leads found.

Companies reviewed: 17
Qualified: 10
Not qualified: 7

Outreach drafts generated: 10

[Review Leads]
[Review Outreach]
[Export]
```

---

# 50. Review Completion

The system should make human review progress visible.

Example:

```text
Lead review

7 / 10 reviewed
```

and:

```text
Outreach review

4 / 10 reviewed
```

Completion does not mean sending outreach.

---

# 51. Demo / Loom-Friendly UX

The workflow should be easy to demonstrate sequentially:

```text
1. Create run
2. Enter objective
3. Show AI-refined ICP
4. Approve ICP
5. Show activity feed
6. Show Apify discovery
7. Show website research
8. Show qualification
9. Open qualified lead
10. Show evidence
11. Show outreach
12. Show tool logs
13. Show Supabase-backed state
14. Export results
```

Important information should not require navigating through many unrelated pages.

---

# 52. MVP Scope

The MVP UI includes:

* Dashboard
* Create research run
* Objective input
* ICP refinement review
* ICP approval/editing
* Research workspace
* Activity feed
* Tool-call inspector
* Lead table
* Lead detail drawer
* Qualification evidence
* Confidence score
* Outreach workspace
* Email sequence
* LinkedIn message
* Human review states
* Export
* Run status
* Error/partial completion states

---

# 53. Explicitly Out of Scope

The following should not be implemented in the MVP:

* Email sending
* LinkedIn automation
* Personal email discovery
* Email validation
* CRM synchronization
* Campaign scheduling
* Automated follow-up execution
* Contact enrichment
* Lead scoring unrelated to the defined qualification process
* Analytics dashboard
* Conversion tracking
* Reply tracking
* Automated outreach

These may be considered future product extensions.

---

# 54. Future Considerations

Potential future features:

* Saved ICP templates
* Campaign management
* Multiple research sources
* CRM integrations
* Outreach performance analytics
* Lead enrichment
* Team collaboration
* Approval workflows
* Scheduled research
* Historical lead deduplication across runs

These should remain outside the MVP unless later Agile decisions change the scope.

---

# 55. Initial Product Decisions

| Decision                     | Baseline                                  |
| ---------------------------- | ----------------------------------------- |
| Application structure        | Dashboard + dedicated run workspace       |
| ICP approval                 | Human checkpoint                          |
| Agent visibility             | Activity feed + expandable tool inspector |
| Lead review                  | Table + detail drawer                     |
| Confidence                   | Numeric + expandable breakdown            |
| Outreach                     | Tabbed workspace + realistic previews     |
| Insufficient qualified leads | Continue within hard discovery limit      |
| Rejected leads               | Stored, hidden by default                 |
| Export                       | CSV + outreach pack                       |
| Visual direction             | Modern SaaS + AI-agent hybrid             |
| Primary platform             | Desktop                                   |
| Outreach execution           | Not supported                             |
| Website content              | Untrusted evidence only                   |
| Agent limits                 | Enforced outside agent discretion         |

---

# 56. Agile Change Policy

This document is the current UI baseline, not a frozen specification.

When a product decision changes:

1. Update this document.
2. Identify affected downstream documents.
3. Update architecture if required.
4. Update data model if required.
5. Update tool contracts if required.
6. Update tests and acceptance criteria.
7. Record the decision in the appropriate project decision log.

A UI change should not silently create inconsistencies in backend contracts or tests.

---

# 57. Definition of UI Complete

The UI specification is considered implemented when a user can:

1. Create a research run.
2. Enter a natural-language qualification objective.
3. View the agent-refined ICP.
4. Edit and approve the ICP.
5. Monitor research progress.
6. View agent activity.
7. Inspect tool-call summaries.
8. View qualified leads.
9. Open lead details.
10. Understand why a lead qualified.
11. Inspect source context.
12. View qualification confidence.
13. Review generated email sequences.
14. Review LinkedIn copy.
15. Edit outreach drafts.
16. Track human review state.
17. View partial/failed runs.
18. Export qualified leads.
19. Export an outreach sample pack.
20. Never accidentally send outreach from the application.

---
