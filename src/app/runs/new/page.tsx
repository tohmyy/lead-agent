import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerEnv } from "@/lib/config/env";
import { NewRunForm } from "./new-run-form";

export default function NewRunPage() {
  const { DEFAULT_DISCOVERY_LIMIT } = getServerEnv();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>New Research Run</CardTitle>
          </CardHeader>
          <CardContent>
            <NewRunForm defaultDiscoveryLimit={DEFAULT_DISCOVERY_LIMIT} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
