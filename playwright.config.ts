import { defineConfig } from "@playwright/test";

/**
 * Requires a real Supabase project (migrations applied) and .env.local —
 * see README.md. Not runnable in an environment without live credentials;
 * `npm run test` (Vitest) covers everything that doesn't need them.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
