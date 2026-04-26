/**
 * E2E — Authenticated navigation
 * Once logged in, the user can navigate between core protected sections
 * (Dashboard, USAT, AI Tutor) via the navbar and the URL guards stay
 * permissive while the JWT is valid.
 */
import { expect, test } from "@playwright/test";

import { mockBackend, seedAuthenticatedSession } from "./helpers/mock-backend";

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockBackend(page);
});

test("authenticated user can load the dashboard", async ({ page }) => {
  await page.goto("/dashboard");

  // We don't lock the assertion to a specific dashboard string — instead
  // we verify we are not bounced back to /login, which is the only thing
  // the auth guard can do.
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("authenticated user can navigate to USAT section", async ({ page }) => {
  await page.goto("/usat");

  await expect(page).toHaveURL(/\/usat$/);
});

test("session persists across a hard reload", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  const token = await page.evaluate(() => window.localStorage.getItem("access_token"));
  expect(token).toBeTruthy();
});
