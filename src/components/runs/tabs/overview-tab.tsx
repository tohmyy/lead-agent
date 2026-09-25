import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DiscoveredCompanyRow,
  LeadRow,
  RunRow,
} from "@/infrastructure/supabase/types";
import { cn } from "@/lib/utils";

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

export function OverviewTab({
  run,
  companies,
  leads,
}: {
  run: RunRow;
  companies: DiscoveredCompanyRow[];
  leads: LeadRow[];
}) {
  const rejected = leads.filter(
    (l) => l.qualification_status === "not_qualified",
  ).length;
  const needsReview = leads.filter(
    (l) => l.qualification_status === "needs_review",
  ).length;

  return (
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
          <p className="text-muted-foreground">
            The discovery maximum was set when this run was created and cannot
            be increased by the agent.
          </p>
          {run.error_message && (
            <p className="text-destructive">{run.error_message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
