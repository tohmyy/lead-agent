"use client";

import { useState, useTransition } from "react";

import { cancelRun, completeRun } from "@/app/actions/runs";
import { Button } from "@/components/ui/button";
import type { RunRow } from "@/infrastructure/supabase/types";

/** States assertValidTransition (src/domain/runs/run.ts) allows into "cancelled". */
const CANCELLABLE_STATUSES = new Set([
  "draft",
  "awaiting_icp_approval",
  "researching",
  "generating_outreach",
]);

type ActiveAction = "complete" | "cancel" | null;

export function RunActions({ run }: { run: RunRow }) {
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const showComplete = run.status === "awaiting_review";
  const showCancel = CANCELLABLE_STATUSES.has(run.status);

  if (!showComplete && !showCancel) return null;

  return (
    <div className="flex gap-2">
      {showComplete && (
        <Button
          loading={pending && activeAction === "complete"}
          disabled={pending}
          onClick={() => {
            setActiveAction("complete");
            startTransition(() => completeRun(run.id));
          }}
        >
          Mark Run Complete
        </Button>
      )}
      {showCancel && (
        <Button
          variant="outline"
          loading={pending && activeAction === "cancel"}
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Cancel this run? Existing progress is preserved, but no further research will happen.")) {
              return;
            }
            setActiveAction("cancel");
            startTransition(() => cancelRun(run.id));
          }}
        >
          Cancel Run
        </Button>
      )}
    </div>
  );
}
