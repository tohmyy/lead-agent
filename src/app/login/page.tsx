import { Logo } from "@/components/layout/logo";
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
          <h1>
            <Logo className="text-heading" />
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to manage research runs.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo ?? "/"} />
      </div>
    </div>
  );
}
