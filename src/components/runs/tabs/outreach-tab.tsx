"use client";

import { useState, useTransition } from "react";

import {
  saveLeadNote,
  setOutreachReviewState,
  updateOutreachDraft,
} from "@/app/actions/review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { latestOutreachDrafts } from "@/domain/outreach/outreach";
import type {
  LeadRow,
  LeadSourceRow,
  OutreachDraftRow,
  RunRow,
} from "@/infrastructure/supabase/types";

function stepKey(draft: OutreachDraftRow): string {
  return draft.channel === "email" ? `email:${draft.step}` : "linkedin";
}

const STEP_ORDER = ["email:1", "email:2", "email:3", "linkedin"];

const STEP_LABEL: Record<string, string> = {
  "email:1": "Email 1",
  "email:2": "Email 2",
  "email:3": "Email 3",
  linkedin: "LinkedIn",
};

function DraftEditor({
  runId,
  draft,
  sources,
}: {
  runId: string;
  draft: OutreachDraftRow;
  sources: LeadSourceRow[];
}) {
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [pending, startTransition] = useTransition();

  const dirty = subject !== (draft.subject ?? "") || body !== draft.body;
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied by the browser; nothing more to do.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge
          variant={
            draft.review_state === "approved_for_export" ? "success" : "outline"
          }
        >
          {draft.review_state.replace(/_/g, " ")}
        </Badge>
      </div>
      {draft.channel === "email" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Subject</span>
            <Button variant="ghost" size="sm" onClick={() => copy(subject)}>
              Copy subject
            </Button>
          </div>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Body</span>
          <Button variant="ghost" size="sm" onClick={() => copy(body)}>
            Copy body
          </Button>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
      </div>
      {draft.personalization_context.claims.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-medium">Personalization claims</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {draft.personalization_context.claims.map((claim) => {
              const source = sourceById.get(claim.source_id);
              return (
                <li key={`${claim.source_id}:${claim.text}`}>
                  {claim.text}
                  {source && (
                    <>
                      {" "}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline underline-offset-2"
                      >
                        [source]
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No source-backed personalization claims were recorded for this draft.
        </p>
      )}
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

function OperatorNote({
  runId,
  lead,
}: {
  runId: string;
  lead: LeadRow;
}) {
  const [note, setNote] = useState(lead.operator_note ?? "");
  const [pending, startTransition] = useTransition();

  const dirty = note !== (lead.operator_note ?? "");

  return (
    <div className="space-y-1.5 border-t pt-4">
      <p className="text-sm font-medium">Operator note</p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Private notes for reviewers — the agent never reads this."
      />
      {dirty && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(() => saveLeadNote(runId, lead.id, note))
          }
        >
          Save note
        </Button>
      )}
    </div>
  );
}

export function OutreachTab({
  run,
  leads,
  outreachDrafts,
  sourcesByCompany,
  selectedLeadId,
  onSelectLead,
}: {
  run: RunRow;
  leads: LeadRow[];
  outreachDrafts: OutreachDraftRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
}) {
  const qualified = leads.filter((l) => l.qualification_status === "qualified");
  const selectedLead =
    qualified.find((l) => l.id === selectedLeadId) ?? qualified[0] ?? null;

  const drafts = selectedLead
    ? latestOutreachDrafts(
        outreachDrafts.filter((d) => d.lead_id === selectedLead.id),
      )
    : [];
  const draftsByStep = new Map(drafts.map((d) => [stepKey(d), d]));
  const availableSteps = STEP_ORDER.filter((key) => draftsByStep.has(key));
  // Called unconditionally (before the empty-state return below) so a run
  // that starts with zero qualified leads and later gets one via realtime
  // refresh doesn't change this component's hook-call order mid-lifetime.
  const [selectedStep, setSelectedStep] = useStepSelection(
    selectedLead?.id ?? "",
    availableSteps,
  );

  if (!selectedLead) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          Outreach drafts appear here once leads are qualified.
        </CardContent>
      </Card>
    );
  }

  const selectedDraft = selectedStep ? draftsByStep.get(selectedStep) : undefined;
  const sources = sourcesByCompany[selectedLead.discovered_company_id] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/leads.csv`}>Export approved CSV</a>
          }
        />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/leads.csv?scope=all`}>
              Export all qualified CSV
            </a>
          }
        />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/outreach.md`}>
              Export approved outreach
            </a>
          }
        />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/runs/${run.id}/export/outreach.md?scope=all`}>
              Export all outreach
            </a>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardContent className="divide-y p-0">
            {qualified.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => onSelectLead(lead.id)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  lead.id === selectedLead.id
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50",
                )}
              >
                {lead.company_name}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedLead.company_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableSteps.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Outreach has not been generated for this lead yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {availableSteps.map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={key === selectedStep ? "default" : "outline"}
                      onClick={() => setSelectedStep(key)}
                    >
                      {STEP_LABEL[key]}
                    </Button>
                  ))}
                </div>
                {selectedDraft && (
                  <DraftEditor
                    key={selectedDraft.id}
                    runId={run.id}
                    draft={selectedDraft}
                    sources={sources}
                  />
                )}
              </>
            )}
            <OperatorNote key={selectedLead.id} runId={run.id} lead={selectedLead} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Tracks which step is selected per lead so switching companies doesn't
 * carry over an unrelated step index, while switching steps for the same
 * lead persists across a re-render.
 */
function useStepSelection(
  leadId: string,
  availableSteps: string[],
): [string | null, (key: string) => void] {
  const [state, setState] = useState<{ leadId: string; step: string | null }>(
    () => ({ leadId, step: availableSteps[0] ?? null }),
  );

  if (state.leadId !== leadId) {
    const next = { leadId, step: availableSteps[0] ?? null };
    setState(next);
    return [next.step, (step: string) => setState({ leadId, step })];
  }

  if (state.step && !availableSteps.includes(state.step)) {
    const next = { leadId, step: availableSteps[0] ?? null };
    setState(next);
    return [next.step, (step: string) => setState({ leadId, step })];
  }

  return [state.step, (step: string) => setState({ leadId, step })];
}
