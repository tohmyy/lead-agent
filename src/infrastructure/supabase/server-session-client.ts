import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/config/public-env";
import { nodeWebSocketTransport } from "@/lib/config/node-websocket-transport";
import type { Database } from "./types";

/**
 * Server-side Supabase client bound to the current request's session cookies
 * (anon key + RLS, not the service-role key). Use this for anything that
 * should run "as the signed-in user" — Server Components, Server Actions,
 * and route handlers reading/writing on the user's behalf.
 */
export async function createServerSupabaseClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. Middleware refreshes the session instead.
          }
        },
      },
      // Node < 22 has no native WebSocket; supabase-js constructs a
      // RealtimeClient unconditionally and throws without this.
      realtime: { transport: nodeWebSocketTransport },
    },
  );
}
