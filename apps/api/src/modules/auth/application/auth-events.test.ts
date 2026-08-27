import { describe, expect, it, vi } from "vitest";

import { AuthEvents } from "./auth-events.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("AuthEvents.emitSessionsRevoked", () => {
  it("hands the revoked user id to a listener registered before the emit", () => {
    const authEvents = new AuthEvents();
    const listener = vi.fn();
    authEvents.onSessionsRevoked(listener);

    authEvents.emitSessionsRevoked({ userId: USER_ID });

    expect(listener).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it("does not throw when nobody listens", () => {
    const authEvents = new AuthEvents();

    expect(() => authEvents.emitSessionsRevoked({ userId: USER_ID })).not.toThrow();
  });
});
