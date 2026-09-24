import { notFound } from "next/navigation";

import { RunService } from "@/application/runs/run-service";
import { IcpService } from "@/application/icp/icp-service";
import { AppShell } from "@/components/layout/app-shell";
import { CompanyRepository } from "@/infrastructure/supabase/repositories/company-repository";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import { ToolCallRepository } from "@/infrastructure/supabase/repositories/tool-call-repository";
import { requireCurrentUserId } from "@/lib/auth/current-user";
import { AppError } from "@/domain/shared/errors";
import { RunWorkspace } from "@/components/runs/run-workspace";

// Reads the signed-in user's session and live run state — never statically
// prerendered.
export const dynamic = "force-dynamic";

const runService = new RunService();
const icpService = new IcpService();
const companies = new CompanyRepository();
const leads = new LeadRepository();
const sources = new SourceRepository();
const outreach = new OutreachRepository();
const events = new RunEventRepository();
const toolCalls = new ToolCallRepository();

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireCurrentUserId();

  let run;
  try {
    run = await runService.getOwnedRun(id, userId);
  } catch (err) {
    if (
      err instanceof AppError &&
      (err.code === "RUN_NOT_FOUND" || err.code === "UNAUTHORIZED")
    ) {
      notFound();
    }
    throw err;
  }

  const [
    icpVersions,
    approvedIcp,
    runCompanies,
    runLeads,
    runEvents,
    runToolCalls,
    runOutreach,
  ] = await Promise.all([
    icpService.listVersions(id),
    icpService.getApproved(id),
    companies.listForRun(id),
    leads.listForRun(id),
    events.listForRun(id),
    toolCalls.listForRun(id),
    outreach.listForRun(id),
  ]);

  const sourcesByCompany = new Map(
    await Promise.all(
      runCompanies.map(
        async (c) => [c.id, await sources.listForCompany(c.id)] as const,
      ),
    ),
  );

  return (
    <AppShell>
      <RunWorkspace
        run={run}
        icpVersions={icpVersions}
        approvedIcp={approvedIcp}
        companies={runCompanies}
        leads={runLeads}
        sourcesByCompany={Object.fromEntries(sourcesByCompany)}
        events={runEvents}
        toolCalls={runToolCalls}
        outreachDrafts={runOutreach}
      />
    </AppShell>
  );
}
