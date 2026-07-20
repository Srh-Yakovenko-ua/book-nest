import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerAuthBridge } from "@/lib/auth-bridge";
import { ApiError, request } from "@/lib/http-client";

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request error parsing", () => {
  beforeEach(() => {
    registerAuthBridge({
      getAccessToken: () => null,
      onRefreshFailed: () => {},
      refresh: () => Promise.reject(new Error("no refresh")),
    });
  });

  it("maps field errors to fieldErrors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errorsMessages: [{ field: "email", message: "taken" }] }, 400),
    );

    const error = await captureError(request("/api/profile"));

    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual([{ field: "email", message: "taken" }]);
    expect(error.code).toBeUndefined();
  });

  it("maps general error body to message and code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "email_not_verified", message: "Email is not verified", requestId: "req-1" },
        403,
      ),
    );

    const error = await captureError(request("/api/profile"));

    expect(error.status).toBe(403);
    expect(error.message).toBe("Email is not verified");
    expect(error.code).toBe("email_not_verified");
  });
});

describe("request bearer attach", () => {
  it("adds Authorization header when a token is present", async () => {
    registerAuthBridge({
      getAccessToken: () => "token-123",
      onRefreshFailed: () => {},
      refresh: () => Promise.reject(new Error("no refresh")),
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await request("/api/profile");

    const [, init] = fetchMock.mock.lastCall as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(init.credentials).toBe("include");
  });
});

describe("request refresh-on-401 single-flight", () => {
  it("routes concurrent 401s through one shared refresh and retries each request", async () => {
    let token = "old";
    const rotateToken = vi.fn(() => {
      token = "new";
      return Promise.resolve(token);
    });
    let inFlight: null | Promise<string> = null;
    const refresh = (): Promise<string> => {
      inFlight ??= rotateToken().finally(() => {
        inFlight = null;
      });
      return inFlight;
    };
    registerAuthBridge({
      getAccessToken: () => token,
      onRefreshFailed: () => {},
      refresh,
    });

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers.Authorization === "Bearer new")
        return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({ message: "expired" }, 401));
    });

    const [a, b] = await Promise.all([
      request<{ ok: boolean }>("/api/profile"),
      request<{ ok: boolean }>("/api/books"),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(rotateToken).toHaveBeenCalledTimes(1);
  });

  it("clears session and propagates the 401 when refresh fails", async () => {
    const onRefreshFailed = vi.fn();
    registerAuthBridge({
      getAccessToken: () => "old",
      onRefreshFailed,
      refresh: () => Promise.reject(new Error("refresh failed")),
    });

    fetchMock.mockResolvedValue(jsonResponse({ message: "expired" }, 401));

    const error = await captureError(request("/api/profile"));

    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(401);
  });

  it("does not refresh for auth endpoints", async () => {
    const refresh = vi.fn(() => Promise.resolve("new"));
    registerAuthBridge({
      getAccessToken: () => "old",
      onRefreshFailed: () => {},
      refresh,
    });

    fetchMock.mockResolvedValue(jsonResponse({ message: "bad credentials" }, 401));

    await request("/api/auth/login", { method: "POST" }).catch(() => {});

    expect(refresh).not.toHaveBeenCalled();
  });
});
