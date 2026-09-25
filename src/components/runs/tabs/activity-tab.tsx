import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckCircleIcon,
  CircleIcon,
  CircleSlashIcon,
  OctagonXIcon,
  PenLineIcon,
  PlayIcon,
  SearchIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  RunEventType,
  RunEventRow,
  ToolCallRow,
  ToolCallStatus,
} from "@/infrastructure/supabase/types";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-date";

const EVENT_ICON: Record<RunEventType, { icon: LucideIcon; className: string }> = {
  run_created: { icon: PlayIcon, className: "text-info" },
  icp_refined: { icon: SparklesIcon, className: "text-muted-foreground" },
  icp_approved: { icon: CheckCircleIcon, className: "text-success" },
  discovery_started: { icon: SearchIcon, className: "text-info" },
  discovery_completed: { icon: CheckCircleIcon, className: "text-success" },
  company_research_started: { icon: SearchIcon, className: "text-info" },
  company_research_completed: {
    icon: CheckCircleIcon,
    className: "text-success",
  },
  lead_qualified: { icon: CheckCircle2Icon, className: "text-success" },
  lead_rejected: {
    icon: CircleSlashIcon,
    className: "text-muted-foreground",
  },
  outreach_started: { icon: PenLineIcon, className: "text-info" },
  outreach_completed: { icon: CheckCircleIcon, className: "text-success" },
  run_completed: { icon: CheckCircle2Icon, className: "text-success" },
  run_failed: { icon: AlertCircleIcon, className: "text-destructive" },
  run_cancelled: { icon: OctagonXIcon, className: "text-muted-foreground" },
};

const DEFAULT_EVENT_ICON = {
  icon: CircleIcon,
  className: "text-muted-foreground",
};

const TOOL_STATUS_CLASS: Record<ToolCallStatus, string> = {
  success: "text-success",
  failed: "text-destructive",
  running: "text-info",
  pending: "text-muted-foreground",
};

/**
 * UI-SPEC.md section 40: the activity feed should distinguish actions the
 * agent performed from actions the human performed. Derived from the
 * existing event_type rather than a new "actor" column — only run_created,
 * icp_approved, and run_cancelled originate from a human action in this
 * app's current event set.
 */
const USER_EVENT_TYPES = new Set([
  "run_created",
  "icp_approved",
  "run_cancelled",
]);

function eventActor(eventType: string): "You" | "Agent" {
  return USER_EVENT_TYPES.has(eventType) ? "You" : "Agent";
}

export function ActivityTab({
  events,
  toolCalls,
}: {
  events: RunEventRow[];
  toolCalls: ToolCallRow[];
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          No activity yet.
        </CardContent>
      </Card>
    );
  }

  const orderedEvents = [...events].reverse();
  const orderedToolCalls = [...toolCalls].reverse();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="divide-y py-0">
          {orderedEvents.map((event) => {
            const actor = eventActor(event.event_type);
            const { icon: Icon, className } =
              EVENT_ICON[event.event_type] ?? DEFAULT_EVENT_ICON;
            return (
              <div key={event.id} className="flex items-start gap-3 py-3">
                <Icon aria-hidden className={cn("mt-0.5 size-4", className)} />
                <div className="flex-1">
                  <p className="text-sm">{event.message}</p>
                  <p className="text-muted-foreground text-metadata flex items-center gap-1.5">
                    <span
                      className={
                        actor === "You"
                          ? "text-info font-medium"
                          : "text-muted-foreground font-medium"
                      }
                    >
                      {actor}
                    </span>
                    <span aria-hidden>·</span>
                    {formatTime(event.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <details className="bg-card rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
          Tool call log ({toolCalls.length})
        </summary>
        <div className="divide-y border-t">
          {orderedToolCalls.map((call) => (
            <details key={call.id} className="px-4 py-3 text-sm">
              <summary className="cursor-pointer list-none select-none">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{call.tool_name}</span>
                  <span className={cn("text-xs", TOOL_STATUS_CLASS[call.status])}>
                    {call.status}
                    {call.duration_ms ? ` · ${call.duration_ms}ms` : ""}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{call.purpose}</p>
                {call.error_message && (
                  <p className="text-destructive">{call.error_message}</p>
                )}
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Input</p>
                  <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                    {JSON.stringify(call.input_summary, null, 2)}
                  </pre>
                </div>
                {call.result_summary && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Result</p>
                    <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                      {JSON.stringify(call.result_summary, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}
