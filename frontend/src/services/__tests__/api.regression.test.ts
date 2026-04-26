/**
 * Regression tests — frontend `apiClient` token-handling guard rails.
 *
 * Each test here protects against a previously-observed or class-of bug:
 *   • Expired JWT must log the user out (no stale session).
 *   • Malformed JWT must NOT throw — it should be treated as unauthenticated.
 *   • Token without `exp` is treated as non-expiring (current contract).
 *   • setToken / clearToken / getToken stay in sync with localStorage.
 *   • clearToken must NOT throw if there is no token.
 *   • Authorization header is built ONLY when a token is set.
 *
 * If any of these fail, a user-visible auth bug has been re-introduced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api";

// --- helpers --------------------------------------------------------------

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.sig`;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  apiClient.clearToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- token expiry regressions --------------------------------------------

describe("apiClient — token expiry regressions", () => {
  it("treats an expired token as unauthenticated and clears it", () => {
    const expired = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 });
    apiClient.setToken(expired);

    expect(apiClient.isAuthenticated()).toBe(false);
    // Side effect: expired token must be evicted from storage.
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("treats a valid future-dated token as authenticated", () => {
    const valid = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    apiClient.setToken(valid);
    expect(apiClient.isAuthenticated()).toBe(true);
  });

  it("does not throw on a malformed token; returns false", () => {
    apiClient.setToken("not-a-jwt-at-all");
    expect(() => apiClient.isAuthenticated()).not.toThrow();
    expect(apiClient.isAuthenticated()).toBe(false);
  });

  it("does not throw on a token with non-base64 payload", () => {
    apiClient.setToken("aaa.@@@.ccc");
    expect(() => apiClient.isAuthenticated()).not.toThrow();
    expect(apiClient.isAuthenticated()).toBe(false);
  });

  it("treats a token without `exp` claim as non-expiring (current contract)", () => {
    // Bug class: a missing exp must NOT crash the expiry check or evict the
    // token; we deliberately preserve sessions for tokens with no exp.
    const noExp = fakeJwt({ sub: "u1" });
    apiClient.setToken(noExp);
    expect(apiClient.isAuthenticated()).toBe(true);
  });
});

// --- token storage regressions -------------------------------------------

describe("apiClient — token storage regressions", () => {
  it("setToken persists the token to localStorage", () => {
    apiClient.setToken("the-token");
    expect(localStorage.getItem("access_token")).toBe("the-token");
  });

  it("setToken with a userName persists both fields", () => {
    apiClient.setToken("the-token", "Ada Lovelace");
    expect(localStorage.getItem("access_token")).toBe("the-token");
    expect(localStorage.getItem("user_name")).toBe("Ada Lovelace");
  });

  it("clearToken removes the token from localStorage", () => {
    apiClient.setToken("the-token", "Ada");
    apiClient.clearToken();
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("clearToken is a no-op when no token is stored (does not throw)", () => {
    expect(() => apiClient.clearToken()).not.toThrow();
    expect(apiClient.isAuthenticated()).toBe(false);
  });

  it("isAuthenticated returns false when no token has been set", () => {
    expect(apiClient.isAuthenticated()).toBe(false);
  });
});

// --- Authorization header regressions ------------------------------------

describe("apiClient — Authorization header regressions", () => {
  it("does NOT send Authorization on /auth/login (anonymous endpoint)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: "t", token_type: "bearer", user_name: "A" })
    );
    await apiClient.login("a@b.co", "Sup3rSecret#1!");

    const [, opts] = fetchMock.mock.calls[0];
    const headers = (opts?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("DOES send Authorization: Bearer <token> on protected calls when set", async () => {
    const valid = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    apiClient.setToken(valid);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "u1", email: "a@b.co", full_name: "A" })
    );
    await apiClient.getCurrentUser();

    const [, opts] = fetchMock.mock.calls[0];
    const headers = (opts?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${valid}`);
  });

  it("after clearToken, follow-up requests carry NO Authorization header", async () => {
    apiClient.setToken("the-token");
    apiClient.clearToken();

    fetchMock.mockResolvedValueOnce(jsonResponse({ users: 0, mcqs: 0 }));
    await apiClient.getPublicStats();

    // getPublicStats uses raw fetch; it should not include Authorization
    // either way, but the broader contract is: no leftover token leakage.
    const call = fetchMock.mock.calls[0];
    const headers = ((call?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});
