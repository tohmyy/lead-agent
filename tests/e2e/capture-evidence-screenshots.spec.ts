import "../../scripts/load-env";

import { expect, test } from "@playwright/test";

/**
 * Free evidence capture for docs/ASSESSMENT-EVIDENCE.md — walks the seeded
 * example run (npm run db:seed) and screenshots every screen it touches.
 * No paid Apify/Firecrawl/Anthropic calls happen here, only Supabase reads
 * against data scripts/seed.ts already wrote. Run with:
 *
 *   npm run db:seed
 *   npm run evidence:screenshots
 *
 * Requires the seed user's credentials (SEED_USER_EMAIL/SEED_USER_PASSWORD
 * in .env.local, same as scripts/seed.ts) and a running dev server.
 *
 * Playwright's test runner doesn't get Next.js's automatic .env.local
 * loading (that only applies to `next dev`/`next build`), so this file
 * loads it explicitly the same way scripts/seed.ts does — otherwise
 * process.env.SEED_USER_EMAIL/PASSWORD are undefined here and login fails.
 */
test("capture evidence screenshots from the seeded run", async ({ page }) => {
  const email = process.env.SEED_USER_EMAIL ?? "dev@example.com";
  const password = process.env.SEED_USER_PASSWORD ?? "change-me-please-12345";

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL("/");

  await page.screenshot({
    path: "docs/evidence/screenshots/01-dashboard.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: /new research/i }).click();
  await expect(page).toHaveURL(/\/runs\/new/);
  await page.screenshot({
    path: "docs/evidence/screenshots/02-new-run-form.png",
    fullPage: true,
  });

  await page.goto("/");
  await page.locator('a[href^="/runs/"]:not([href="/runs/new"])').first().click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+/);

  const tabs: Array<{ name: string; file: string }> = [
    { name: "Overview", file: "03-run-overview.png" },
    { name: "ICP", file: "04-run-icp.png" },
    { name: "Activity", file: "05-run-activity.png" },
    { name: "Leads", file: "06-run-leads.png" },
    { name: "Outreach", file: "07-run-outreach.png" },
  ];

  for (const tab of tabs) {
    await page.getByRole("tab", { name: tab.name }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `docs/evidence/screenshots/${tab.file}`,
      fullPage: true,
    });
  }
});
