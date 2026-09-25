import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerEnv } from "@/lib/config/env";
import { providerReadiness } from "@/lib/config/provider-readiness";
import { NewRunForm } from "./new-run-form";

export default function NewRunPage() {
  const { DEFAULT_DISCOVERY_LIMIT } = getServerEnv();
  const readiness = providerReadiness({
    apifyToken: process.env.APIFY_API_TOKEN,
    apifyActorId: process.env.APIFY_DISCOVERY_ACTOR_ID,
    firecrawlKey: process.env.FIRECRAWL_API_KEY,
    researchProvider: process.env.RESEARCH_PROVIDER,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>New Research Run</CardTitle>
          </CardHeader>
          <CardContent>
            <NewRunForm
              defaultDiscoveryLimit={DEFAULT_DISCOVERY_LIMIT}
              discoveryConfigured={readiness.discoveryConfigured}
              websiteResearchConfigured={readiness.websiteResearchConfigured}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
