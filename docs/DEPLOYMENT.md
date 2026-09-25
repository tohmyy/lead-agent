# Deployment

This app is a standard Next.js App Router project — it needs a Node-compatible
hosting platform (BUILD-PLAN.md section 3) and has no non-standard build
requirements, so no platform-specific config file is required. This doc
covers deployment *readiness*: the order to follow, the environment
checklist, and the smoke test to run once it's live — not deployment itself.

## Deployment order (BUILD-PLAN.md section 56)

```text
Supabase
   ↓
External service credentials
   ↓
Application environment
   ↓
Application deployment
   ↓
Database migration
   ↓
Smoke tests
   ↓
Controlled run
```

1. **Supabase.** Either reuse the existing dev project or create a fresh
   production one. If creating a fresh one, the schema must be applied via
   migration (step 5 below) before the app can serve any request — there is
   no seed data required for production.
2. **External service credentials.** Obtain production credentials for
   Anthropic, Apify, and Firecrawl — see the environment checklist below for
   which variables each one maps to. Confirm the Apify actor configured via
   `APIFY_DISCOVERY_ACTOR_ID` is a pay-per-event actor, not a rental actor
   (the app checks this at runtime — `ApifyDiscoveryProvider.assertNotRentalActor`
   — but confirming it manually in the Apify console first avoids a surprise
   on the first real run).
3. **Application environment.** Set every variable below on the hosting
   platform (not in a committed file — `.env.local` is gitignored and must
   stay that way).
4. **Application deployment.** Standard Next.js production build
   (`npm run build` then `npm run start`, or the platform's equivalent —
   e.g. Vercel builds and serves this automatically once the repo is
   connected and the environment variables below are set).
5. **Database migration.** Run `npm run db:migrate` (`scripts/run-migrations.ts`)
   against the production `DATABASE_URL`. It's idempotent (tracks applied
   migrations in a `_migrations` table) and safe to re-run.
6. **Smoke tests.** See the Production Smoke Test checklist below.
7. **Controlled run.** Once the smoke test passes, the first real run should
   still use a small `discoveryLimit` (matching how every run this project
   was tested with during development stayed small) before trusting it with
   a full-size run — the app enforces `MAX_DISCOVERY_LIMIT` as a hard
   ceiling regardless, but starting small is still the right operational
   practice per BUILD-PLAN.md section 16.

## Environment checklist (BUILD-PLAN.md section 57)

Every variable in `.env.example` needs a real value set on the hosting
platform. The four marked **secret** must never be exposed to the browser —
this app already enforces that at the code level (`src/lib/config/env.ts`
is guarded by `import "server-only"`, and `src/lib/config/public-env.ts` is
the only module allowed to read `NEXT_PUBLIC_*` values), so this checklist
is about getting real values into the platform's environment settings, not
about code changes.

| Variable | Secret? | Source |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Console |
| `APIFY_API_TOKEN` | Yes | Apify Console → Integrations |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase → Project Settings → API |
| `DATABASE_URL` | Yes (connection string with credentials) | Supabase → Project Settings → Database → Connection string (URI) — used only by `scripts/run-migrations.ts`, never by the running app itself |
| `APP_ENV` | No | Set to `production` |
| `LOG_LEVEL` | No | `info` or `warn` in production |
| `DEFAULT_DISCOVERY_LIMIT` / `MAX_DISCOVERY_LIMIT` | No | Keep the defaults (`20`/`50`) unless there's a specific reason to change them — `MAX_DISCOVERY_LIMIT` is the hard ceiling the application enforces regardless of what any run requests |
| `APIFY_DISCOVERY_ACTOR_ID` | No | The pay-per-event actor id (e.g. `harvestapi/linkedin-company-search`, confirmed working during development) |
| `RESEARCH_PROVIDER` | No | `firecrawl` |

Also confirm:
- [ ] Database migrations applied (step 5 above)
- [ ] RLS policies active — they're part of the migrations (`002_row_level_security.sql`), so this is automatically true once migrations are applied; worth a manual spot-check (`npm run db:verify-rls`, added in the Phase 3 close-out) against the production project once credentials are live
- [ ] Server-only secret handling — already enforced in code, nothing to configure
- [ ] Application URL — whatever the hosting platform assigns (or a custom domain), no code-level configuration needed since the app doesn't hardcode its own origin anywhere

## Production Smoke Test (BUILD-PLAN.md section 58)

Run this after deployment, before trusting the app with a real assessment
run. This is the exact sequence this project's development live-testing has
already run dozens of times against the dev environment — repeating it here
is just confirming the production environment behaves the same way:

1. Open the deployed application.
2. Create a small run (`qualifiedTarget: 1`, `discoveryLimit: 2`).
3. Confirm ICP refinement produces a structured ICP for review.
4. Approve the ICP.
5. Confirm discovery executes against Apify (check the Apify console for the
   actual run and cost — should be a few cents at this scale).
6. Confirm research executes against Firecrawl for the discovered
   company/companies.
7. Confirm a qualification decision (`qualified`, `not_qualified`, or
   `needs_review`) is recorded with evidence.
8. Confirm the expected database records exist (`runs`, `run_icps`,
   `discovered_companies`, `leads`, `lead_sources`, `tool_calls`,
   `run_events`, and — if a lead qualified — `outreach_drafts`).
9. Confirm the Activity tab shows the run's event feed populated.
10. If a lead qualified, confirm outreach drafts were generated (3 email
    steps + 1 LinkedIn message) and are visible/editable in the Outreach
    tab.

Only proceed to a full-size run (BUILD-PLAN.md section 55, `qualifiedTarget: 10`)
after this passes.
