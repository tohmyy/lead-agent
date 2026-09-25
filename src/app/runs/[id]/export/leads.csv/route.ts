import { NextResponse } from "next/server";

import { RunService } from "@/application/runs/run-service";
import { leadsForExport, parseExportScope } from "@/domain/outreach/outreach";
import { AppError } from "@/domain/shared/errors";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import { requireCurrentUserId } from "@/lib/auth/current-user";

const runService = new RunService();
const leadRepo = new LeadRepository();
const sourceRepo = new SourceRepository();
const outreachRepo = new OutreachRepository();

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Qualified-lead CSV export — fields per UI-SPEC.md section 26. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scope = parseExportScope(
    new URL(request.url).searchParams.get("scope"),
  );

  try {
    const userId = await requireCurrentUserId();
    const run = await runService.getOwnedRun(id, userId);
    const [leads, drafts] = await Promise.all([
      leadRepo.listForRun(id),
      outreachRepo.listForRun(id),
    ]);

    const qualified = leadsForExport(leads, drafts, scope);

    const header = [
      "company_name",
      "domain",
      "qualification_status",
      "confidence_score",
      "fit_reasons",
      "concerns",
      "source_urls",
      "source_summary",
    ];

    const rows = await Promise.all(
      qualified.map(async (lead) => {
        const sources = await sourceRepo.listForCompany(
          lead.discovered_company_id,
        );
        return [
          lead.company_name,
          lead.domain,
          lead.qualification_status,
          String(lead.confidence_score ?? ""),
          lead.fit_reasons.map((r) => r.reason).join("; "),
          lead.concerns.map((c) => c.concern).join("; "),
          sources.map((s) => s.url).join("; "),
          lead.source_summary,
        ]
          .map(csvCell)
          .join(",");
      }),
    );

    const csv = [header.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="run-${run.id}-qualified-leads.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === "UNAUTHORIZED" ? 401 : 404 },
      );
    }
    throw err;
  }
}
