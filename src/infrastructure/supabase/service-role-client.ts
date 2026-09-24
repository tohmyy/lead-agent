import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/config/env";
import { nodeWebSocketTransport } from "@/lib/config/node-websocket-transport";
import type { Database } from "./types";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Privileged Supabase client authenticated with the service-role key. This
 * bypasses RLS, so every caller MUST perform its own explicit ownership
 * check (verify the row's user_id/run_id matches the authenticated caller)
 * before using it — see AGENTS.md #24-25 and ARCHITECTURE2.md #30.
 *
 * Used by: the run orchestrator and agent tool implementations, which run
 * as trusted server-side application code and may need to keep operating
 * on a run after the originating browser request has completed (the
 * browser must not be the source of truth for agent execution — see
 * ARCHITECTURE2.md #60 and UI-SPEC #47-48).
 *
 * Never import this module into a client component or route that returns
 * its client to the browser.
 */
export function createServiceRoleSupabaseClient() {
  if (client) return client;

  const env = getServerEnv();
  client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Node < 22 has no native WebSocket; supabase-js constructs a
      // RealtimeClient unconditionally and throws without this.
      realtime: { transport: nodeWebSocketTransport },
    },
  );
  return client;
}
