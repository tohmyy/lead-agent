import Link from "next/link";

import { ApprovedCriteriaStrip } from "@/components/runs/approved-criteria-strip";
import { CompaniesSection } from "@/components/runs/companies-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recordedSpend } from "@/domain/runs/spend";
import { formatUsd } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type {
  DiscoveredCompanyRow,
  IcpCriteria,
  LeadRow,
  LeadSourceRow,
  RunRow,
} from "@/infrastructure/supabase/types";

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function showPreservedWork(run: RunRow): boolean {
  if (run.status === "failed" || run.status === "cancelled") return true;
  return (
    (run.status === "awaiting_review" || run.status === "completed") &&
    run.qualified_count < run.qualified_target
  );
}

export function OverviewTab({
  run,
  companies,
  leads,
  sourcesByCompany,
  hardFilters,
}: {
  run: RunRow;
  companies: DiscoveredCompanyRow[];
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  hardFilters?: IcpCriteria["hard_filters"];
}) {
  const rejected = leads.filter(
    (l) => l.qualification_status === "not_qualified",
  ).length;
  const needsReview = leads.filter(
    (l) => l.qualification_status === "needs_review",
  ).length;
  const spend = recordedSpend(run);

  return (
    <div className="space-y-4">
      <ApprovedCriteriaStrip hardFilters={hardFilters} />

      {showPreservedWork(run) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {run.status === "failed"
                ? "Research run failed"
                : run.status === "cancelled"
                  ? "Research stopped"
                  : "Target not reached"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {run.status === "failed"
                ? "The agent could not finish this run. Completed work was kept."
                : run.status === "cancelled"
                  ? "This run ended early. Current progress was preserved."
                  : `The run ended before reaching the target of ${run.qualified_target} qualified leads.`}
            </p>
            <p className="text-muted-foreground">
              {companies.length} companies discovered · {run.qualified_count}{" "}
              qualified · {rejected} not qualified · discovery slots used{" "}
              {run.discovered_count} / {run.discovery_limit}
            </p>
            {run.error_message && (
              <p className="text-destructive">{run.error_message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/runs/${run.id}?tab=leads`}>Review leads</Link>
                }
              />
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={
                  <a href={`/runs/${run.id}/export/leads.csv`}>
                    Export approved leads
                  </a>
                }
              />
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={
                  <a href={`/runs/${run.id}/export/leads.csv?scope=all`}>
                    Export all qualified
                  </a>
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat
              label={`Qualified leads (of ${run.qualified_target})`}
              value={run.qualified_count}
              accent
            />
            <Stat
              label={`Companies discovered (of ${run.discovery_limit})`}
              value={companies.length}
            />
            <Stat label="Not qualified" value={rejected} />
            <Stat label="Needs review" value={needsReview} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Research limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Qualified target:{" "}
              <span className="font-medium">{run.qualified_target}</span>
            </p>
            <p>
              Discovery maximum:{" "}
              <span className="font-medium">{run.discovery_limit}</span>
            </p>
            <p>
              Discovery spend:{" "}
              <span className="font-medium">
                {formatUsd(spend.discoveryUsd)}
              </span>
            </p>
            <p>
              Agent spend:{" "}
              <span className="font-medium">{formatUsd(spend.agentUsd)}</span>
            </p>
            <p className="text-muted-foreground">
              The discovery maximum was set when this run was created and cannot
              be increased by the agent. Recorded spend is the sum of provider
              charges stored for this run.
            </p>
            {run.error_message && !showPreservedWork(run) && (
              <p className="text-destructive">{run.error_message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <CompaniesSection
        companies={companies}
        leads={leads}
        sourcesByCompany={sourcesByCompany}
      />
    </div>
  );
}
