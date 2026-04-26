/**
 * E2E — Signup flow
 * Critical user journey: a new visitor reaches the signup form, validates
 * input, and reaches the "check your email" success state.
 */
import { expect, test } from "@playwright/test";

import { mockBackend } from "./helpers/mock-backend";

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test("a visitor can navigate to signup from the landing page", async ({ page }) => {
  await page.goto("/");

  // Navbar exposes a "Sign Up" button — use it to navigate.
  await page.getByRole("link", { name: /sign up/i }).first().click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
});

test("submitting the signup form with valid data shows the verify-email screen", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel(/full name/i).fill("Ada Lovelace");
  await page.getByLabel(/email/i).fill("ada-new@example.com");
  await page.getByLabel(/password/i).fill("Sup3rSecret#1!");

  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  await expect(page.getByText("ada-new@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /resend verification email/i })).toBeVisible();
});

test("signup with a too-short password is rejected client-side", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel(/full name/i).fill("Ada");
  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/password/i).fill("abc");

  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  // Toast contains the validation message.
  await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();
  // We never reach the success screen.
  await expect(page.getByRole("heading", { name: /check your email/i })).not.toBeVisible();
});

test("signup surfaces a backend error (email already registered)", async ({ page }) => {
  await mockBackend(page, { signupShouldFail: true });

  await page.goto("/signup");
  await page.getByLabel(/full name/i).fill("Ada");
  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/password/i).fill("Sup3rSecret#1!");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  await expect(page.getByText(/email already registered/i).first()).toBeVisible();
});
