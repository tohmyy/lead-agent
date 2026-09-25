"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { BackLink } from "@/components/layout/back-link";
import { Button } from "@/components/ui/button";

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <p className="text-heading">Something went wrong.</p>
        <p className="text-muted-foreground text-sm">
          Please try again, or go back to the dashboard.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <BackLink href="/" />
        </div>
      </div>
    </AppShell>
  );
}
