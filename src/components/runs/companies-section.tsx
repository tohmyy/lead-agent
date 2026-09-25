"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  companyResearchOutcome,
  type CompanyResearchOutcome,
} from "@/domain/companies/company";
import type {
  DiscoveredCompanyRow,
  LeadRow,
  LeadSourceRow,
} from "@/infrastructure/supabase/types";

const OUTCOME_LABEL: Record<CompanyResearchOutcome, string> = {
  not_researched: "Not researched yet",
  qualified: "Qualified",
  not_qualified: "Not qualified",
  needs_review: "Needs review",
};

const OUTCOME_VARIANT: Record<
  CompanyResearchOutcome,
  "outline" | "success" | "warning"
> = {
  not_researched: "outline",
  qualified: "success",
  not_qualified: "outline",
  needs_review: "warning",
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

export function CompaniesSection({
  companies,
  leads,
  sourcesByCompany,
}: {
  companies: DiscoveredCompanyRow[];
  leads: LeadRow[];
  sourcesByCompany: Record<string, LeadSourceRow[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    companies.find((company) => company.id === selectedId) ?? null;
  const sources = selected ? (sourcesByCompany[selected.id] ?? []) : [];

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discovered companies</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Companies appear here as discovery finds them, including ones that
          have not been qualified yet.
        </CardContent>
      </Card>
    );
  }

  const grouped = new Map<LeadSourceRow["source_type"], LeadSourceRow[]>();
  for (const source of sources) {
    const list = grouped.get(source.source_type) ?? [];
    list.push(source);
    grouped.set(source.source_type, list);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Discovered companies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const outcome = companyResearchOutcome(company.id, leads);
                return (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(company.id)}
                  >
                    <TableCell className="font-medium">
                      {company.company_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.domain}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.discovery_source}
                    </TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME_VARIANT[outcome]}>
                        {OUTCOME_LABEL[outcome]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.company_name}</SheetTitle>
                <p className="text-muted-foreground text-sm">
                  {selected.domain}
                </p>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <Badge
                  variant={
                    OUTCOME_VARIANT[companyResearchOutcome(selected.id, leads)]
                  }
                >
                  {OUTCOME_LABEL[companyResearchOutcome(selected.id, leads)]}
                </Badge>
                {sources.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No website sources recorded yet.
                  </p>
                ) : (
                  Array.from(grouped.entries()).map(([type, items]) => (
                    <div key={type}>
                      <h3 className="mb-2 text-sm font-medium">
                        {SOURCE_TYPE_LABEL[type]}
                      </h3>
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
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
