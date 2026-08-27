import { describe, expect, it, vi } from "vitest";

import type { RealtimePort } from "../domain/realtime.port.js";

import { fakeOf } from "../../../test/fake.js";
import { AuthEvents } from "../../auth/index.js";
import { RealtimeSessionRevocation } from "./realtime-session-revocation.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRevocation(): {
  authEvents: AuthEvents;
  disconnectUser: ReturnType<typeof vi.fn>;
  revocation: RealtimeSessionRevocation;
} {
  const authEvents = new AuthEvents();
  const disconnectUser = vi.fn();
  const realtime = fakeOf<RealtimePort>({
    disconnectUser,
    emitToUser: vi.fn(),
    hasListeners: vi.fn().mockResolvedValue(true),
  });

  return {
    authEvents,
    disconnectUser,
    revocation: new RealtimeSessionRevocation(authEvents, realtime),
  };
}

describe("RealtimeSessionRevocation", () => {
  it("closes the sockets of the user whose sessions were revoked", () => {
    const { authEvents, disconnectUser, revocation } = buildRevocation();
    revocation.onModuleInit();

    authEvents.emitSessionsRevoked({ userId: USER_ID });

    expect(disconnectUser).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it("ignores a revocation emitted before the subscription is wired", () => {
    const { authEvents, disconnectUser } = buildRevocation();

    authEvents.emitSessionsRevoked({ userId: USER_ID });

    expect(disconnectUser).not.toHaveBeenCalled();
  });
});
