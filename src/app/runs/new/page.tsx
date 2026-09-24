import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewRunForm } from "./new-run-form";

export default function NewRunPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>New Research Run</CardTitle>
          </CardHeader>
          <CardContent>
            <NewRunForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
