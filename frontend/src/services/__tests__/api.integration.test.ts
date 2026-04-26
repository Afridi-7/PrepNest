/**
 * Integration tests — frontend `apiClient` against a mocked HTTP layer.
 *
 * These exercise the real `ApiClient` class talking to a `fetch` mock that
 * impersonates the backend, so we cover:
 *   • URL construction (API_BASE_URL + endpoint)
 *   • Header building (Content-Type, Bearer auth)
 *   • Request body shape
 *   • Token storage in localStorage and propagation into Authorization headers
 *   • Error mapping (FastAPI `detail` → thrown Error.message)
 *   • JWT expiry handling in `isAuthenticated()`
 *
 * Only the network layer (`fetch`) is mocked — that is the third-party
 * boundary. Everything inside `ApiClient` is real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api";

// --- Helpers ---------------------------------------------------------------

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Build a minimal JWT (header.payload.signature) with a given exp claim. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature-not-verified-here`;
}

// --- Test setup ------------------------------------------------------------

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

// --- Auth flow -------------------------------------------------------------

describe("apiClient — login flow", () => {
  it("posts JSON body to /auth/login and returns the AuthResponse", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        access_token: "abc.def.ghi",
        token_type: "bearer",
        user_name: "Ada Lovelace",
      })
    );

    const result = await apiClient.login("ada@example.com", "Sup3rSecret#1!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toMatch(/\/auth\/login$/);
    expect(calledOpts?.method).toBe("POST");
    expect((calledOpts?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calledOpts?.body as string)).toEqual({
      email: "ada@example.com",
      password: "Sup3rSecret#1!",
    });

    expect(result.access_token).toBe("abc.def.ghi");
    expect(result.token_type).toBe("bearer");
    expect(result.user_name).toBe("Ada Lovelace");
  });

  it("setToken persists the JWT to localStorage and Authorization header is sent on the next request", async () => {
    apiClient.setToken("stored-token-123", "Ada");
    expect(localStorage.getItem("access_token")).toBe("stored-token-123");
    expect(localStorage.getItem("user_name")).toBe("Ada");

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "u1", email: "ada@example.com" }));
    await apiClient.getCurrentUser();

    const [, opts] = fetchMock.mock.calls[0];
    const headers = opts?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer stored-token-123");
  });

  it("clearToken removes Authorization on subsequent requests", async () => {
    apiClient.setToken("token-to-clear");
    apiClient.clearToken();

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user_name")).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ users: 0, mcqs: 0 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "u1", email: "x@x.com" }));
    await apiClient.getCurrentUser();

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// --- Signup ----------------------------------------------------------------

describe("apiClient — signup", () => {
  it("posts the snake_case body shape the FastAPI schema expects", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Account created — please verify your email." }, { status: 201 })
    );

    await apiClient.signup("new@example.com", "Sup3rSecret#1!", "New User");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/signup$/);
    expect(opts?.method).toBe("POST");
    expect(JSON.parse(opts?.body as string)).toEqual({
      email: "new@example.com",
      password: "Sup3rSecret#1!",
      full_name: "New User",
    });
  });
});

// --- Error mapping ---------------------------------------------------------

describe("apiClient — error handling", () => {
  it("extracts FastAPI string `detail` and throws Error with it", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiClient.login("a@b.com", "bad")).rejects.toThrow("Invalid credentials");
  });

  it("flattens FastAPI list-shaped `detail` (validation errors) into a single message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [
            { loc: ["body", "email"], msg: "value is not a valid email address", type: "value_error" },
            { loc: ["body", "password"], msg: "ensure this value has at least 8 characters", type: "value_error" },
          ],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(apiClient.signup("bad", "x")).rejects.toThrow(
      /value is not a valid email address.*ensure this value has at least 8 characters/
    );
  });

  it("falls back to a generic message when the response is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>upstream broke</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    await expect(apiClient.getCurrentUser()).rejects.toThrow(/502|API error/);
  });
});

// --- JWT expiry ------------------------------------------------------------

describe("apiClient — JWT expiry handling", () => {
  it("isAuthenticated returns false (and clears token) when the JWT is expired", () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600; // 1 h ago
    apiClient.setToken(fakeJwt({ sub: "u1", exp: expiredAt }));

    expect(apiClient.isAuthenticated()).toBe(false);
    // Side effect: expired token must be purged so stale auth never sticks.
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("isAuthenticated returns true for a JWT that has not yet expired", () => {
    const inAnHour = Math.floor(Date.now() / 1000) + 3600;
    apiClient.setToken(fakeJwt({ sub: "u1", exp: inAnHour }));

    expect(apiClient.isAuthenticated()).toBe(true);
    expect(localStorage.getItem("access_token")).not.toBeNull();
  });

  it("isAuthenticated returns false for a malformed token", () => {
    apiClient.setToken("not.a.jwt");
    expect(apiClient.isAuthenticated()).toBe(false);
  });

  it("isAuthenticated returns false when no token has been set", () => {
    expect(apiClient.isAuthenticated()).toBe(false);
  });
});

// --- Data fetching ---------------------------------------------------------

describe("apiClient — data fetching", () => {
  it("getCurrentUser hits /users/me and returns the parsed profile", async () => {
    const profile = {
      id: "u-1",
      email: "ada@example.com",
      full_name: "Ada",
      is_admin: false,
      is_pro: false,
      preferences: {},
      created_at: "2024-01-01T00:00:00Z",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(profile));

    const result = await apiClient.getCurrentUser();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/users\/me$/);
    expect(result).toMatchObject({
      id: "u-1",
      email: "ada@example.com",
      is_admin: false,
    });
  });
});
