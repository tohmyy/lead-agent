"use client";

import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useEmblaSnapshot,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DraftEditor,
  OperatorNote,
  STEP_LABEL,
  STEP_ORDER,
  stepKey,
  useStepSelection,
} from "@/components/runs/tabs/outreach-draft-editor";
import { latestOutreachDrafts } from "@/domain/outreach/outreach";
import { cn } from "@/lib/utils";
import type {
  LeadRow,
  LeadSourceRow,
  OutreachDraftRow,
} from "@/infrastructure/supabase/types";

function OutreachSlide({
  runId,
  lead,
  outreachDrafts,
  sources,
}: {
  runId: string;
  lead: LeadRow;
  outreachDrafts: OutreachDraftRow[];
  sources: LeadSourceRow[];
}) {
  const drafts = latestOutreachDrafts(
    outreachDrafts.filter((d) => d.lead_id === lead.id),
  );
  const draftsByStep = new Map(drafts.map((d) => [stepKey(d), d]));
  const availableSteps = STEP_ORDER.filter((key) => draftsByStep.has(key));
  const [selectedStep, setSelectedStep] = useStepSelection(
    lead.id,
    availableSteps,
  );
  const selectedDraft = selectedStep ? draftsByStep.get(selectedStep) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lead.company_name}</CardTitle>
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
                runId={runId}
                draft={selectedDraft}
                sources={sources}
              />
            )}
          </>
        )}
        <OperatorNote key={lead.id} runId={runId} lead={lead} />
      </CardContent>
    </Card>
  );
}

export function OutreachCarousel({
  runId,
  qualified,
  outreachDrafts,
  sourcesByCompany,
  selectedLeadId,
  onSelectLead,
}: {
  runId: string;
  qualified: LeadRow[];
  outreachDrafts: OutreachDraftRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
}) {
  const [api, setApi] = useState<CarouselApi>(undefined);
  const current = useEmblaSnapshot(api, (a) => a.selectedScrollSnap(), 0);

  // Move the carousel to match an externally-selected lead (e.g. "view
  // outreach" from the Leads tab). No local state to set here — `current`
  // above already re-derives from embla's own "select" event once this
  // scrollTo takes effect.
  useEffect(() => {
    if (!api || !selectedLeadId) return;
    const index = qualified.findIndex((l) => l.id === selectedLeadId);
    if (index === -1 || index === api.selectedScrollSnap()) return;
    api.scrollTo(index, true);
  }, [api, selectedLeadId, qualified]);

  // Tell the parent when the carousel's current slide (from a drag or the
  // prev/next arrows) no longer matches the externally-known selection.
  useEffect(() => {
    if (!api) return;
    const lead = qualified[current];
    if (lead && lead.id !== selectedLeadId) onSelectLead(lead.id);
  }, [api, current, qualified, selectedLeadId, onSelectLead]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {qualified.map((lead, index) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => {
              onSelectLead(lead.id);
              api?.scrollTo(index);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              index === current
                ? "bg-accent border-accent-foreground/20 font-medium"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {lead.company_name}
          </button>
        ))}
      </div>

      <Carousel setApi={setApi} opts={{ watchDrag: false }}>
        <CarouselContent>
          {qualified.map((lead) => (
            <CarouselItem key={lead.id}>
              <OutreachSlide
                runId={runId}
                lead={lead}
                outreachDrafts={outreachDrafts}
                sources={sourcesByCompany[lead.discovered_company_id] ?? []}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-3 flex items-center justify-center gap-3">
          <CarouselPrevious />
          <span className="text-muted-foreground text-sm tabular-nums">
            {current + 1} of {qualified.length}
          </span>
          <CarouselNext />
        </div>
      </Carousel>
    </div>
  );
}
