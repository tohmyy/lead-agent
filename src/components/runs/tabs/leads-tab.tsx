"use client";

import { useState, useTransition } from "react";

import { setLeadReviewState } from "@/app/actions/review";
import { ApprovedCriteriaStrip } from "@/components/runs/approved-criteria-strip";
import { ReviewStateBadge } from "@/components/runs/review-state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  employeeCountFromMetadata,
  industryFromMetadata,
  locationFromMetadata,
} from "@/domain/leads/lead";
import type {
  HardFilterResult,
  LeadRow,
  LeadSourceRow,
  RunRow,
} from "@/infrastructure/supabase/types";

const STATUS_LABEL: Record<LeadRow["qualification_status"], string> = {
  qualified: "Qualified",
  not_qualified: "Not qualified",
  needs_review: "Needs review",
};

/** UI-SPEC.md section 36: Qualified -> success, Needs review -> warning, Not qualified -> neutral. */
const STATUS_VARIANT: Record<
  LeadRow["qualification_status"],
  "success" | "warning" | "outline"
> = {
  qualified: "success",
  needs_review: "warning",
  not_qualified: "outline",
};

const FILTER_VARIANT: Record<
  HardFilterResult["result"],
  "success" | "destructive" | "warning"
> = {
  pass: "success",
  fail: "destructive",
  unknown: "warning",
};

const SOURCE_TYPE_LABEL: Record<LeadSourceRow["source_type"], string> = {
  homepage: "Homepage",
  about: "About",
  product: "Product",
  services: "Services",
  pricing: "Pricing",
  careers: "Careers",
  blog: "Blog",
  other: "Other",
};

export function LeadsTab({
  run,
  leads,
  sourcesByCompany,
  hardFilters,
  onViewOutreach,
}: {
  run: RunRow;
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
  hardFilters?: string[];
  onViewOutreach?: (leadId: string) => void;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  const qualified = leads.filter((l) => l.qualification_status === "qualified");
  const scoped = showAll ? leads : qualified;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? scoped.filter(
        (l) =>
          l.company_name.toLowerCase().includes(normalizedQuery) ||
          l.domain.toLowerCase().includes(normalizedQuery),
      )
    : scoped;
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
      <ApprovedCriteriaStrip hardFilters={hardFilters} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {qualified.length} qualified
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or domain"
            className="w-56"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? "Show qualified only"
              : `Show reviewed / not qualified (${leads.length - qualified.length})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={`/runs/${run.id}/export/leads.csv?scope=all`}>
                Export qualified (CSV)
              </a>
            }
          />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={`/runs/${run.id}/export/leads.csv?scope=all&status=all`}>
                Export all leads (CSV)
              </a>
            }
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Employees</TableHead>
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
                  <Badge variant={STATUS_VARIANT[lead.qualification_status]}>
                    {STATUS_LABEL[lead.qualification_status]}
                  </Badge>
                </TableCell>
                <TableCell title="Confidence in this assessment — not a measure of sales priority, conversion likelihood, or company quality.">
                  {lead.confidence_score !== null
                    ? `${lead.confidence_score}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {industryFromMetadata(lead.research_metadata) ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {employeeCountFromMetadata(lead.research_metadata) ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.domain}
                </TableCell>
                <TableCell>
                  <ReviewStateBadge state={lead.review_state} />
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
              onViewOutreach={onViewOutreach}
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
  onViewOutreach,
}: {
  runId: string;
  lead: LeadRow;
  sources: LeadSourceRow[];
  onViewOutreach?: (leadId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const fitReasons = lead.fit_reasons ?? [];
  const concerns = lead.concerns ?? [];
  const industry = industryFromMetadata(lead.research_metadata);
  const employees = employeeCountFromMetadata(lead.research_metadata);
  const location = locationFromMetadata(lead.research_metadata);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{lead.company_name}</SheetTitle>
        <p className="text-muted-foreground text-sm">{lead.domain}</p>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[lead.qualification_status]}>
            {STATUS_LABEL[lead.qualification_status]}
          </Badge>
          <ReviewStateBadge state={lead.review_state} />
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

        <div>
          <h3 className="mb-2 text-sm font-medium">Company</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Industry</dt>
            <dd>{industry ?? "—"}</dd>
            <dt className="text-muted-foreground">Employees</dt>
            <dd>{employees ?? "—"}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd>{location ?? "—"}</dd>
            <dt className="text-muted-foreground">Domain</dt>
            <dd>{lead.domain}</dd>
          </dl>
        </div>

        {(lead.hard_filter_results ?? []).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Hard filters</h3>
            <ul className="space-y-2">
              {lead.hard_filter_results.map((item) => (
                <li key={item.filter} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{item.filter}</span>
                    <Badge variant={FILTER_VARIANT[item.result]}>
                      {item.result}
                    </Badge>
                  </div>
                  {item.evidence && (
                    <p className="text-muted-foreground">{item.evidence}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {fitReasons.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Why it fits</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {fitReasons.map((reason, i) => (
                <li key={i}>
                  {reason.reason}
                  {reason.evidence && (
                    <p className="text-muted-foreground">{reason.evidence}</p>
                  )}
                </li>
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
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Sources</h3>
            {Array.from(groupSources(sources).entries()).map(
              ([type, items]) => (
                <div key={type}>
                  <p className="text-muted-foreground mb-1 text-xs">
                    {SOURCE_TYPE_LABEL[type]}
                  </p>
                  <ul className="space-y-2">
                    {items.map((source) => (
                      <li key={source.id} className="text-sm">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline underline-offset-2"
                        >
                          {source.title || source.url}
                        </a>
                        <p className="text-muted-foreground">
                          {source.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}

        <div className="flex gap-2 border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            disabled={pending || lead.review_state !== "not_reviewed"}
            onClick={() =>
              startTransition(() =>
                setLeadReviewState(runId, lead.id, "reviewed"),
              )
            }
          >
            Mark reviewed
          </Button>
          {lead.qualification_status === "qualified" && onViewOutreach && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewOutreach(lead.id)}
            >
              View outreach
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function groupSources(sources: LeadSourceRow[]) {
  const grouped = new Map<LeadSourceRow["source_type"], LeadSourceRow[]>();
  for (const source of sources) {
    const list = grouped.get(source.source_type) ?? [];
    list.push(source);
    grouped.set(source.source_type, list);
  }
  return grouped;
}
