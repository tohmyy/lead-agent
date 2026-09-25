"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RunActions } from "@/components/runs/run-actions";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRunActive } from "@/domain/runs/run";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { formatDateTime } from "@/lib/format-date";
import type {
  DiscoveredCompanyRow,
  LeadRow,
  LeadSourceRow,
  OutreachDraftRow,
  RunEventRow,
  RunIcpRow,
  RunRow,
  ToolCallRow,
} from "@/infrastructure/supabase/types";
import { ActivityTab } from "./tabs/activity-tab";
import { IcpTab } from "./tabs/icp-tab";
import { LeadsTab } from "./tabs/leads-tab";
import { OutreachTab } from "./tabs/outreach-tab";
import { OverviewTab } from "./tabs/overview-tab";

/** Tables relevant to an active run's detail view (BUILD-PLAN.md section 50). */
const REALTIME_RUN_ID_TABLES = [
  "run_events",
  "tool_calls",
  "leads",
  "outreach_drafts",
] as const;

const REALTIME_DEBOUNCE_MS = 400;
/** Safety net if the WebSocket connection silently drops — realtime handles the common case. */
const FALLBACK_POLL_MS = 20_000;

const WORKSPACE_TABS = [
  "overview",
  "icp",
  "activity",
  "leads",
  "outreach",
] as const;

function resolveTab(
  value: string | undefined,
): (typeof WORKSPACE_TABS)[number] {
  return WORKSPACE_TABS.includes(value as (typeof WORKSPACE_TABS)[number])
    ? (value as (typeof WORKSPACE_TABS)[number])
    : "overview";
}

export function RunWorkspace(props: {
  run: RunRow;
  icpVersions: RunIcpRow[];
  approvedIcp: RunIcpRow | null;
  companies: DiscoveredCompanyRow[];
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  events: RunEventRow[];
  toolCalls: ToolCallRow[];
  outreachDrafts: OutreachDraftRow[];
  initialTab?: string;
}) {
  const { run } = props;
  const router = useRouter();

  // Realtime refresh while the run is still active (BUILD-PLAN.md section
  // 50): a Supabase channel pushes an update the moment something relevant
  // actually changes, instead of polling blindly on a timer. Debounced
  // since several tool calls commonly land within the same second during
  // active research. A much lighter fallback poll stays alongside it as a
  // safety net in case the WebSocket connection silently drops.
  useEffect(() => {
    if (!isRunActive(run.status)) return;

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => router.refresh(), REALTIME_DEBOUNCE_MS);
    };

    (async () => {
      // createBrowserSupabaseClient's session is hydrated from cookies
      // asynchronously (@supabase/ssr). Subscribing before that resolves
      // authenticates the realtime connection as anonymous — the JOIN
      // still succeeds (accepting a subscription doesn't require a valid
      // user), but every broadcast is then silently dropped by RLS with no
      // visible error. Confirmed live: without this, "Subscribed to
      // PostgreSQL" comes back fine and heartbeats flow, but zero change
      // events ever arrive despite real writes happening. Explicitly
      // resolving the session and setting realtime auth before subscribing
      // fixes it.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase.channel(`run-${run.id}`);
      for (const table of REALTIME_RUN_ID_TABLES) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `run_id=eq.${run.id}`,
          },
          scheduleRefresh,
        );
      }
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "runs",
          filter: `id=eq.${run.id}`,
        },
        scheduleRefresh,
      );
      channel.subscribe();
    })();

    const fallback = setInterval(() => router.refresh(), FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      clearInterval(fallback);
      if (channel) supabase.removeChannel(channel);
    };
  }, [run.id, run.status, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading max-w-2xl tracking-tight">
            {run.objective}
          </h1>
          <p className="text-muted-foreground text-sm">
            Created {formatDateTime(run.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RunActions run={run} />
          <RunStatusBadge status={run.status} />
        </div>
      </div>

      <Tabs
        key={resolveTab(props.initialTab)}
        defaultValue={resolveTab(props.initialTab)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="icp">ICP</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="leads">
            Leads (
            {
              props.leads.filter((l) => l.qualification_status === "qualified")
                .length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            run={run}
            companies={props.companies}
            leads={props.leads}
            sourcesByCompany={props.sourcesByCompany}
            hardFilters={props.approvedIcp?.criteria.hard_filters}
          />
        </TabsContent>
        <TabsContent value="icp">
          <IcpTab
            run={run}
            icpVersions={props.icpVersions}
            approvedIcp={props.approvedIcp}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab events={props.events} toolCalls={props.toolCalls} />
        </TabsContent>
        <TabsContent value="leads">
          <LeadsTab
            run={run}
            leads={props.leads}
            sourcesByCompany={props.sourcesByCompany}
            hardFilters={props.approvedIcp?.criteria.hard_filters}
          />
        </TabsContent>
        <TabsContent value="outreach">
          <OutreachTab
            run={run}
            leads={props.leads}
            outreachDrafts={props.outreachDrafts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
