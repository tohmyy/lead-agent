Phase 5 is **ARCHITECTURE.md**. I’ll keep the architecture pragmatic for your existing Next.js/TypeScript strengths while making the Claude Agent SDK the actual agent runtime required by the PRD.

# Week 5 — AI Lead Research and Outreach Agent

# Architecture

## 1. Purpose

This document defines the technical architecture for the Koya Talent AI Lead Research and Outreach Agent.

The system allows a user to provide a lead-generation objective such as:

> Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support.

The application then:

1. receives and stores the objective,
2. refines it into an ICP,
3. discovers candidate companies,
4. researches company websites,
5. collects source evidence,
6. qualifies candidates,
7. generates personalized outreach,
8. stores all important decisions and evidence,
9. presents the results for human review.

The system must use the **Claude Agent SDK as the agent runtime**.

---

# 2. Architectural Goals

The architecture prioritizes:

- clear separation of responsibilities,
- server-side control of external services,
- auditable agent behavior,
- safe handling of untrusted website content,
- strict Apify cost controls,
- reliable persistence,
- recoverable failures,
- incremental implementation,
- simple local development,
- straightforward deployment.

The architecture should be strong enough for the project assessment without introducing unnecessary infrastructure.

---

# 3. Recommended Stack

| Layer                | Technology                                             |
| -------------------- | ------------------------------------------------------ |
| Frontend             | Next.js + React + TypeScript                           |
| UI                   | Tailwind CSS + shadcn/ui                               |
| Agent runtime        | Claude Agent SDK                                       |
| Application/server   | Next.js server-side runtime                            |
| Database             | Supabase PostgreSQL                                    |
| Database access      | Supabase server client                                 |
| Company discovery    | Apify                                                  |
| Website research     | Firecrawl                                              |
| Alternative scraper  | Crawl4AI                                               |
| Validation           | Zod                                                    |
| Authentication       | Application authentication / Supabase Auth if required |
| Background execution | Server-side job/run mechanism                          |
| Realtime UI          | Supabase Realtime or server-sent events                |
| Deployment           | Next.js-compatible hosting                             |

The initial implementation should avoid introducing a separate Python service unless a concrete requirement appears.

---

# 4. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │       Browser        │
                         │                      │
                         │  Run creation        │
                         │  Activity feed       │
                         │  Lead review         │
                         │  Outreach review     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Next.js App     │
                         │                      │
                         │  UI                  │
                         │  API / Server        │
                         │  Auth                │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Agent Orchestrator │
                         │                      │
                         │ Claude Agent SDK     │
                         │ Agent session        │
                         │ Skills                │
                         │ Tool dispatcher      │
                         └───────┬───────┬──────┘
                                 │       │
                 ┌───────────────┘       └────────────────┐
                 ▼                                        ▼
       ┌───────────────────┐                    ┌──────────────────┐
       │ External Services │                    │    Supabase      │
       │                   │                    │                  │
       │ Apify             │                    │ Runs             │
       │ Firecrawl         │                    │ ICPs             │
       │ Claude API        │                    │ Companies        │
       └───────────────────┘                    │ Leads            │
                                                │ Sources          │
                                                │ Outreach         │
                                                │ Tool calls       │
                                                │ Events           │
                                                └──────────────────┘
```

---

# 5. Application Boundary

The application consists of five major logical layers:

```text
Presentation
    ↓
Application
    ↓
Agent
    ↓
Domain
    ↓
Infrastructure
```

These are logical boundaries rather than requirements for five separate packages.

---

# 6. Presentation Layer

The presentation layer is responsible for the browser experience.

## Responsibilities

- objective input,
- run creation,
- run status,
- ICP display,
- activity feed,
- candidate/lead list,
- qualification details,
- source evidence,
- outreach review,
- export.

It must not:

- call Apify directly,
- call Firecrawl directly,
- expose Claude credentials,
- expose Supabase service-role credentials,
- execute agent tools.

---

# 7. Recommended UI Structure

```text
app/
├── page.tsx
├── runs/
│   ├── page.tsx
│   └── [runId]/
│       ├── page.tsx
│       ├── leads/
│       └── outreach/
```

The exact route structure can change during implementation.

---

# 8. Application Layer

The application layer coordinates use cases.

Example use cases:

```text
CreateRun
StartResearchRun
GetRun
GetRunActivity
GetRunLeads
GetLeadDetails
GetOutreachDrafts
ExportResults
```

The application layer should not contain provider-specific HTTP logic.

For example:

```text
StartResearchRun
      ↓
AgentRunner
      ↓
ToolDispatcher
      ↓
DiscoveryProvider
```

rather than:

```text
StartResearchRun
      ↓
fetch("https://api.apify.com/...")
```

---

# 9. Agent Layer

The agent layer is responsible for running Claude Agent SDK sessions.

Conceptually:

```text
AgentRunner
    |
    +-- Agent configuration
    |
    +-- System instructions
    |
    +-- Skills
    |
    +-- Tool definitions
    |
    +-- Tool dispatcher
    |
    +-- Run lifecycle
```

The agent should be instantiated with the tools and skills required for the lead-research workflow.

---

# 10. Claude Agent SDK Runtime

The Claude Agent SDK is the central reasoning runtime.

The agent is responsible for:

- interpreting the user's objective,
- refining the ICP,
- selecting research actions,
- deciding which candidates need more research,
- interpreting evidence,
- qualifying candidates,
- creating outreach content.

The agent is **not** responsible for:

- enforcing Apify budgets,
- storing secrets,
- bypassing application authorization,
- directly executing arbitrary HTTP requests,
- sending outreach.

---

# 11. Agent Session Lifecycle

Recommended lifecycle:

```text
User creates run
       ↓
Run persisted
       ↓
Agent session started
       ↓
Load objective
       ↓
Load skills
       ↓
Refine ICP
       ↓
Research loop
       ↓
Qualification
       ↓
Outreach
       ↓
Completion
       ↓
Agent session ends
```

Every agent session is associated with exactly one run.

---

# 12. Agent System Context

The agent should receive:

```text
Original user objective
Run identifier
Current run state
Approved/refined ICP
Tool availability
Safety rules
Relevant skills
```

The agent should not receive:

```text
API credentials
database service-role key
environment variables
unrestricted filesystem access
unrestricted network access
other users' runs
```

---

# 13. Agent Skills

The five PRD documents in `assets/` become agent skills:

```text
skills/
├── icp-refinement/
├── lead-qualification/
├── outbound-copywriting/
├── lead-list-quality/
└── outreach-safety/
```

The actual directory structure can follow the Claude Agent SDK's skill-loading conventions.

---

# 14. Skill Responsibilities

## ICP Refinement

Teaches the agent how to turn:

```text
vague objective
```

into:

```text
explicit ICP
```

including:

- geography,
- industry,
- company size,
- business model,
- target personas,
- hard filters,
- soft signals.

---

## Lead Qualification

Teaches:

- how hard filters work,
- how soft signals affect qualification,
- how to evaluate evidence,
- how to express uncertainty,
- how to produce qualification reasoning.

---

## Outbound Copywriting

Teaches:

- cold email structure,
- follow-up sequencing,
- LinkedIn messaging,
- personalization,
- concise business language.

---

## Lead List Quality

Teaches:

- duplicate handling,
- evidence quality,
- consistency,
- completeness,
- list hygiene.

---

## Outreach Safety

Teaches:

- no fabricated claims,
- no unsupported personalization,
- no deceptive messaging,
- no automatic sending,
- safe treatment of external content.

---

# 15. Tool Architecture

Tools are implemented as application-controlled capabilities.

```text
Claude
  |
  v
Tool request
  |
  v
Tool dispatcher
  |
  +--> Schema validation
  +--> Authorization
  +--> Run validation
  +--> Business rules
  +--> Cost limits
  +--> Provider execution
  +--> Persistence
  +--> Logging
  |
  v
Bounded result
  |
  v
Claude
```

This dispatcher is a critical security boundary.

---

# 16. Tool Dispatcher

Recommended conceptual interface:

```ts
interface ToolDispatcher {
  execute(
    toolName: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult<unknown>>;
}
```

The dispatcher:

1. identifies the tool,
2. validates its input,
3. verifies the run,
4. checks permissions,
5. enforces business limits,
6. invokes the implementation,
7. records the tool call,
8. sanitizes the result,
9. returns the result to Claude.

---

# 17. Tool Implementations

Recommended structure:

```text
src/
├── agent/
│   ├── runner/
│   ├── prompts/
│   ├── skills/
│   └── tools/
│       ├── save-icp.ts
│       ├── discover-companies.ts
│       ├── scrape-company-website.ts
│       ├── save-source-evidence.ts
│       ├── save-lead.ts
│       ├── save-outreach-draft.ts
│       ├── record-run-event.ts
│       ├── record-tool-call.ts
│       └── complete-run.ts
```

The exact directory structure can be simplified if the implementation remains small.

---

# 18. Domain Layer

The domain layer represents project concepts independent of external providers.

Core domain objects:

```text
Run
ICP
DiscoveredCompany
Lead
LeadSource
ToolCall
RunEvent
OutreachDraft
```

The domain should not know:

```text
Apify
Firecrawl
Supabase SDK
Next.js request objects
Claude API implementation details
```

---

# 19. Domain Rules

Important rules belong in the domain/application layer rather than in UI components.

Examples:

```text
qualified_count <= qualified_target

discovery_limit cannot be increased by agent

qualified lead requires qualification reasoning

qualified lead should have evidence

outreach requires qualified lead

email requires step 1/2/3

LinkedIn does not have email steps

completed run must satisfy completion conditions
```

---

# 20. Infrastructure Layer

Infrastructure contains provider implementations.

Recommended structure:

```text
src/
└── infrastructure/
    ├── apify/
    ├── firecrawl/
    ├── supabase/
    └── claude/
```

---

# 21. Apify Adapter

```text
ApifyDiscoveryProvider
```

implements the application's discovery interface.

Conceptually:

```ts
interface CompanyDiscoveryProvider {
  discover(input: DiscoveryInput): Promise<DiscoveryResult>;
}
```

The rest of the application should not need to know which Apify actor is being used.

---

# 22. Apify Safety Boundary

The Apify adapter must enforce:

```text
approved actor
+
hard result limit
+
no rental actor
+
run-level discovery budget
```

The agent must never be allowed to supply unrestricted actor configuration.

Recommended flow:

```text
Agent criteria
      ↓
Application discovery request
      ↓
Discovery policy
      ↓
Approved actor configuration
      ↓
Apify
```

---

# 23. Firecrawl Adapter

Recommended interface:

```ts
interface WebsiteResearchProvider {
  scrape(input: WebsiteResearchInput): Promise<WebsiteResearchResult>;
}
```

Implementation:

```text
FirecrawlWebsiteResearchProvider
```

A future:

```text
Crawl4AIWebsiteResearchProvider
```

can implement the same interface.

---

# 24. Supabase Adapter

Supabase provides persistence.

The application should interact with repository interfaces where practical:

```text
RunRepository
IcpRepository
CompanyRepository
LeadRepository
SourceRepository
OutreachRepository
ToolCallRepository
RunEventRepository
```

Example:

```ts
interface LeadRepository {
  create(input: CreateLeadInput): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  countQualified(runId: string): Promise<number>;
}
```

---

# 25. Database Access

Supabase should be accessed server-side for privileged operations.

Browser code should never receive:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Server-side operations should use the appropriate privileged client only where necessary.

RLS should still be used for user-facing database access where appropriate.

---

# 26. Run Creation

Recommended flow:

```text
Browser
  ↓
POST /api/runs
  ↓
Validate objective
  ↓
Create run
  ↓
Return runId
```

The initial run should contain:

```text
objective
qualified_target
discovery_limit
status
created_at
```

---

# 27. Starting the Agent

Do not make the browser responsible for maintaining a long-running agent request.

Recommended:

```text
POST /api/runs/:runId/start
        ↓
validate run
        ↓
start server-side execution
        ↓
return accepted
        ↓
agent continues independently
```

The exact execution mechanism depends on the deployment platform.

---

# 28. Background Execution

The research workflow may take significantly longer than a normal HTTP request because it can involve:

```text
Claude
→ Apify
→ Firecrawl
→ Claude
→ Supabase
→ more research
→ outreach generation
```

Therefore the agent should execute as a background/server-side job where the deployment environment supports it.

For a small assessment project, a single server-side run worker is sufficient.

A distributed queue is not initially required.

---

# 29. Recommended Execution Model

Initial:

```text
Next.js application
        |
        +--> API routes / server actions
        |
        +--> Agent runner
                 |
                 +--> Claude Agent SDK
                 |
                 +--> Tools
```

If deployment limits make long-running processes unreliable, introduce a dedicated worker later:

```text
Next.js
   ↓
Job store / queue
   ↓
Agent worker
```

Do not introduce a queue before the deployment environment requires it.

---

# 30. Run State Machine

Recommended:

```text
draft
  ↓
researching
  ↓
generating_outreach
  ↓
awaiting_review
  ↓
completed
```

Failure:

```text
any active state
      ↓
failed
```

Cancellation:

```text
active
  ↓
cancelled
```

The previously defined `awaiting_icp_approval` state remains available if human ICP approval is enabled later.

---

# 31. Research Loop

The core agent loop should conceptually look like:

```text
while qualified_count < qualified_target:

    inspect current run state

    discover candidates if needed

    select candidate

    research candidate

    save evidence

    evaluate against ICP

    save qualification

    if qualified:
        generate outreach
        save outreach

    continue
```

The agent determines the research strategy.

The application enforces the limits.

---

# 32. Discovery Strategy

The agent should not assume that the first N discovered companies are qualified.

Recommended:

```text
discover
  ↓
inspect candidates
  ↓
research promising candidates
  ↓
qualify
  ↓
repeat discovery if needed
```

The discovery limit exists to control total candidate retrieval.

---

# 33. Candidate Deduplication

Candidates are deduplicated using normalized domains where possible.

Example:

```text
https://www.example.com
http://example.com/
example.com
```

should normalize to:

```text
example.com
```

The same company should not create multiple lead records within the same run.

---

# 34. Research Strategy

The agent should prioritize pages that provide qualification evidence.

Recommended order:

```text
Homepage
   ↓
About
   ↓
Product / Services
   ↓
Pricing
   ↓
Careers
   ↓
Blog / other relevant pages
```

The agent does not need to scrape every page.

It should research enough to support the qualification decision.

---

# 35. Evidence Chain

Every important qualification should be traceable:

```text
Lead
 ↓
Qualification reason
 ↓
Source
 ↓
URL
 ↓
Observed evidence
```

This is important both for the user interface and assessment evidence.

---

# 36. Qualification Architecture

Qualification should be performed using:

```text
Approved ICP
+
Candidate information
+
Website evidence
+
Qualification skill
```

Not:

```text
Company name alone
```

The qualification result should contain:

```text
status
confidence
fit reasons
concerns
reasoning
source summary
```

---

# 37. Confidence Score

The confidence score is an assessment-confidence measure.

It must not be interpreted as:

```text
conversion probability
sales probability
reply probability
company quality score
```

The UI should label it clearly.

---

# 38. Outreach Architecture

Outreach generation occurs after qualification.

```text
Lead
 ↓
Evidence
 ↓
Personalization context
 ↓
Outbound copywriting skill
 ↓
3-step email
 ↓
LinkedIn message
```

The outreach generator should receive evidence rather than relying on memory of earlier scraping.

---

# 39. Human Review

The completed run should enter:

```text
awaiting_review
```

before final export.

The UI should allow the user to inspect:

- company,
- qualification status,
- confidence,
- reasons,
- concerns,
- sources,
- email sequence,
- LinkedIn message.

---

# 40. Outreach Safety Boundary

There is intentionally no outbound delivery integration.

```text
Generated
   ↓
Stored
   ↓
Reviewed
   ↓
Exported
```

Not:

```text
Generated
   ↓
Automatically sent
```

This keeps the project within its research/outreach-drafting scope.

---

# 41. Realtime Activity Feed

The UI should provide a live activity feed.

Recommended event flow:

```text
Agent/tool execution
        ↓
run_events
        ↓
Supabase Realtime
        ↓
Browser
```

Example events:

```text
ICP refined
Discovery started
Found 15 candidate companies
Researching company
Source saved
Lead qualified
Generating outreach
Run completed
```

Technical tool-call details remain available separately.

---

# 42. Tool Calls vs Run Events

These serve different purposes.

### Run events

Human-readable:

```text
"Researching Acme's product and services pages."
```

### Tool calls

Technical:

```text
tool_name: scrape_company_website
provider: firecrawl
duration: 4.7s
status: success
```

The UI should primarily display run events.

Technical logs can be available in a details/debug view.

---

# 43. Security Architecture

Security boundaries:

```text
Browser
   │
   │ authenticated request
   ▼
Next.js server
   │
   ├── user authorization
   │
   ├── run validation
   │
   ├── tool validation
   │
   └── provider credentials
            │
            ├── Claude
            ├── Apify
            └── Firecrawl
```

Secrets never cross into the browser or agent context.

---

# 44. SSRF Protection

Website scraping introduces SSRF risk.

The scraping layer must reject requests targeting internal/private network addresses.

At minimum:

```text
localhost
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
```

IPv6 private/link-local ranges should also be handled.

The safest implementation is to combine:

```text
URL validation
+
DNS/IP validation
+
HTTP client restrictions
+
provider-side restrictions where available
```

---

# 45. Prompt Injection Protection

The architecture treats scraped content as an untrusted boundary:

```text
Internet
   ↓
Scraper
   ↓
UNTRUSTED CONTENT
   ↓
Agent context
```

The system must never allow website text to modify:

```text
tool permissions
run limits
system instructions
user objective
credentials
outreach permissions
```

---

# 46. Secrets Management

Environment variables:

```text
ANTHROPIC_API_KEY
APIFY_API_TOKEN
FIRECRAWL_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

must remain server-side.

Do not expose them through:

```text
NEXT_PUBLIC_*
```

Do not include them in:

```text
tool input
tool result
run events
tool-call logs
source records
client payloads
```

---

# 47. Cost Controls

Claude, Apify, and Firecrawl usage can create variable costs.

The application should track:

```text
run
 ↓
tool calls
 ↓
provider usage
```

Where provider usage information is available, persist relevant cost metadata.

---

# 48. Apify Budget Control

Apify receives the strongest external-cost controls.

Before a run:

```text
check actor pricing
check actor type
set hard limit
```

During execution:

```text
monitor run
```

After execution:

```text
record result
record cost if available
```

If a run behaves unexpectedly:

```text
abort
+
mark failure
+
surface issue
```

Do not automatically retry unexpected expensive behavior.

---

# 49. Failure Handling

A provider failure should not automatically destroy the entire run.

Example:

```text
Company A
  ↓
Firecrawl fails
  ↓
record error
  ↓
try another permitted research path
```

However, repeated failures should eventually cause the run to enter:

```text
failed
```

or:

```text
awaiting_review
```

depending on whether enough qualified leads were produced.

---

# 50. Partial Completion

The system should preserve successful work when a later operation fails.

Example:

```text
10 companies discovered
7 researched
5 qualified
3 outreach sequences generated
Firecrawl becomes unavailable
```

The existing records remain stored.

The run should not delete successful work.

---

# 51. Observability

At minimum record:

```text
run
tool calls
run events
provider reference IDs
status
duration
errors
```

Useful optional metrics:

```text
total tool calls
discovery count
qualified count
research failures
outreach drafts generated
run duration
provider costs
```

---

# 52. Logging Policy

Application logs may contain:

```text
run ID
tool name
status
duration
provider reference
error code
```

They must not contain:

```text
API keys
tokens
authorization headers
database credentials
full sensitive provider responses
```

---

# 53. Repository Structure

Recommended project structure:

```text
src/
├── app/
│   ├── api/
│   │   ├── runs/
│   │   └── ...
│   ├── runs/
│   └── ...
│
├── agent/
│   ├── runner/
│   ├── prompts/
│   ├── skills/
│   └── tools/
│
├── application/
│   ├── runs/
│   ├── leads/
│   └── outreach/
│
├── domain/
│   ├── run/
│   ├── icp/
│   ├── company/
│   ├── lead/
│   └── outreach/
│
├── infrastructure/
│   ├── apify/
│   ├── firecrawl/
│   ├── supabase/
│   └── claude/
│
├── lib/
│   ├── validation/
│   ├── security/
│   └── utils/
│
└── types/
```

This is a recommended logical structure, not a requirement to create every directory immediately.

---

# 54. Dependency Direction

The desired dependency direction is:

```text
Presentation
      ↓
Application
      ↓
Domain

Infrastructure → Domain/Application interfaces

Agent → Application + Tool interfaces
```

The domain should remain the least dependent layer.

---

# 55. Avoiding Overengineering

Do not initially add:

- microservices,
- Kubernetes,
- Redis,
- Kafka,
- complex workflow engines,
- separate Python service,
- dedicated vector database,
- event sourcing,
- distributed job queues.

None is required for the initial project scope.

If a deployment constraint requires a worker or queue, introduce the smallest solution that solves the problem.

---

# 56. Why Next.js Server Instead of a Separate FastAPI Service?

The project is primarily:

```text
TypeScript
+
Claude Agent SDK
+
web UI
+
server-side tools
```

A Next.js server layer keeps these components together.

A separate FastAPI service would introduce:

```text
Next.js
      ↓
HTTP
      ↓
Python service
      ↓
Agent
      ↓
providers
```

without a current requirement that justifies the additional operational complexity.

A Python service can be introduced later if a Python-specific capability becomes necessary.

---

# 57. External Provider Interfaces

The architecture should depend on interfaces rather than provider SDKs.

```ts
interface CompanyDiscoveryProvider {
  discover(input: DiscoveryInput): Promise<DiscoveryResult>;
}

interface WebsiteResearchProvider {
  scrape(input: WebsiteResearchInput): Promise<WebsiteResearchResult>;
}
```

This allows:

```text
Apify → another discovery provider
Firecrawl → Crawl4AI
```

without changing the agent's conceptual tools.

---

# 58. Claude Provider Boundary

The agent runtime should be isolated behind an application boundary.

Conceptually:

```ts
interface AgentRunner {
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
```

The implementation can use the Claude Agent SDK.

The rest of the application should not need to understand low-level Claude runtime behavior.

---

# 59. Run Cancellation

The UI should eventually support:

```text
Cancel run
```

Cancellation flow:

```text
Browser
  ↓
cancel request
  ↓
validate ownership
  ↓
mark run cancelled
  ↓
signal agent/job
  ↓
stop future tool execution
```

A cancelled run must not start new Apify or Firecrawl work.

---

# 60. Concurrency

Initial recommendation:

```text
one active agent execution per run
```

Multiple runs may exist for a user, but each run should have a clear execution state.

Within a run, avoid uncontrolled parallel provider calls.

Especially for Apify, sequential or tightly bounded execution makes cost monitoring easier.

---

# 61. Data Flow

Complete flow:

```text
USER OBJECTIVE
      ↓
CREATE RUN
      ↓
AGENT
      ↓
ICP REFINEMENT
      ↓
SAVE ICP
      ↓
APIFY DISCOVERY
      ↓
DISCOVERED COMPANIES
      ↓
WEBSITE RESEARCH
      ↓
SOURCE EVIDENCE
      ↓
QUALIFICATION
      ↓
LEAD
      ↓
OUTREACH GENERATION
      ↓
OUTREACH DRAFTS
      ↓
HUMAN REVIEW
      ↓
EXPORT
```

---

# 62. Example Runtime

Input:

```text
Find 10 US B2B SaaS companies with 10–100 employees
that may need AI automation support.
```

### Phase 1

Agent refines:

```text
Geography:
United States

Industry:
B2B SaaS

Employees:
10–100

Hard filters:
US
B2B SaaS
10–100 employees

Soft signals:
operational complexity
growth
manual workflows
hiring
multiple business functions
```

### Phase 2

Agent saves ICP.

### Phase 3

Agent discovers candidates through Apify.

### Phase 4

Agent researches candidate websites through Firecrawl.

### Phase 5

Agent saves evidence.

### Phase 6

Agent qualifies candidates.

### Phase 7

Agent creates outreach for qualified leads.

### Phase 8

Application validates final state.

### Phase 9

User reviews output.

---

# 63. Assessment Evidence

The architecture should make it easy to demonstrate the project requirements.

The UI should expose enough information to demonstrate:

```text
Objective
  ↓
Refined ICP
  ↓
Apify discovery
  ↓
Website research
  ↓
Qualification reasoning
  ↓
Source evidence
  ↓
Outreach
```

The activity feed and run details should provide evidence of the workflow without requiring the evaluator to inspect source code.

---

# 64. Deployment Architecture

Recommended initial deployment:

```text
┌─────────────────────────┐
│ Next.js Hosting         │
│                         │
│ UI                      │
│ API                     │
│ Agent runner            │
│ Tool dispatcher         │
└───────────┬─────────────┘
            │
      ┌─────┼──────────────┐
      ▼     ▼              ▼
   Claude Apify         Firecrawl
            │
            ▼
        Supabase
```

The exact hosting provider can be selected based on support for long-running server-side agent execution.

---

# 65. Deployment Constraint

Before production-style deployment, verify:

- maximum server execution time,
- streaming support,
- background execution support,
- environment-variable support,
- outbound HTTPS access,
- compatibility with the Claude Agent SDK runtime.

If the host cannot reliably support long-running agent execution, move the agent runner into a small worker service.

---

# 66. Local Development

Recommended local environment:

```text
Next.js
    ↓
Claude API
    ↓
Apify team account
    ↓
Firecrawl
    ↓
Supabase
```

Use small test runs.

For Apify:

```text
1–2 results
```

should be the default development test.

Do not repeatedly execute full 10-lead discovery runs while building individual features.

---

# 67. Testing Architecture

Tests should be organized around boundaries.

```text
Unit
  ↓
Domain rules
  ↓
Tool validation
  ↓
Provider adapters
  ↓
Agent workflow
  ↓
Integration
  ↓
End-to-end
```

Provider calls should be mockable.

---

# 68. Mocking External Services

Automated tests should not depend on real:

```text
Apify
Firecrawl
Claude
```

calls.

Use fixtures such as:

```text
apify-discovery.json
firecrawl-company.json
qualification-candidate.json
```

Real provider calls should be reserved for controlled integration testing.

---

# 69. Architecture Invariants

The following must remain true:

### Invariant 1

```text
Browser cannot call Apify directly.
```

### Invariant 2

```text
Agent cannot access secrets.
```

### Invariant 3

```text
Agent cannot increase run limits.
```

### Invariant 4

```text
Apify is discovery-only.
```

### Invariant 5

```text
Scraped content is untrusted.
```

### Invariant 6

```text
Qualified leads require evidence.
```

### Invariant 7

```text
Outreach requires qualification.
```

### Invariant 8

```text
Outreach is generated but not sent.
```

### Invariant 9

```text
All significant tool activity is logged.
```

### Invariant 10

```text
Successful partial work is preserved after failures.
```

---

# 70. Architecture Decision Records

## ADR-001 — Next.js as Application and Agent Host

**Decision:** Use Next.js/TypeScript for the application and server-side agent orchestration.

**Reason:** The project is already centered around a TypeScript web application and the Claude Agent SDK. This minimizes infrastructure.

**Alternative:** Separate Next.js + Python/FastAPI service.

**Status:** Accepted.

---

## ADR-002 — Claude Agent SDK as Runtime

**Decision:** Claude Agent SDK is the required agent runtime.

**Reason:** Explicit project requirement.

**Status:** Accepted.

---

## ADR-003 — Apify for Discovery Only

**Decision:** Apify is restricted to company discovery.

**Reason:** Explicit PRD requirement and clearer cost/safety boundaries.

**Status:** Accepted.

---

## ADR-004 — Firecrawl for Website Research

**Decision:** Firecrawl is the initial website research provider.

**Reason:** The PRD explicitly allows Firecrawl and it provides a clean provider boundary.

**Alternative:** Crawl4AI.

**Status:** Accepted.

---

## ADR-005 — Supabase as Persistence Layer

**Decision:** Supabase PostgreSQL stores application state, evidence, outreach, events, and tool logs.

**Reason:** Explicit PRD requirement and sufficient functionality for the project.

**Status:** Accepted.

---

## ADR-006 — No Automatic Outreach Sending

**Decision:** The system generates drafts but does not send messages.

**Reason:** The PRD requires outreach preparation, not delivery. This also preserves human review.

**Status:** Accepted.

---

## ADR-007 — No Separate Python Service Initially

**Decision:** Do not introduce FastAPI unless implementation or deployment requirements make it necessary.

**Reason:** Avoid unnecessary service complexity.

**Status:** Accepted.

---

# 71. Open Agile Decisions

These can be changed during implementation without redesigning the entire system.

## Background Execution

Start with the simplest server-side execution model supported by the chosen host.

If unreliable:

```text
introduce worker
```

---

## Realtime Transport

Initial recommendation:

```text
Supabase Realtime
```

Alternative:

```text
Server-Sent Events
```

Choose based on implementation simplicity.

---

## Authentication

If the assessment does not require multi-user authentication:

```text
minimal authenticated/local user model
```

If required:

```text
Supabase Auth
```

---

## ICP Approval

Initial:

```text
agent refines ICP → continues
```

Optional future:

```text
agent refines ICP → user approves → continues
```

---

## Global Company Deduplication

Initial:

```text
deduplicate within a run
```

Future:

```text
global company identity across runs
```

---

# 72. Recommended Implementation Order

Build the system in this order:

```text
1. Project foundation
        ↓
2. Supabase schema
        ↓
3. Run creation
        ↓
4. Claude Agent SDK runner
        ↓
5. Tool dispatcher
        ↓
6. save_icp
        ↓
7. Apify discovery
        ↓
8. Firecrawl research
        ↓
9. Source evidence
        ↓
10. Qualification
        ↓
11. Outreach generation
        ↓
12. Activity feed
        ↓
13. Lead review UI
        ↓
14. Testing
        ↓
15. Deployment
```

Do not build the complete UI before the agent workflow has a working vertical slice.

---

# 73. First Vertical Slice

The first working milestone should be:

```text
User objective
    ↓
Create run
    ↓
Claude Agent SDK
    ↓
Refine ICP
    ↓
save_icp
    ↓
discover_companies
    ↓
Apify
    ↓
Persist candidates
```

Once this works reliably, add:

```text
scraping
→ evidence
→ qualification
→ outreach
```

This minimizes debugging complexity.

---

# 74. Definition of Done

The architecture is implemented successfully when:

- [ ] Next.js provides the application layer.
- [ ] Claude Agent SDK runs the agent.
- [ ] Agent execution is server-side.
- [ ] Tools pass through an application dispatcher.
- [ ] Tool schemas are validated.
- [ ] Run authorization is enforced.
- [ ] Apify is discovery-only.
- [ ] Apify hard limits are enforced server-side.
- [ ] Firecrawl is behind a provider interface.
- [ ] Supabase persistence is behind application/repository boundaries where useful.
- [ ] Website content is treated as untrusted.
- [ ] Agent cannot access secrets.
- [ ] Tool calls are logged.
- [ ] Run events are persisted.
- [ ] Live activity can be displayed.
- [ ] Qualification is evidence-backed.
- [ ] Outreach is generated only for qualified leads.
- [ ] Outreach is not automatically sent.
- [ ] Partial failures preserve successful work.
- [ ] The system can be tested without calling real external providers.
- [ ] The application can demonstrate the full assessment workflow.

---

# 75. Final Architecture Principle

The system should remain centered around this boundary:

```text
                    ┌─────────────────────┐
                    │       CLAUDE        │
                    │                     │
                    │ Reason              │
                    │ Research strategy   │
                    │ Interpret evidence  │
                    │ Qualify             │
                    │ Generate outreach   │
                    └──────────┬──────────┘
                               │
                         Tool requests
                               │
                               ▼
                    ┌─────────────────────┐
                    │    APPLICATION      │
                    │                     │
                    │ Validate            │
                    │ Authorize           │
                    │ Enforce limits      │
                    │ Execute             │
                    │ Persist             │
                    │ Log                 │
                    └──────────┬──────────┘
                               │
                  ┌────────────┼────────────┐
                  ▼            ▼            ▼
               Apify       Firecrawl     Supabase
```

Claude is the **reasoning engine**.

The application is the **control plane**.

External providers are **bounded capabilities**.

Supabase is the **system of record**.

That separation should guide implementation decisions throughout the project.

**Phase 5 complete.** The next phase is **Phase 6 — `TEST-PLAN.md`**, where we’ll turn the PRD, data model, tool contracts, and architecture into concrete unit, integration, agent-workflow, security, cost-control, and end-to-end tests.
