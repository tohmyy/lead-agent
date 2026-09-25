"use client";

import { useState, useTransition } from "react";

import { approveEditedIcp, regenerateIcp } from "@/app/actions/runs";
import { IcpCriteriaEditor } from "@/components/runs/tabs/icp-criteria-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { icpCriteriaSchema } from "@/domain/icp/icp";
import type { IcpCriteria, RunIcpRow, RunRow } from "@/infrastructure/supabase/types";

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
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [criteria, setCriteria] = useState<IcpCriteria>(
    () => displayed?.criteria ?? { hard_filters: [], soft_signals: [] },
  );
  // Tracks which ICP version `criteria` currently reflects, so it can be
  // reset during render (not in an effect) only when a different version
  // becomes the displayed one — not on every render, so in-progress chip
  // edits aren't clobbered.
  const [syncedIcpId, setSyncedIcpId] = useState(displayed?.id ?? null);
  if (displayed && displayed.id !== syncedIcpId) {
    setSyncedIcpId(displayed.id);
    setCriteria(displayed.criteria);
  }

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

  function openApprove() {
    const parsed = icpCriteriaSchema.safeParse(criteria);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Criteria are not valid.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  function confirmStart() {
    if (!latest) return;
    const parsed = icpCriteriaSchema.safeParse(criteria);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Criteria are not valid.");
      setConfirming(false);
      return;
    }
    startTransition(async () => {
      await approveEditedIcp(run.id, latest.id, parsed.data);
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Original objective</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            &ldquo;{run.objective}&rdquo;
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Refined ICP{" "}
            {approvedIcp ? (
              <Badge variant="success" className="ml-2">
                Approved
              </Badge>
            ) : (
              <Badge variant="warning" className="ml-2">
                Awaiting approval
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <IcpCriteriaEditor
            criteria={criteria}
            onChange={setCriteria}
            readOnly={!canApprove}
            disabled={pending}
          />

          {error && <p className="text-destructive text-sm">{error}</p>}

          {displayed.reasoning && (
            <p className="text-muted-foreground border-t pt-3 text-sm">
              {displayed.reasoning}
            </p>
          )}

          {canApprove && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={openApprove} disabled={pending}>
                Approve &amp; Start Search
              </Button>
              <Button
                variant="outline"
                loading={pending}
                onClick={() => startTransition(() => regenerateIcp(run.id))}
              >
                Regenerate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start research?</DialogTitle>
            <DialogDescription>
              Target qualified leads: {run.qualified_target}. Maximum companies
              to discover: {run.discovery_limit}. Once started, the agent will
              use the configured research tools within these limits. These
              limits cannot be raised.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={confirmStart} loading={pending}>
              Start research
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
