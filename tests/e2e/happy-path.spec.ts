import { expect, test } from "@playwright/test";

/**
 * End-to-end happy path (BUILD-PLAN.md section 54 / TEST-PLAN.md E2E-001),
 * scaled down to a controlled dev run (qualified_target=1, discovery_limit=2)
 * as recommended before running the full 10-lead assessment run.
 *
 * Requires a live Supabase project with migrations applied and a real
 * .env.local (Anthropic, Apify, Firecrawl, Supabase) — this is the one test
 * in the suite that spends real budget, so it's intentionally not part of
 * `npm run test`. Run explicitly with `npm run test:e2e` once configured.
 */
test("objective -> ICP approval -> discovery -> research -> qualification -> outreach -> review", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-test-password-12345";

  await page.goto("/login");
  await page.getByRole("button", { name: /need an account/i }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  // Depending on Supabase email-confirmation settings this may require a
  // manual confirmation step; the assertion below documents the intended
  // continuation once signed in.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: /new research/i }).click();
  await page
    .getByLabel(/qualification objective/i)
    .fill(
      "Find 1 US B2B SaaS company with 10 to 100 employees that may need AI automation support.",
    );
  await page.getByLabel(/qualified lead target/i).fill("1");
  await page.getByLabel(/discovery maximum/i).fill("2");
  await page.getByRole("button", { name: /create research run/i }).click();

  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+/);

  // The agent turns run in the background; poll the ICP tab until the
  // draft appears, then approve it to kick off discovery/research/
  // qualification/outreach.
  await page.getByRole("tab", { name: "ICP" }).click();
  await expect(
    page.getByRole("button", { name: /approve & start search/i }),
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /approve & start search/i }).click();

  // Research is bounded (discovery_limit=2) but still involves real Apify/
  // Firecrawl/Claude calls, so this allows a generous window.
  await page.getByRole("tab", { name: /^leads/i }).click();
  await expect(page.getByRole("cell").first()).toBeVisible({
    timeout: 180_000,
  });

  await page.getByRole("tab", { name: "Outreach" }).click();
  await expect(
    page.getByRole("heading", { name: /email 1|linkedin/i }).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
});
