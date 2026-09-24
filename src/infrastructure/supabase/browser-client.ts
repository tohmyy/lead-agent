"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/config/public-env";
import type { Database } from "./types";

/**
 * Browser-side Supabase client, authenticated as the signed-in user via
 * cookies. Uses only the public anon key — never the service-role key.
 */
export function createBrowserSupabaseClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
