## Phase 3 — Data Model

This phase turns the UI and architecture into a concrete Supabase/PostgreSQL model. I've kept the schema flexible where the agent needs flexibility, while keeping important business rules relational and enforceable.

````md id="58321"
# DATA-MODEL.md

**Version:** 0.1  
**Status:** Baseline / Agile  
**Project:** Koya Talent — Week 5  
**Application:** AI Lead Research & Outreach Agent

---

# 1. Purpose

This document defines the persistent data model for the AI Lead Research and Outreach Agent.

The database must support:

- Research runs.
- Original qualification objectives.
- Refined ICP criteria.
- ICP approval.
- Company discovery.
- Company research.
- Lead qualification.
- Qualification evidence.
- Source URLs and summaries.
- Qualification confidence.
- Qualification concerns.
- Tool-call logging.
- Run activity.
- Outreach drafts.
- Human review state.
- Exportable results.
- Partial and failed runs.
- Testing and auditability.

Supabase PostgreSQL is the authoritative persistent data store.

---

# 2. Modeling Principles

## 2.1 Run-centric design

A research run is the primary business object.

Everything generated during research should be traceable to a run.

```text
Run
├── ICP
├── Discovered Companies
├── Leads
├── Tool Calls
├── Run Events
└── Outreach Drafts
````

---

## 2.2 Separate discovery from qualification

A company discovered by Apify is not automatically a lead.

Therefore:

```text
discovered_companies
        │
        ▼
research
        │
        ▼
qualification
        │
   ┌────┴────┐
   ▼         ▼
qualified   rejected
```

This distinction allows the application to preserve the research process and explain why companies were excluded.

---

## 2.3 Evidence is first-class data

Qualification should not consist only of:

```text
qualified = true
```

The database should preserve:

* Source URLs.
* Source summaries.
* Evidence.
* Fit reasons.
* Concerns.
* Qualification reasoning.

---

## 2.4 Flexible agent output

AI-generated structures may evolve.

Use JSONB selectively for:

* Agent-generated reasoning.
* Structured criteria that may evolve.
* Tool input/output summaries.
* Flexible source metadata.

Use normal relational columns for fields that the application queries frequently.

---

# 3. Entity Relationship Overview

```text
┌──────────────┐
│    users     │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│     runs     │
└──────┬───────┘
       │
       ├───────────────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│  run_icps    │ │ run_events   │
└──────────────┘ └──────────────┘
       │
       │
       ▼
┌──────────────────────┐
│ discovered_companies │
└──────────┬───────────┘
           │
           ▼
       ┌─────────┐
       │  leads  │
       └────┬────┘
            │
       ┌────┴─────────────┐
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────────┐
│ lead_sources │   │ outreach_drafts  │
└──────────────┘   └──────────────────┘

runs
 │
 └── tool_calls
```

---

# 4. Tables

Initial schema:

```text
users
runs
run_icps
discovered_companies
leads
lead_sources
tool_calls
run_events
outreach_drafts
```

The `users` table may be provided by the selected authentication system rather than manually created.

---

# 5. `runs`

Represents one research execution.

## Columns

| Column             | Type        | Required | Description                              |
| ------------------ | ----------- | -------: | ---------------------------------------- |
| `id`               | uuid        |      yes | Primary key                              |
| `user_id`          | uuid        |      yes | Owner                                    |
| `objective`        | text        |      yes | Original user objective                  |
| `status`           | enum        |      yes | Current run status                       |
| `qualified_target` | integer     |      yes | Desired number of qualified leads        |
| `discovery_limit`  | integer     |      yes | Maximum companies that may be discovered |
| `discovered_count` | integer     |      yes | Number discovered                        |
| `qualified_count`  | integer     |      yes | Number qualified                         |
| `rejected_count`   | integer     |      yes | Number rejected                          |
| `started_at`       | timestamptz |       no | Execution start                          |
| `completed_at`     | timestamptz |       no | Completion time                          |
| `created_at`       | timestamptz |      yes | Creation timestamp                       |
| `updated_at`       | timestamptz |      yes | Last update                              |
| `error_message`    | text        |       no | Terminal error if applicable             |

---

## 5.1 Run status enum

```text
draft
awaiting_icp_approval
researching
generating_outreach
awaiting_review
completed
failed
cancelled
```

---

## 5.2 Run constraints

```text
qualified_target > 0
discovery_limit > 0
discovery_limit >= qualified_target
discovered_count >= 0
qualified_count >= 0
rejected_count >= 0
discovered_count <= discovery_limit
```

The application should enforce these rules as well as the database where practical.

---

# 6. Run Limits

The distinction between:

```text
qualified_target
```

and:

```text
discovery_limit
```

is intentional.

Example:

```text
Target qualified leads: 10
Maximum discoveries: 20
```

This means:

> Find up to 10 qualified companies while reviewing no more than 20 discovered companies.

The agent does not control either value.

---

# 7. `run_icps`

Stores the refined ICP associated with a run.

A run may have multiple ICP revisions.

This allows us to preserve the evolution of the agent's refinement and human edits.

## Columns

| Column        | Type        | Required | Description                   |
| ------------- | ----------- | -------: | ----------------------------- |
| `id`          | uuid        |      yes | Primary key                   |
| `run_id`      | uuid        |      yes | Parent run                    |
| `version`     | integer     |      yes | ICP revision                  |
| `source`      | enum        |      yes | Who created revision          |
| `criteria`    | jsonb       |      yes | Structured ICP                |
| `reasoning`   | text        |       no | Agent explanation             |
| `approved`    | boolean     |      yes | Whether revision was approved |
| `approved_at` | timestamptz |       no | Approval time                 |
| `approved_by` | uuid        |       no | User who approved             |
| `created_at`  | timestamptz |      yes | Creation time                 |

---

# 8. ICP Source

```text
agent
user
```

Example:

```text
version 1
source = agent
approved = false
```

Then:

```text
version 2
source = user
approved = true
```

This preserves the original AI refinement while recording the human-approved version.

---

# 9. ICP Structure

The `criteria` JSONB object should use a predictable structure.

Example:

```json
{
  "geography": {
    "include": ["United States"],
    "exclude": []
  },
  "industry": {
    "include": ["B2B SaaS"],
    "exclude": []
  },
  "employee_range": {
    "min": 10,
    "max": 100
  },
  "business_model": {
    "include": ["B2B"]
  },
  "target_personas": [
    "Founder",
    "Operations Lead"
  ],
  "hard_filters": [
    "US-based",
    "B2B SaaS",
    "10-100 employees"
  ],
  "soft_signals": [
    "Operational complexity",
    "Manual workflows",
    "Growth signals"
  ]
}
```

The exact schema will be validated at the application boundary.

---

# 10. Hard vs Soft Criteria

The data model must preserve the distinction.

```text
hard_filters
```

are mandatory constraints.

```text
soft_signals
```

are evidence used to assess potential fit.

This prevents qualification logic from accidentally treating all criteria as equal.

---

# 11. ICP Versioning

Only one ICP revision should be considered the approved ICP for a run.

Recommended invariant:

```text
run
 └── exactly one active approved ICP
```

Older revisions remain available for audit/history.

---

# 12. `discovered_companies`

Represents companies returned by the discovery system.

This is intentionally separate from `leads`.

## Columns

| Column             | Type        | Required | Description                  |
| ------------------ | ----------- | -------: | ---------------------------- |
| `id`               | uuid        |      yes | Primary key                  |
| `run_id`           | uuid        |      yes | Parent run                   |
| `company_name`     | text        |      yes | Company name                 |
| `domain`           | text        |      yes | Company domain               |
| `discovery_source` | text        |      yes | Discovery provider           |
| `source_url`       | text        |       no | Original discovery URL       |
| `external_id`      | text        |       no | Provider-specific identifier |
| `raw_metadata`     | jsonb       |       no | Normalized provider metadata |
| `discovered_at`    | timestamptz |      yes | Discovery timestamp          |
| `created_at`       | timestamptz |      yes | Record creation              |

---

# 13. Discovery Provider

Initial value:

```text
apify
```

The database should not assume that Apify is the only provider forever.

Future providers could include:

```text
manual
import
other
```

---

# 14. Discovery Uniqueness

Within a run, the same company should not be inserted multiple times.

Recommended uniqueness:

```text
(run_id, normalized_domain)
```

`normalized_domain` should remove:

* Protocol.
* `www.`
* Trailing slash.
* Path/query where appropriate.

Example:

```text
https://www.acme.com/
```

becomes:

```text
acme.com
```

---

# 15. Discovery Count

`runs.discovered_count` should represent the number of unique discovered companies.

It should not increment because the same company appeared multiple times in an Apify response.

---

# 16. `leads`

Represents the qualification result for a discovered company.

## Columns

| Column                    | Type        | Required | Description                     |
| ------------------------- | ----------- | -------: | ------------------------------- |
| `id`                      | uuid        |      yes | Primary key                     |
| `run_id`                  | uuid        |      yes | Parent run                      |
| `discovered_company_id`   | uuid        |      yes | Discovery record                |
| `company_name`            | text        |      yes | Denormalized display name       |
| `domain`                  | text        |      yes | Company domain                  |
| `qualification_status`    | enum        |      yes | Qualification result            |
| `confidence_score`        | numeric     |       no | 0–100                           |
| `fit_reasons`             | jsonb       |      yes | Reasons the company fits        |
| `concerns`                | jsonb       |      yes | Qualification concerns          |
| `qualification_reasoning` | text        |      yes | Agent reasoning                 |
| `source_summary`          | text        |      yes | Relevant research summary       |
| `research_metadata`       | jsonb       |       no | Additional research information |
| `review_state`            | enum        |      yes | Human review state              |
| `qualified_at`            | timestamptz |       no | Qualification timestamp         |
| `created_at`              | timestamptz |      yes | Creation timestamp              |
| `updated_at`              | timestamptz |      yes | Last update                     |

---

# 17. Qualification Status

```text
qualified
not_qualified
needs_review
```

`needs_review` is useful when available evidence is insufficient for a confident automated decision.

The system should not force weak evidence into a binary decision.

---

# 18. Confidence Score

Store confidence as:

```text
numeric
```

with a range:

```text
0–100
```

Example:

```text
91
```

The UI can render:

```text
91%
```

---

# 19. Confidence Semantics

The confidence score represents the agent's confidence in the qualification assessment.

It does not represent:

* Probability of conversion.
* Likelihood of replying.
* Sales value.
* Company quality.
* Revenue potential.

These concepts should not be conflated.

---

# 20. Fit Reasons

Store structured reasons.

Example:

```json
[
  {
    "reason": "Matches employee range",
    "evidence": "Company appears to have approximately 45 employees.",
    "source_ids": ["source-uuid"]
  },
  {
    "reason": "B2B SaaS business model",
    "evidence": "Company describes its product as a SaaS platform for businesses.",
    "source_ids": ["source-uuid"]
  }
]
```

This allows the UI to display reasoning while preserving evidence relationships.

---

# 21. Concerns

Example:

```json
[
  {
    "concern": "Employee count is approximate",
    "severity": "medium",
    "source_ids": ["source-uuid"]
  }
]
```

Suggested severity:

```text
low
medium
high
```

---

# 22. `lead_sources`

Represents source material used to research and qualify a lead.

A lead may have multiple sources.

## Columns

| Column             | Type        | Required | Description             |
| ------------------ | ----------- | -------: | ----------------------- |
| `id`               | uuid        |      yes | Primary key             |
| `lead_id`          | uuid        |      yes | Parent lead             |
| `url`              | text        |      yes | Source URL              |
| `title`            | text        |       no | Page title              |
| `source_type`      | enum        |      yes | Website/source category |
| `summary`          | text        |      yes | Relevant source summary |
| `relevant_excerpt` | text        |       no | Short evidence excerpt  |
| `scraped_at`       | timestamptz |      yes | Research timestamp      |
| `provider`         | text        |      yes | Research provider       |
| `metadata`         | jsonb       |       no | Additional metadata     |
| `created_at`       | timestamptz |      yes | Creation timestamp      |

---

# 23. Source Types

Initial values:

```text
homepage
about
product
services
pricing
careers
blog
other
```

The list can expand.

---

# 24. Source Evidence

The system should store concise relevant evidence rather than blindly storing entire websites.

Example:

```text
summary:
The company provides workflow automation software for
small and medium-sized businesses.

relevant_excerpt:
"Automate repetitive customer operations..."
```

Raw scrape content should only be retained when necessary.

---

# 25. `tool_calls`

Stores agent/tool execution records.

This is required for testing and observability.

## Columns

| Column               | Type        | Required | Description      |
| -------------------- | ----------- | -------: | ---------------- |
| `id`                 | uuid        |      yes | Primary key      |
| `run_id`             | uuid        |      yes | Parent run       |
| `tool_name`          | text        |      yes | Tool invoked     |
| `purpose`            | text        |      yes | Why it was used  |
| `input_summary`      | jsonb       |      yes | Sanitized input  |
| `result_summary`     | jsonb       |       no | Sanitized result |
| `status`             | enum        |      yes | Execution status |
| `error_message`      | text        |       no | Error if failed  |
| `started_at`         | timestamptz |      yes | Start            |
| `completed_at`       | timestamptz |       no | Completion       |
| `duration_ms`        | integer     |       no | Duration         |
| `external_reference` | text        |       no | External run ID  |
| `created_at`         | timestamptz |      yes | Creation         |

---

# 26. Tool Call Status

```text
pending
running
success
failed
```

---

# 27. Tool Call Security

`input_summary` and `result_summary` must be sanitized.

Never store:

* API keys.
* Authorization headers.
* Cookies.
* Access tokens.
* Service-role keys.
* Environment variables.
* Full secret-bearing payloads.

---

# 28. Apify Tool Record

Example:

```json
{
  "tool_name": "discover_companies",
  "purpose": "Discover companies matching the approved ICP",
  "input_summary": {
    "query": "US B2B SaaS companies",
    "requested_limit": 5,
    "enforced_limit": 5
  },
  "result_summary": {
    "companies_returned": 5,
    "provider": "apify"
  },
  "status": "success"
}
```

---

# 29. Firecrawl Tool Record

Example:

```json
{
  "tool_name": "research_company_website",
  "purpose": "Collect website evidence for qualification",
  "input_summary": {
    "domain": "example.com"
  },
  "result_summary": {
    "pages_researched": 4,
    "source_count": 4
  },
  "status": "success"
}
```

---

# 30. `run_events`

Stores user-visible activity events.

This is separate from detailed tool calls.

The distinction is:

```text
run_events
```

=

> What happened during the run?

while:

```text
tool_calls
```

=

> What technical operation was performed?

## Columns

| Column       | Type        | Required | Description            |
| ------------ | ----------- | -------: | ---------------------- |
| `id`         | uuid        |      yes | Primary key            |
| `run_id`     | uuid        |      yes | Parent run             |
| `event_type` | text        |      yes | Event category         |
| `message`    | text        |      yes | Human-readable message |
| `metadata`   | jsonb       |       no | Supporting information |
| `created_at` | timestamptz |      yes | Event timestamp        |

---

# 31. Run Event Types

Initial values:

```text
run_created
icp_refined
icp_approved
discovery_started
discovery_completed
company_research_started
company_research_completed
lead_qualified
lead_rejected
outreach_started
outreach_completed
run_completed
run_failed
run_cancelled
```

---

# 32. `outreach_drafts`

Stores generated outreach content.

## Columns

| Column                    | Type        | Required | Description         |
| ------------------------- | ----------- | -------: | ------------------- |
| `id`                      | uuid        |      yes | Primary key         |
| `lead_id`                 | uuid        |      yes | Parent lead         |
| `channel`                 | enum        |      yes | Email or LinkedIn   |
| `step`                    | integer     |       no | Email sequence step |
| `subject`                 | text        |       no | Email subject       |
| `body`                    | text        |      yes | Draft content       |
| `personalization_context` | jsonb       |      yes | Evidence used       |
| `review_state`            | enum        |      yes | Human review state  |
| `version`                 | integer     |      yes | Draft revision      |
| `created_at`              | timestamptz |      yes | Creation            |
| `updated_at`              | timestamptz |      yes | Last update         |

---

# 33. Outreach Channels

```text
email
linkedin
```

---

# 34. Email Steps

Email drafts use:

```text
1
2
3
```

LinkedIn messages use:

```text
NULL
```

because LinkedIn is not part of the email sequence.

---

# 35. Outreach Review State

```text
not_reviewed
reviewed
edited
approved_for_export
```

This does not represent sending status.

There is intentionally no:

```text
sent
```

state in the MVP.

---

# 36. Personalization Context

Each draft should preserve the evidence used to generate personalization.

Example:

```json
{
  "claims": [
    {
      "text": "The company describes an automated onboarding workflow.",
      "source_id": "uuid"
    }
  ]
}
```

This provides an audit trail between:

```text
source
   ↓
personalization
   ↓
outreach
```

---

# 37. Relationships

## Run → ICP

```text
runs.id
    │
    └── run_icps.run_id
```

One run can have many revisions.

---

## Run → Discovered Companies

```text
runs.id
    │
    └── discovered_companies.run_id
```

One run can discover many companies.

---

## Discovered Company → Lead

```text
discovered_companies.id
    │
    └── leads.discovered_company_id
```

A discovered company can have at most one qualification record per run.

---

## Lead → Sources

```text
leads.id
    │
    └── lead_sources.lead_id
```

One lead can have many sources.

---

## Lead → Outreach

```text
leads.id
    │
    └── outreach_drafts.lead_id
```

One lead can have multiple drafts.

---

## Run → Tool Calls

```text
runs.id
    │
    └── tool_calls.run_id
```

---

## Run → Events

```text
runs.id
    │
    └── run_events.run_id
```

---

# 38. Foreign Key Behavior

Recommended:

```text
runs
  └── child records
```

Child records should normally be deleted when a run is explicitly deleted, if run deletion is implemented.

However, the MVP may choose to prohibit deletion of completed runs and instead use archival.

This is an Agile decision.

---

# 39. Indexes

Recommended indexes:

```text
runs(user_id)
runs(status)
runs(created_at)

run_icps(run_id)
run_icps(run_id, version)

discovered_companies(run_id)
discovered_companies(run_id, domain)

leads(run_id)
leads(run_id, qualification_status)
leads(run_id, confidence_score)

lead_sources(lead_id)

tool_calls(run_id)
tool_calls(run_id, status)
tool_calls(created_at)

run_events(run_id)
run_events(created_at)

outreach_drafts(lead_id)
outreach_drafts(lead_id, channel)
```

---

# 40. Lead Uniqueness

Recommended:

```text
UNIQUE(run_id, discovered_company_id)
```

This prevents duplicate qualification records for the same discovered company within one run.

---

# 41. Outreach Uniqueness

For generated drafts:

```text
UNIQUE(lead_id, channel, step, version)
```

This allows multiple versions while preventing accidental duplicate version numbers.

---

# 42. Domain Normalization

Before persistence:

```text
HTTPS://WWW.Acme.com/
```

should normalize to:

```text
acme.com
```

Normalization should happen in the application/domain layer rather than relying entirely on the database.

---

# 43. URL Storage

Source URLs should preserve the actual URL used for research.

For domains, use normalized domain values.

Do not use the normalized domain as a substitute for source URLs.

---

# 44. JSONB Guidelines

Use JSONB where the structure is expected to evolve.

Good candidates:

```text
run_icps.criteria
discovered_companies.raw_metadata
leads.fit_reasons
leads.concerns
leads.research_metadata
lead_sources.metadata
tool_calls.input_summary
tool_calls.result_summary
run_events.metadata
outreach_drafts.personalization_context
```

Avoid putting frequently queried core fields into JSONB.

For example:

```text
qualification_status
confidence_score
domain
run_id
```

should remain normal columns.

---

# 45. Timestamps

All timestamps should use:

```text
timestamptz
```

and be stored in UTC.

The UI converts timestamps to the user's local timezone.

---

# 46. UUIDs

Use UUIDs for primary keys.

This avoids predictable sequential identifiers and works well across distributed application operations.

---

# 47. User Ownership

Every run must belong to a user:

```text
runs.user_id
```

All child records are indirectly owned by the run.

Authorization should verify run ownership before exposing child records.

---

# 48. Row Level Security

RLS should be enabled on user-facing tables.

At minimum:

```text
runs
run_icps
discovered_companies
leads
lead_sources
tool_calls
run_events
outreach_drafts
```

Users should only access records belonging to runs they are authorized to access.

---

# 49. Server-Side Privileged Access

Agent execution may require privileged database operations.

These operations must occur server-side.

The Supabase service-role key must never reach:

* Browser code.
* Client bundles.
* Agent-generated content.
* Tool logs.

---

# 50. Database Triggers

Triggers should be kept minimal.

Application code should own business workflows.

Potential database-level responsibilities:

* `updated_at` maintenance.
* Referential integrity.
* Uniqueness.
* Basic range constraints.

Avoid putting the entire agent workflow inside PostgreSQL triggers.

---

# 51. Run Counters

The following counters are useful for the UI:

```text
discovered_count
qualified_count
rejected_count
```

They can be maintained by application logic.

The underlying records remain authoritative.

If consistency becomes a concern, counters can be derived with queries or maintained transactionally.

---

# 52. Discovery Limit Enforcement

The database should provide an additional safety layer.

Before creating a discovery result:

```text
discovered_count < discovery_limit
```

must remain true.

However, the primary enforcement belongs in the application/tool layer because the application must prevent the external Apify call from exceeding the remaining limit.

Database constraints alone cannot prevent money from being spent before a result is inserted.

---

# 53. Transaction Boundaries

Important operations should be transactional where possible.

Example:

```text
Qualify lead
    │
    ├── create/update lead
    ├── create sources
    └── create event
```

A failure should not leave the lead appearing qualified without its required evidence.

---

# 54. Partial Failure

If a tool fails:

```text
tool_calls.status = failed
```

and the associated run/lead should retain its previous valid state.

Example:

```text
Research company
      │
      ├── source 1 saved
      ├── source 2 saved
      └── source 3 failed
```

The system can retain the successful evidence and mark the research as incomplete.

---

# 55. Source Quality

Source metadata may optionally include:

```json
{
  "quality": "high",
  "freshness": "recent",
  "official": true
}
```

These fields are informational.

They should not be confused with an externally validated source authority score.

---

# 56. Data Retention

The MVP should retain:

* Run metadata.
* ICP revisions.
* Discovery records.
* Qualified/rejected lead records.
* Source summaries.
* Tool-call summaries.
* Run events.
* Outreach drafts.

Large raw scraped documents should not automatically be retained forever.

If raw content is required later, it should be handled through a separate storage strategy.

---

# 57. Auditability

A reviewer should be able to reconstruct:

```text
What did the user ask?
        ↓
What ICP did the agent propose?
        ↓
What ICP did the user approve?
        ↓
What companies were discovered?
        ↓
Which sources were researched?
        ↓
How was each company qualified?
        ↓
What outreach was generated?
```

This is one of the primary reasons the schema separates runs, discoveries, leads, sources, tool calls, and outreach.

---

# 58. Example Record Chain

For a hypothetical company:

```text
Run
ID: run-123

Objective
"Find 10 US B2B SaaS companies..."

      ↓

Approved ICP
US
B2B SaaS
10–100 employees

      ↓

Discovered Company
Acme Inc.
acme.com
source = apify

      ↓

Lead
status = qualified
confidence = 91

      ↓

Sources
acme.com
acme.com/product
acme.com/about

      ↓

Qualification
Matches employee range
B2B SaaS
Evidence of operational complexity

      ↓

Outreach
Email 1
Email 2
Email 3
LinkedIn
```

---

# 59. Example Run State

```json
{
  "id": "run-123",
  "objective": "Find 10 US B2B SaaS companies with 10-100 employees that may need AI automation support.",
  "status": "awaiting_review",
  "qualified_target": 10,
  "discovery_limit": 20,
  "discovered_count": 17,
  "qualified_count": 10,
  "rejected_count": 7
}
```

---

# 60. Example Lead

```json
{
  "company_name": "Acme Inc.",
  "domain": "acme.com",
  "qualification_status": "qualified",
  "confidence_score": 91,
  "fit_reasons": [
    {
      "reason": "Matches employee range"
    },
    {
      "reason": "B2B SaaS company"
    },
    {
      "reason": "Evidence of operational complexity"
    }
  ],
  "concerns": [
    {
      "concern": "Employee count is approximate",
      "severity": "medium"
    }
  ],
  "source_summary": "Company website describes a SaaS platform serving business customers and multiple operational workflows.",
  "review_state": "not_reviewed"
}
```

---

# 61. Data Access Pattern

The frontend should not directly manipulate arbitrary database tables.

Preferred:

```text
UI
 │
 ▼
Next.js application
 │
 ▼
Repository / service layer
 │
 ▼
Supabase
```

For real-time subscriptions, the frontend may subscribe to authorized Supabase Realtime channels where appropriate.

---

# 62. Repository Boundaries

Suggested repository interfaces:

```text
RunRepository
ICPRepository
CompanyDiscoveryRepository
LeadRepository
SourceRepository
ToolCallRepository
RunEventRepository
OutreachRepository
```

These abstractions make unit testing easier.

---

# 63. Domain Objects

The application should have clear domain concepts:

```text
ResearchRun
ICP
DiscoveredCompany
Lead
LeadSource
ToolCall
RunEvent
OutreachDraft
```

Database records should not automatically become the application's entire domain model.

---

# 64. Migration Strategy

Schema changes should use Supabase/PostgreSQL migrations.

Recommended:

```text
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_indexes.sql
    └── ...
```

Migrations should be:

* Version-controlled.
* Repeatable across environments.
* Reviewed before deployment.
* Used for test database setup.

Avoid relying on manual dashboard schema changes.

---

# 65. Seed Data

Development/test seed data should include:

* Example run.
* Example ICP.
* Several discovered companies.
* Qualified lead.
* Rejected lead.
* Source records.
* Tool-call records.
* Outreach drafts.

Seed data must not contain real personal contact information.

---

# 66. Test Fixtures

Fixtures should cover:

### Strong qualified company

Clear ICP match and evidence.

### Hard-filter failure

Company violates employee/geography/business-model criteria.

### Weak evidence

Company cannot be confidently qualified.

### Duplicate discovery

Same domain appears multiple times.

### Scraping failure

Website research fails.

### Apify limit reached

Discovery limit is exhausted.

### Outreach grounding

Draft references stored evidence.

---

# 67. Schema Evolution

The schema should favor additive changes during the MVP.

Avoid premature normalization of every possible AI output.

For example, it is preferable to start with:

```text
fit_reasons JSONB
```

than create many narrowly defined tables for every possible reasoning subtype.

If a field becomes heavily queried, it can later be promoted into a relational structure.

---

# 68. Important Invariants

The following must always be true:

1. Every run has an objective.
2. Every run has a qualified target.
3. Every run has a discovery limit.
4. Discovery limit cannot be lower than qualified target.
5. Discovery count cannot exceed discovery limit.
6. Every discovered company belongs to a run.
7. A company cannot have duplicate discovery records within a run.
8. A discovered company has at most one lead record per run.
9. A qualified lead must contain qualification reasoning.
10. A qualified lead must contain source context.
11. Source URLs must be stored for researched leads.
12. Confidence must be between 0 and 100.
13. Outreach belongs to a lead.
14. Outreach does not have a sending state.
15. Tool-call records must never contain secrets.
16. Run events belong to a run.
17. Approved ICP state must be explicitly recorded.
18. Historical ICP revisions should remain auditable.

---

# 69. Deliberate Non-Goals

The schema does not initially model:

* Individual contacts.
* Personal email addresses.
* Email validation results.
* LinkedIn profiles.
* CRM contacts.
* Outreach delivery.
* Email opens.
* Email replies.
* Campaign analytics.
* Sales opportunities.
* Revenue.
* Lead conversion probability.

These are outside the Week 5 assignment scope.

---

# 70. Open Data-Model Decisions

These remain intentionally Agile.

## A. Global company deduplication

Current baseline:

> Deduplicate within each run.

Future option:

> Add a global companies table to deduplicate companies across all runs.

The MVP does not require cross-run deduplication.

---

## B. Raw scraped content

Current baseline:

> Store relevant summaries/excerpts, not entire scraped websites.

A separate document/content store can be added if later required.

---

## C. ICP structure

Current baseline:

> Structured JSONB with known top-level fields.

This provides flexibility without sacrificing predictable application behavior.

---

## D. Run deletion

Current baseline:

> Prefer archival over deletion for completed runs.

Exact policy can be decided before implementation.

---

## E. Counter maintenance

Current baseline:

> Persist counters for efficient UI, with underlying records as the source of truth.

If consistency becomes problematic, derive counts from queries.

---

# 71. Definition of Data Model Complete

The data model is considered implementation-ready when:

* All UI-required data has a persistence location.
* Every agent action can be associated with a run.
* Discovery and qualification are separate.
* Source evidence can be traced to leads.
* Outreach can be traced to evidence.
* Tool calls are auditable.
* ICP revisions are preserved.
* Limits are represented explicitly.
* Duplicate discovery is prevented.
* RLS boundaries are defined.
* External-service data can be represented without leaking secrets.
* Test fixtures can represent expected scenarios.
