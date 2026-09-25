import Link from "next/link";

import { RunService } from "@/application/runs/run-service";
import { AppShell } from "@/components/layout/app-shell";
import {
  RunStatusBadge,
  STATUS_DISPLAY,
} from "@/components/runs/run-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRunActive } from "@/domain/runs/run";
import type { RunRow, RunStatus } from "@/infrastructure/supabase/types";
import { requireCurrentUserId } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

// Reads the signed-in user's session and their runs on every request —
// never statically prerendered (there's no meaningful build-time version
// of a per-user dashboard).
export const dynamic = "force-dynamic";

const runService = new RunService();

/**
 * Run History (BUILD-PLAN.md section 43/50) — this Dashboard doubles as
 * both screens rather than a separate URL, which is fine since the build
 * plan's screen list is a checklist of required content, not a mandate for
 * separate pages. "active" is a synthetic grouping (not a real RunStatus)
 * covering every non-terminal, non-awaiting-review state.
 */
const STATUS_FILTERS: Array<{ label: string; value: RunStatus | "active" | "all" }> = [
  { label: "All", value: "all" },
  { label: "In progress", value: "active" },
  { label: STATUS_DISPLAY.awaiting_review.label, value: "awaiting_review" },
  { label: STATUS_DISPLAY.completed.label, value: "completed" },
  { label: STATUS_DISPLAY.failed.label, value: "failed" },
  { label: STATUS_DISPLAY.cancelled.label, value: "cancelled" },
];

function matchesFilter(run: RunRow, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isRunActive(run.status);
  return run.status === filter;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const allRuns = await runService.listRunsForUser(userId);
  const { status } = await searchParams;
  const activeFilter = status ?? "all";
  const runs = allRuns.filter((run) => matchesFilter(run, activeFilter));

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-display tracking-tight">Recent Research</h1>
        <Button
          nativeButton={false}
          render={<Link href="/runs/new">+ New Research</Link>}
        />
      </div>

      {allRuns.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/" : `/?status=${f.value}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                activeFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">No research runs yet.</p>
            <Button
              nativeButton={false}
              render={
                <Link href="/runs/new">Start your first research run</Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2">
                      {run.objective}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <RunStatusBadge status={run.status} />
                  <p className="text-muted-foreground text-sm">
                    {run.qualified_count} / {run.qualified_target} qualified
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(run.created_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
