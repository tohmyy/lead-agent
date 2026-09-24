import "server-only";

import { AppError } from "@/domain/shared/errors";
import {
  assertClaimsReferenceKnownSources,
  type SaveOutreachDraftInput,
} from "@/domain/outreach/outreach";
import { LeadRepository } from "@/infrastructure/supabase/repositories/lead-repository";
import { OutreachRepository } from "@/infrastructure/supabase/repositories/outreach-repository";
import { RunEventRepository } from "@/infrastructure/supabase/repositories/run-event-repository";
import { SourceRepository } from "@/infrastructure/supabase/repositories/source-repository";
import type { OutreachDraftRow, RunRow } from "@/infrastructure/supabase/types";

export class OutreachService {
  constructor(
    private readonly leads = new LeadRepository(),
    private readonly sources = new SourceRepository(),
    private readonly outreach = new OutreachRepository(),
    private readonly events = new RunEventRepository(),
  ) {}

  /**
   * `run` must already be authorization-checked by the caller. Enforces the
   * qualification gate — TOOLS-CONTRACT.md section 33: a lead must be
   * `qualified` before any draft can be saved for it, and every
   * personalization claim must trace to a real, recorded source
   * (UI-SPEC.md section 24).
   */
  async saveDraft(
    run: RunRow,
    input: SaveOutreachDraftInput,
  ): Promise<OutreachDraftRow> {
    const lead = await this.leads.getOwned(input.lead_id, run.id);
    if (lead.qualification_status !== "qualified") {
      throw new AppError(
        "OUTREACH_NOT_ALLOWED",
        "Outreach can only be generated for a qualified lead.",
      );
    }

    const companySources = await this.sources.listForCompany(
      lead.discovered_company_id,
    );
    const knownSourceIds = new Set(companySources.map((s) => s.id));
    assertClaimsReferenceKnownSources(
      input.personalization_context.claims,
      knownSourceIds,
    );

    const draft = await this.outreach.createDraft({
      runId: run.id,
      data: input,
    });

    await this.events.record({
      runId: run.id,
      eventType: "outreach_completed",
      message: `Generated ${input.channel === "email" ? `email ${input.step}` : "LinkedIn message"} for ${lead.company_name}.`,
    });

    return draft;
  }
}
