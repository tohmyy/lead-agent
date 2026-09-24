import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/infrastructure/supabase/types";

/** Icon + text, never color alone (UI-SPEC.md section 6.2 / section 33 accessibility). */
const STATUS_DISPLAY: Record<
  RunStatus,
  {
    label: string;
    icon: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  draft: { label: "Draft", icon: "○", variant: "outline" },
  awaiting_icp_approval: {
    label: "Awaiting ICP approval",
    icon: "●",
    variant: "secondary",
  },
  researching: { label: "Researching", icon: "◉", variant: "secondary" },
  generating_outreach: {
    label: "Generating outreach",
    icon: "◉",
    variant: "secondary",
  },
  awaiting_review: { label: "Awaiting review", icon: "●", variant: "default" },
  completed: { label: "Completed", icon: "✓", variant: "default" },
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
