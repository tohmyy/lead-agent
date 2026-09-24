import Link from "next/link";

import { RunService } from "@/application/runs/run-service";
import { AppShell } from "@/components/layout/app-shell";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUserId } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format-date";

// Reads the signed-in user's session and their runs on every request —
// never statically prerendered (there's no meaningful build-time version
// of a per-user dashboard).
export const dynamic = "force-dynamic";

const runService = new RunService();

export default async function DashboardPage() {
  const userId = await requireCurrentUserId();
  const runs = await runService.listRunsForUser(userId);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recent Research
        </h1>
        <Button
          nativeButton={false}
          render={<Link href="/runs/new">+ New Research</Link>}
        />
      </div>

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
                    <CardTitle className="line-clamp-2 text-base font-medium">
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
