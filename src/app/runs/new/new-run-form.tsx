"use client";

import { useActionState } from "react";

import { createRun, type RunFormState } from "@/app/actions/runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: RunFormState = {};

export function NewRunForm() {
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
            defaultValue={20}
            required
          />
          <p className="text-muted-foreground text-xs">
            Maximum companies to discover while searching. The agent cannot
            exceed this.
          </p>
        </div>
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create Research Run"}
      </Button>
    </form>
  );
}
