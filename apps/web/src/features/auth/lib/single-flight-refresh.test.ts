import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../model/auth-store";
import { singleFlightRefresh } from "./single-flight-refresh";

const user = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@book.nest",
  emailVerified: true,
  id: "user-1",
  name: "Reader",
  nickname: null,
  role: "user" as const,
};

function authResponse(accessToken: string): Response {
  return new Response(JSON.stringify({ accessToken, user }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

const fetchMock = vi.fn();

const locksStub = {
  request(_name: string, callback: () => Promise<string>): Promise<string> {
    return callback();
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  Object.defineProperty(globalThis.navigator, "locks", { configurable: true, value: locksStub });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis.navigator, "locks", { configurable: true, value: null });
});

describe("singleFlightRefresh", () => {
  it("collapses concurrent calls into one refresh and stores the session once", async () => {
    const setSession = vi.spyOn(useAuthStore.getState(), "setSession").mockImplementation(() => {});
    fetchMock.mockImplementation(() => Promise.resolve(authResponse("token-1")));

    const [first, second] = await Promise.all([singleFlightRefresh(), singleFlightRefresh()]);

    expect(first).toBe("token-1");
    expect(second).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith("token-1", user);
  });

  it("runs a fresh refresh after the previous one succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(authResponse("token-1"))
      .mockResolvedValueOnce(authResponse("token-2"));

    const first = await singleFlightRefresh();
    const second = await singleFlightRefresh();

    expect(first).toBe("token-1");
    expect(second).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects on failure and lets a later call refresh again", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(authResponse("token-2"));

    await expect(singleFlightRefresh()).rejects.toThrow("network down");
    const recovered = await singleFlightRefresh();

    expect(recovered).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
