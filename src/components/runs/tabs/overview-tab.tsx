import Link from "next/link";

import { ApprovedCriteriaStrip } from "@/components/runs/approved-criteria-strip";
import { CompaniesSection } from "@/components/runs/companies-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunProgress } from "@/domain/runs/run-progress";
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

const TONE_CLASS = {
  success: "text-success",
  primary: "text-primary",
  info: "text-info",
  warning: "text-warning-foreground",
  muted: "text-muted-foreground",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone && TONE_CLASS[tone],
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

export function OverviewTab({
  run,
  progress,
  companies,
  leads,
  sourcesByCompany,
  hardFilters,
}: {
  run: RunRow;
  progress: RunProgress;
  companies: DiscoveredCompanyRow[];
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  hardFilters?: IcpCriteria["hard_filters"];
}) {
  const rejected = progress.rejectedCount;
  const needsReview = leads.filter(
    (l) => l.qualification_status === "needs_review",
  ).length;
  const spend = recordedSpend(run);
  const showPreservedWork =
    run.status === "failed" ||
    run.status === "cancelled" ||
    progress.banners.targetShortfall;

  return (
    <div className="space-y-4">
      <ApprovedCriteriaStrip hardFilters={hardFilters} />

      {progress.currentActivity && (
        <p className="text-muted-foreground text-sm">
          {progress.currentActivity}
        </p>
      )}

      {progress.banners.discoveryCapReached && (
        <Alert>
          <AlertTitle>Discovery limit reached</AlertTitle>
          <AlertDescription>
            {progress.discoveredCount} / {progress.discoveryLimit} companies
            discovered, {progress.qualifiedCount} / {progress.qualifiedTarget}{" "}
            qualified — no further companies can be discovered for this run.
          </AlertDescription>
        </Alert>
      )}

      {progress.banners.qualityIssueMessage && (
        <Alert variant="destructive">
          <AlertTitle>Quality check</AlertTitle>
          <AlertDescription>
            {progress.banners.qualityIssueMessage}
          </AlertDescription>
        </Alert>
      )}

      {showPreservedWork && (
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
            {progress.banners.failed && (
              <p className="text-destructive">
                {progress.banners.failed.message}
              </p>
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
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat
              label={`Qualified leads (of ${run.qualified_target})`}
              value={run.qualified_count}
              tone="success"
            />
            <Stat
              label={`Companies discovered (of ${run.discovery_limit})`}
              value={companies.length}
              tone="primary"
            />
            <Stat
              label="Researched"
              value={progress.researchedCount}
              tone="info"
            />
            <Stat label="Not qualified" value={rejected} tone="muted" />
            <Stat label="Needs review" value={needsReview} tone="warning" />
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
            {run.error_message && !showPreservedWork && (
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
