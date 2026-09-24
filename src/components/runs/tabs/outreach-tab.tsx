"use client";

import { useState, useTransition } from "react";

import {
  setOutreachReviewState,
  updateOutreachDraft,
} from "@/app/actions/review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  LeadRow,
  OutreachDraftRow,
  RunRow,
} from "@/infrastructure/supabase/types";

function DraftEditor({
  runId,
  draft,
}: {
  runId: string;
  draft: OutreachDraftRow;
}) {
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [pending, startTransition] = useTransition();

  const label = draft.channel === "email" ? `Email ${draft.step}` : "LinkedIn";
  const dirty = subject !== (draft.subject ?? "") || body !== draft.body;

  return (
    <div className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge
          variant={
            draft.review_state === "approved_for_export" ? "default" : "outline"
          }
        >
          {draft.review_state.replace(/_/g, " ")}
        </Badge>
      </div>
      {draft.channel === "email" && (
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
      />
      <div className="flex flex-wrap gap-2">
        {dirty && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateOutreachDraft(runId, draft.id, {
                  subject: draft.channel === "email" ? subject : undefined,
                  body,
                });
              })
            }
          >
            Save edit
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || draft.review_state === "approved_for_export"}
          onClick={() =>
            startTransition(() =>
              setOutreachReviewState(runId, draft.id, "reviewed"),
            )
          }
        >
          Mark reviewed
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || draft.review_state === "approved_for_export"}
          onClick={() =>
            startTransition(() =>
              setOutreachReviewState(runId, draft.id, "approved_for_export"),
            )
          }
        >
          Approve for export
        </Button>
      </div>
    </div>
  );
}

export function OutreachTab({
  run,
  leads,
  outreachDrafts,
}: {
  run: RunRow;
  leads: LeadRow[];
  outreachDrafts: OutreachDraftRow[];
}) {
  const qualified = leads.filter((l) => l.qualification_status === "qualified");

  if (qualified.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          Outreach drafts appear here once leads are qualified.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/leads.csv`}>Export leads CSV</a>
          }
        />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/outreach.md`}>
              Export outreach pack
            </a>
          }
        />
      </div>

      {qualified.map((lead) => {
        const drafts = outreachDrafts
          .filter((d) => d.lead_id === lead.id)
          .sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

        return (
          <Card key={lead.id}>
            <CardHeader>
              <CardTitle className="text-base">{lead.company_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {drafts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Outreach has not been generated for this lead yet.
                </p>
              ) : (
                drafts.map((draft) => (
                  <DraftEditor key={draft.id} runId={run.id} draft={draft} />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
