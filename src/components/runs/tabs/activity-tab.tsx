import { Card, CardContent } from "@/components/ui/card";
import type { RunEventRow, ToolCallRow } from "@/infrastructure/supabase/types";
import { formatTime } from "@/lib/format-date";

const EVENT_ICON: Record<string, string> = {
  run_created: "✓",
  icp_refined: "✓",
  icp_approved: "✓",
  discovery_started: "→",
  discovery_completed: "✓",
  company_research_started: "→",
  company_research_completed: "✓",
  lead_qualified: "✓",
  lead_rejected: "○",
  outreach_started: "→",
  outreach_completed: "✓",
  run_completed: "✓",
  run_failed: "!",
  run_cancelled: "×",
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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="divide-y py-0">
          {events.map((event) => {
            const actor = eventActor(event.event_type);
            return (
              <div key={event.id} className="flex items-start gap-3 py-3">
                <span aria-hidden className="text-muted-foreground mt-0.5">
                  {EVENT_ICON[event.event_type] ?? "•"}
                </span>
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
          {toolCalls.map((call) => (
            <details key={call.id} className="px-4 py-3 text-sm">
              <summary className="cursor-pointer list-none select-none">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{call.tool_name}</span>
                  <span
                    className={
                      call.status === "success"
                        ? "text-muted-foreground text-xs"
                        : call.status === "failed"
                          ? "text-destructive text-xs"
                          : "text-muted-foreground text-xs"
                    }
                  >
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
