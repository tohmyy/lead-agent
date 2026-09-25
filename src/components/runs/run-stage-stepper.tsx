import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { STAGE_LABELS, STAGE_ORDER, type RunStage } from "@/domain/runs/run-progress";
import { cn } from "@/lib/utils";

export function RunStageStepper({
  stage,
  active,
  attention,
  className,
}: {
  stage: RunStage;
  active: boolean;
  attention: boolean;
  className?: string;
}) {
  const isTerminal = stage === "failed" || stage === "cancelled";
  const currentIndex = isTerminal ? -1 : STAGE_ORDER.indexOf(stage);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ol
        aria-label="Run pipeline stages"
        className={cn(
          "flex flex-1 items-center gap-1.5",
          isTerminal && "opacity-50",
        )}
      >
        {STAGE_ORDER.map((step, index) => {
          const isDone = !isTerminal && index < currentIndex;
          const isCurrent = !isTerminal && index === currentIndex;
          const status = isCurrent ? "current" : isDone ? "completed" : "upcoming";

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className="flex flex-1 items-center gap-1.5 last:flex-none"
            >
              <span className="flex size-3 shrink-0 items-center justify-center">
                {isCurrent && active ? (
                  <Spinner
                    size="xs"
                    className={attention ? "text-warning" : "text-info"}
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "rounded-full border-2",
                      isDone && "size-2.5 bg-success border-success",
                      isCurrent &&
                        (attention
                          ? "size-3 bg-warning border-warning"
                          : "size-3 bg-info border-info"),
                      status === "upcoming" &&
                        "size-2.5 bg-background border-border",
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {STAGE_LABELS[step]}
                <span className="sr-only"> ({status})</span>
              </span>
              {index < STAGE_ORDER.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px flex-1",
                    isDone ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {isTerminal && (
        <Badge variant={stage === "failed" ? "destructive" : "outline"}>
          {STAGE_LABELS[stage]}
        </Badge>
      )}
    </div>
  );
}
