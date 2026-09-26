import { Badge } from "@/components/ui/badge";
import type { ReviewState } from "@/infrastructure/supabase/types";

const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  not_reviewed: "Not reviewed",
  reviewed: "Reviewed",
  edited: "Edited",
  approved_for_export: "Approved for export",
};

const REVIEW_STATE_VARIANT: Record<
  ReviewState,
  "outline" | "info" | "warning" | "success"
> = {
  not_reviewed: "outline",
  reviewed: "info",
  edited: "warning",
  approved_for_export: "success",
};

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  return (
    <Badge variant={REVIEW_STATE_VARIANT[state]}>
      {REVIEW_STATE_LABEL[state]}
    </Badge>
  );
}
