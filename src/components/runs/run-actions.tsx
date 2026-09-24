"use client";

import { useTransition } from "react";

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

export function RunActions({ run }: { run: RunRow }) {
  const [pending, startTransition] = useTransition();

  const showComplete = run.status === "awaiting_review";
  const showCancel = CANCELLABLE_STATUSES.has(run.status);

  if (!showComplete && !showCancel) return null;

  return (
    <div className="flex gap-2">
      {showComplete && (
        <Button
          disabled={pending}
          onClick={() => startTransition(() => completeRun(run.id))}
        >
          Mark Run Complete
        </Button>
      )}
      {showCancel && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Cancel this run? Existing progress is preserved, but no further research will happen.")) {
              return;
            }
            startTransition(() => cancelRun(run.id));
          }}
        >
          Cancel Run
        </Button>
      )}
    </div>
  );
}
