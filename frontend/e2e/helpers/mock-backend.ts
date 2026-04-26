/**
 * Shared helpers for the Playwright E2E suite.
 *
 * The frontend talks to a backend at `${VITE_API_URL}` (defaults to
 * `/api/v1` against the same origin in dev). We register one big route
 * handler per test that pattern-matches the path, so individual tests can
 * stay focused on UI assertions without re-implementing every endpoint.
 */
import type { Page, Route } from "@playwright/test";

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_pro: boolean;
}

const DEFAULT_USER: MockUser = {
  id: "u-test-1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_admin: false,
  is_pro: false,
};

/** Build a JWT-shaped string with a future `exp` claim — the frontend
 *  inspects `exp` to decide whether the user is authenticated. The
 *  signature segment isn't validated client-side. */
export function buildFakeJwt(payload: Record<string, unknown> = {}): string {
  const inAnHour = Math.floor(Date.now() / 1000) + 3600;
  const merged = { sub: "u-test-1", exp: inAnHour, ...payload };
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(merged)}.signature`;
}

export interface BackendMockOptions {
  /** Override `/users/me` response. */
  user?: Partial<MockUser>;
  /** Override the `/auth/login` response. Set to `null` to force a 401. */
  loginResponse?: { access_token?: string; user_name?: string } | null;
  /** Override the `/auth/signup` response. Set to `null` to force a 409. */
  signupShouldFail?: boolean;
}

/**
 * Install a single network mock that handles every backend call the app
 * makes during the auth/dashboard journey. Returns a function that
 * uninstalls the mock (rarely needed since Playwright resets per test).
 */
export async function mockBackend(page: Page, options: BackendMockOptions = {}): Promise<void> {
  const user: MockUser = { ...DEFAULT_USER, ...(options.user ?? {}) };

  const handle = async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, ""); // strip the prefix
    const method = req.method();

    // ---- Auth ---------------------------------------------------------
    if (path === "/auth/login" && method === "POST") {
      if (options.loginResponse === null) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Invalid email or password." }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: options.loginResponse?.access_token ?? buildFakeJwt(),
          token_type: "bearer",
          user_name: options.loginResponse?.user_name ?? user.full_name,
        }),
      });
    }

    if (path === "/auth/signup" && method === "POST") {
      if (options.signupShouldFail) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Email already registered." }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Account created — please verify your email before logging in.",
        }),
      });
    }

    if (path === "/auth/resend-verification" && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Verification email resent." }),
      });
    }

    // ---- User profile / rewards --------------------------------------
    if (path === "/users/me" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...user,
          preferences: {},
          created_at: "2024-01-01T00:00:00Z",
        }),
      });
    }

    if (path === "/users/me/rewards" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          level: 1,
          current_xp: 0,
          xp_to_next_level: 100,
          streak_current: 0,
          streak_best: 0,
          streak_savers_available: 0,
          claimed_levels: [],
        }),
      });
    }

    if (path === "/users/me/sync-streak" && method === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }

    // ---- Dashboard reads ---------------------------------------------
    if (path === "/dashboard/stats" || path === "/dashboard") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total_practice_sessions: 0,
          total_mock_tests: 0,
          accuracy_percent: 0,
          recent_activity: [],
        }),
      });
    }

    if (path === "/dashboard/leaderboard" || path.startsWith("/leaderboard")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (path === "/usat/practice-status") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tests_today: 0, is_pro: false }),
      });
    }

    // ---- Public stats (no auth) --------------------------------------
    if (path === "/public/stats") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: 1234, mcqs: 5678 }),
      });
    }

    // ---- Default: empty list / empty object so renders don't crash --
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  };

  // Match anything that looks like an API call. The dev server proxies
  // `/api/v1/*` and absolute `VITE_API_URL` may point at a different host;
  // matching by path keeps both cases covered.
  await page.route(/\/api\/v1\//, handle);
}

/**
 * Pre-seed `localStorage` with a valid-looking session so tests can land
 * directly on protected pages without going through the login form.
 */
export async function seedAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript(([token, name]) => {
    window.localStorage.setItem("access_token", token as string);
    window.localStorage.setItem("user_name", name as string);
  }, [buildFakeJwt(), "Ada Lovelace"]);
}
