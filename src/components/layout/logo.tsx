import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-card-heading text-primary font-semibold tracking-tight",
        className,
      )}
    >
      Mélange
    </span>
  );
}
