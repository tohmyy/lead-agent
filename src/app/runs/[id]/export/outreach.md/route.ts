import { NextResponse } from "next/server";

import { IcpService } from "@/application/icp/icp-service";
import { RunService } from "@/application/runs/run-service";
import {
  draftsForExport,
  leadsForExport,
  parseExportScope,
} from "@/domain/outreach/outreach";
import { AppError } from "@/domain/shared/errors";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { requireCurrentUserId } from "@/lib/auth/current-user";

const runService = new RunService();
const icpService = new IcpService();
const leadRepo = new LeadRepository();
const outreachRepo = new OutreachRepository();

/** Human-readable outreach sample pack — content per UI-SPEC.md section 26 / PRD.md deliverables. */
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
    const [approvedIcp, leads, drafts] = await Promise.all([
      icpService.getApproved(id),
      leadRepo.listForRun(id),
      outreachRepo.listForRun(id),
    ]);

    const qualified = leadsForExport(leads, drafts, scope);

    const sections = await Promise.all(
      qualified.map(async (lead) => {
        const leadDrafts = drafts.filter((draft) => draft.lead_id === lead.id);
        const latest = draftsForExport(leadDrafts, scope);
        const latestByKey = new Map(
          latest.map((d) => [`${d.channel}:${d.step ?? "linkedin"}`, d]),
        );

        const emailSections = [1, 2, 3]
          .map((step) => latestByKey.get(`email:${step}`))
          .filter((d): d is NonNullable<typeof d> => !!d)
          .map((d) => `**Email ${d.step}**\nSubject: ${d.subject}\n\n${d.body}`)
          .join("\n\n");

        const linkedin = latestByKey.get("linkedin:linkedin");

        const fitReasons = lead.fit_reasons
          .map((r) => `- ${r.reason}`)
          .join("\n");
        const concerns = lead.concerns
          .map((c) => `- ${c.concern} (${c.severity})`)
          .join("\n");

        return [
          `## ${lead.company_name} (${lead.domain})`,
          "",
          `**Qualification reasoning:** ${lead.qualification_reasoning}`,
          "",
          `**Source context:** ${lead.source_summary}`,
          "",
          fitReasons ? `**Fit reasons:**\n${fitReasons}` : "",
          concerns ? `**Concerns:**\n${concerns}` : "",
          emailSections,
          linkedin ? `**LinkedIn message**\n\n${linkedin.body}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      }),
    );

    const doc = [
      `# Outreach Sample Pack`,
      "",
      `**Qualification objective:** ${run.objective}`,
      "",
      approvedIcp
        ? `**Approved ICP hard filters:** ${approvedIcp.criteria.hard_filters.join(", ")}`
        : "",
      "",
      ...sections,
    ]
      .filter(Boolean)
      .join("\n\n");

    return new NextResponse(doc, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="run-${run.id}-outreach-pack.md"`,
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
