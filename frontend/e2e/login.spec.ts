/**
 * E2E — Login flow
 * Critical user journey: a returning user signs in, lands on the
 * dashboard, and a wrong-password attempt surfaces an error.
 */
import { expect, test } from "@playwright/test";

import { mockBackend } from "./helpers/mock-backend";

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test("successful login navigates to the dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/password/i).fill("Sup3rSecret#1!");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  // localStorage must contain the JWT after a successful login so
  // subsequent navigations stay authenticated.
  const token = await page.evaluate(() => window.localStorage.getItem("access_token"));
  expect(token).toBeTruthy();
});

test("login with wrong credentials shows an error and stays on /login", async ({ page }) => {
  await mockBackend(page, { loginResponse: null });

  await page.goto("/login");
  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/password/i).fill("WrongPassword#1");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page.getByText(/invalid email or password/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("submitting an empty login form is blocked client-side", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page.getByText(/please fill in all fields/i).first()).toBeVisible();
});

test("the auth guard sends a logged-out user from /dashboard back to /login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/please log in first/i)).toBeVisible();
});

test("forgot-password link from /login navigates correctly", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("link", { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
