import { z } from "zod";

/**
 * Server-only environment configuration. Importing this module from a client
 * component is a mistake by construction: every value here is a secret or a
 * server-side setting, and `server-only` makes that a build-time error
 * instead of a runtime leak.
 */
import "server-only";

const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  APIFY_API_TOKEN: z.string().min(1, "APIFY_API_TOKEN is required"),
  FIRECRAWL_API_KEY: z.string().min(1, "FIRECRAWL_API_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DEFAULT_DISCOVERY_LIMIT: z.coerce.number().int().positive().default(20),
  MAX_DISCOVERY_LIMIT: z.coerce.number().int().positive().default(50),

  APIFY_DISCOVERY_ACTOR_ID: z.string().min(1).optional(),
  RESEARCH_PROVIDER: z.enum(["firecrawl", "crawl4ai"]).default("firecrawl"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Parses and validates the process environment once per process. Fails fast
 * with a readable error rather than letting a missing key surface later as a
 * confusing provider-auth failure deep in a tool call.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Check .env.local against .env.example:\n${issues}`,
    );
  }

  if (parsed.data.MAX_DISCOVERY_LIMIT < parsed.data.DEFAULT_DISCOVERY_LIMIT) {
    throw new Error(
      "MAX_DISCOVERY_LIMIT must be greater than or equal to DEFAULT_DISCOVERY_LIMIT",
    );
  }

  cached = parsed.data;
  return cached;
}
