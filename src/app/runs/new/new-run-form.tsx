"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createRun, type RunFormState } from "@/app/actions/runs";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format-date";

const initialState: RunFormState = {};

export function NewRunForm({
  defaultDiscoveryLimit,
  discoveryConfigured,
  websiteResearchConfigured,
}: {
  defaultDiscoveryLimit: number;
  discoveryConfigured: boolean;
  websiteResearchConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(createRun, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="objective">Qualification objective</Label>
        <Textarea
          id="objective"
          name="objective"
          required
          rows={5}
          placeholder="Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support."
        />
        <p className="text-muted-foreground text-sm">
          Describe who you&apos;re looking for in plain language — geography,
          industry, company size, and anything else that matters. The agent will
          turn this into structured criteria for you to review.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="qualifiedTarget">Qualified lead target</Label>
          <Input
            id="qualifiedTarget"
            name="qualifiedTarget"
            type="number"
            min={1}
            defaultValue={10}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discoveryLimit">Discovery maximum</Label>
          <Input
            id="discoveryLimit"
            name="discoveryLimit"
            type="number"
            min={1}
            defaultValue={defaultDiscoveryLimit}
            required
          />
          <p className="text-muted-foreground text-xs">
            Maximum companies to discover while searching. The agent cannot
            exceed this.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Company discovery is{" "}
        {discoveryConfigured ? "configured" : "not configured"}. Website
        research is{" "}
        {websiteResearchConfigured ? "configured" : "not configured"}.
      </p>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      {state.duplicate && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">You&apos;ve run this objective before</p>
          <p className="text-muted-foreground text-sm">
            {state.duplicate.qualifiedCount} / {state.duplicate.qualifiedTarget}{" "}
            qualified · {formatDateTime(state.duplicate.createdAt)}
          </p>
          <RunStatusBadge status={state.duplicate.status} />
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={
                <Link href={`/runs/${state.duplicate.id}`}>
                  View existing run
                </Link>
              }
            />
            <Button
              type="submit"
              name="continueAnyway"
              value="1"
              variant="outline"
              disabled={pending}
            >
              Continue anyway
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create Research Run"}
      </Button>
    </form>
  );
}
