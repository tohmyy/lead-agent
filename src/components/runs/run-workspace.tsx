"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RunActions } from "@/components/runs/run-actions";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const ACTIVE_STATUSES = new Set([
  "awaiting_icp_approval",
  "researching",
  "generating_outreach",
]);

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
}) {
  const { run } = props;
  const router = useRouter();

  // Simple polling refresh while the run is still active, so progress
  // (discovered/qualified counts, activity feed, leads) shows up without a
  // manual reload — the deferred follow-up pass upgrades this to Supabase
  // Realtime (see the implementation plan's scope note).
  useEffect(() => {
    if (!ACTIVE_STATUSES.has(run.status)) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [run.status, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="max-w-2xl text-xl font-semibold tracking-tight">
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

      <Tabs defaultValue="overview">
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
