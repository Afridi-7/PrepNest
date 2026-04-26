import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for PrepNest E2E tests.
 *
 * - Tests run against the Vite dev server, which Playwright starts/stops
 *   automatically via `webServer`.
 * - The backend is fully mocked at the network layer (`page.route`) inside
 *   each test, so no FastAPI / DB / Resend / OpenAI is required to run.
 * - Single browser (Chromium) is used to keep CI fast; add Firefox/WebKit
 *   blocks here if cross-browser coverage is later required.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
