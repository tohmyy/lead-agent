"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OutreachCarousel } from "@/components/runs/outreach-carousel";
import type {
  LeadRow,
  LeadSourceRow,
  OutreachDraftRow,
  RunRow,
} from "@/infrastructure/supabase/types";

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

      {qualified.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center">
            Outreach drafts appear here once leads are qualified.
          </CardContent>
        </Card>
      ) : (
        <OutreachCarousel
          runId={run.id}
          qualified={qualified}
          outreachDrafts={outreachDrafts}
          sourcesByCompany={sourcesByCompany}
          selectedLeadId={selectedLeadId}
          onSelectLead={onSelectLead}
        />
      )}
    </div>
  );
}
