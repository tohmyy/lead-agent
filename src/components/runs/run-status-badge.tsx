import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/infrastructure/supabase/types";

/** Icon + text, never color alone (UI-SPEC.md section 6.2 / section 33 accessibility). */
export const STATUS_DISPLAY: Record<
  RunStatus,
  {
    label: string;
    icon: string;
    variant: "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  }
> = {
  draft: { label: "Draft", icon: "○", variant: "outline" },
  awaiting_icp_approval: {
    label: "Awaiting ICP approval",
    icon: "●",
    variant: "warning",
  },
  researching: { label: "Researching", icon: "◉", variant: "info" },
  generating_outreach: {
    label: "Generating outreach",
    icon: "◉",
    variant: "info",
  },
  awaiting_review: { label: "Awaiting review", icon: "●", variant: "warning" },
  completed: { label: "Completed", icon: "✓", variant: "success" },
  failed: { label: "Failed", icon: "!", variant: "destructive" },
  cancelled: { label: "Cancelled", icon: "×", variant: "outline" },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const display = STATUS_DISPLAY[status];
  return (
    <Badge variant={display.variant} className="gap-1.5">
      <span aria-hidden>{display.icon}</span>
      {display.label}
    </Badge>
  );
}
