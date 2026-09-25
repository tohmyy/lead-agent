import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex items-center justify-center gap-2">
            <span aria-hidden className="bg-primary size-2 rounded-full" />
            <h1 className="text-heading tracking-tight">
              Lead Research Agent
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Sign in to manage research runs.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo ?? "/"} />
      </div>
    </div>
  );
}
