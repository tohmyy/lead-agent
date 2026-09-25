import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="bg-primary size-2 rounded-full"
            />
            <span className="text-card-heading tracking-tight">
              Lead Research Agent
            </span>
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        {children}
      </main>
    </div>
  );
}
