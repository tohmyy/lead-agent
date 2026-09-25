import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewRunLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    </AppShell>
  );
}
