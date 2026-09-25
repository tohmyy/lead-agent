"use client";

import { useState, useTransition } from "react";

import { setLeadReviewState } from "@/app/actions/review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LeadRow,
  LeadSourceRow,
  RunRow,
} from "@/infrastructure/supabase/types";

const STATUS_LABEL: Record<LeadRow["qualification_status"], string> = {
  qualified: "Qualified",
  not_qualified: "Not qualified",
  needs_review: "Needs review",
};

export function LeadsTab({
  run,
  leads,
  sourcesByCompany,
}: {
  run: RunRow;
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const qualified = leads.filter((l) => l.qualification_status === "qualified");
  const visible = showAll ? leads : qualified;
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          {run.status === "researching"
            ? "No companies qualified yet — research is still in progress."
            : "No companies matched the qualification criteria. Review the research activity or refine the ICP and start another run."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {qualified.length} qualified
        </p>
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? "Show qualified only"
            : `Show reviewed / not qualified (${leads.length - qualified.length})`}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Review state</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((lead) => (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => setSelectedLeadId(lead.id)}
              >
                <TableCell className="font-medium">
                  {lead.company_name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.qualification_status === "qualified"
                        ? "default"
                        : lead.qualification_status === "needs_review"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {STATUS_LABEL[lead.qualification_status]}
                  </Badge>
                </TableCell>
                <TableCell
                  title="Confidence in this assessment — not a measure of sales priority, conversion likelihood, or company quality."
                >
                  {lead.confidence_score !== null
                    ? `${lead.confidence_score}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.domain}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.review_state}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedLead && (
            <LeadDetail
              runId={run.id}
              lead={selectedLead}
              sources={
                sourcesByCompany[selectedLead.discovered_company_id] ?? []
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LeadDetail({
  runId,
  lead,
  sources,
}: {
  runId: string;
  lead: LeadRow;
  sources: LeadSourceRow[];
}) {
  const [pending, startTransition] = useTransition();
  const fitReasons = lead.fit_reasons ?? [];
  const concerns = lead.concerns ?? [];

  return (
    <>
      <SheetHeader>
        <SheetTitle>{lead.company_name}</SheetTitle>
        <p className="text-muted-foreground text-sm">{lead.domain}</p>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <div className="flex items-center gap-2">
          <Badge>{STATUS_LABEL[lead.qualification_status]}</Badge>
          {lead.confidence_score !== null && (
            <span className="text-muted-foreground text-sm">
              {lead.confidence_score}% confidence
            </span>
          )}
        </div>
        {lead.confidence_score !== null && (
          <p className="text-muted-foreground text-xs">
            Confidence in this assessment — not a measure of sales priority,
            conversion likelihood, or company quality.
          </p>
        )}

        {fitReasons.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Why it fits</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {fitReasons.map((r, i) => (
                <li key={i}>{r.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {concerns.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Concerns</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {concerns.map((c, i) => (
                <li key={i}>
                  {c.concern}{" "}
                  <span className="text-muted-foreground">({c.severity})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-medium">Source context</h3>
          <p className="text-muted-foreground text-sm">{lead.source_summary}</p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Qualification reasoning</h3>
          <p className="text-muted-foreground text-sm">
            {lead.qualification_reasoning}
          </p>
        </div>

        {sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Sources</h3>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    {s.title || s.url}
                  </a>
                  <p className="text-muted-foreground">{s.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                setLeadReviewState(runId, lead.id, "reviewed"),
              )
            }
          >
            Mark reviewed
          </Button>
        </div>
      </div>
    </>
  );
}
