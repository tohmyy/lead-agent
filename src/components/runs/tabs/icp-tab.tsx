"use client";

import { useState, useTransition } from "react";

import {
  approveEditedIcp,
  approveIcp,
  regenerateIcp,
} from "@/app/actions/runs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { RunIcpRow, RunRow } from "@/infrastructure/supabase/types";

function CriteriaList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function IcpTab({
  run,
  icpVersions,
  approvedIcp,
}: {
  run: RunRow;
  icpVersions: RunIcpRow[];
  approvedIcp: RunIcpRow | null;
}) {
  const latest = icpVersions.at(-1) ?? null;
  const displayed = approvedIcp ?? latest;
  const [editing, setEditing] = useState(false);
  const [draftJson, setDraftJson] = useState(() =>
    displayed ? JSON.stringify(displayed.criteria, null, 2) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canApprove =
    run.status === "awaiting_icp_approval" && latest && !latest.approved;

  if (!displayed) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          {run.status === "awaiting_icp_approval" || run.status === "draft"
            ? "Analyzing the qualification objective and identifying geography, company size, industry, and qualification signals…"
            : "No ICP has been generated for this run."}
        </CardContent>
      </Card>
    );
  }

  const c = displayed.criteria;

  function handleApprove() {
    if (!latest) return;
    startTransition(() => approveIcp(run.id, latest.id));
  }

  function handleSaveEdit() {
    if (!latest) return;
    setError(null);
    try {
      const parsed = JSON.parse(draftJson);
      startTransition(async () => {
        await approveEditedIcp(run.id, latest.id, parsed);
        setEditing(false);
      });
    } catch {
      setError("Invalid JSON — please fix the criteria before saving.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Original objective</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            &ldquo;{run.objective}&rdquo;
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Refined ICP{" "}
            {approvedIcp ? (
              <Badge className="ml-2">Approved</Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">
                Awaiting approval
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                rows={16}
                className="font-mono text-xs"
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          ) : (
            <>
              <CriteriaList title="Geography" items={c.geography?.include} />
              <CriteriaList title="Industry" items={c.industry?.include} />
              {c.employee_range && (
                <p className="text-sm">
                  <span className="font-medium">Employee range:</span>{" "}
                  {c.employee_range.min ?? "?"}
                  {"–"}
                  {c.employee_range.max ?? "?"}
                </p>
              )}
              <CriteriaList
                title="Business model"
                items={c.business_model?.include}
              />
              <CriteriaList title="Target personas" items={c.target_personas} />
              <CriteriaList
                title="Hard filters (must match)"
                items={c.hard_filters}
              />
              <CriteriaList
                title="Soft signals (evidence of fit)"
                items={c.soft_signals}
              />
              {displayed.reasoning && (
                <p className="text-muted-foreground border-t pt-3 text-sm">
                  {displayed.reasoning}
                </p>
              )}
            </>
          )}

          {canApprove && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {editing ? (
                <>
                  <Button onClick={handleSaveEdit} disabled={pending}>
                    Save &amp; Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleApprove} disabled={pending}>
                    Approve &amp; Start Search
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    disabled={pending}
                  >
                    Edit Criteria
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startTransition(() => regenerateIcp(run.id))}
                    disabled={pending}
                  >
                    Regenerate
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
