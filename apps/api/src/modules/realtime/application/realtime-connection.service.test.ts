import { REALTIME_CONTRACT } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { AccessTokenAuthenticator, AuthenticatedUser } from "../../auth/index.js";
import type { RealtimeHandshake } from "../domain/realtime-handshake.js";
import type { SocketIoRealtimeAdapter } from "../infrastructure/socket-io-realtime.adapter.js";

import { fakeOf } from "../../../test/fake.js";
import { REALTIME_ADMISSION } from "../domain/realtime-admission.js";
import { RealtimeConnectionService } from "./realtime-connection.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VALID_TOKEN = "valid-access-token";

function authenticatedUser(): AuthenticatedUser {
  return {
    createdAt: new Date("2026-07-28T10:00:00.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: new Date("2026-07-28T10:00:00.000Z"),
    id: USER_ID,
    name: "Reader",
    nickname: "reader",
    role: "user",
  };
}

function buildService(
  overrides: {
    authenticatedConnections?: number;
  } = {},
): {
  authenticate: ReturnType<typeof vi.fn>;
  service: RealtimeConnectionService;
} {
  const authenticate = vi
    .fn()
    .mockImplementation(({ token }: { token: string }) =>
      Promise.resolve(token === VALID_TOKEN ? authenticatedUser() : null),
    );

  const service = new RealtimeConnectionService(
    fakeOf<AccessTokenAuthenticator>({ authenticate }),
    fakeOf<SocketIoRealtimeAdapter>({
      countAuthenticatedConnections: () => overrides.authenticatedConnections ?? 0,
    }),
  );

  return { authenticate, service };
}

function handshake(overrides: Partial<RealtimeHandshake> = {}): RealtimeHandshake {
  return {
    authorizationHeader: undefined,
    handshakeAuth: { token: VALID_TOKEN },
    ...overrides,
  };
}

describe("RealtimeConnectionService.admit", () => {
  it("admits a handshake carrying a valid token for an existing user", async () => {
    const { service } = buildService();

    await expect(service.admit(handshake())).resolves.toEqual({
      status: "admitted",
      userId: USER_ID,
    });
  });

  it("admits a handshake authenticated through the Authorization header", async () => {
    const { authenticate, service } = buildService();

    await expect(
      service.admit(
        handshake({ authorizationHeader: `Bearer ${VALID_TOKEN}`, handshakeAuth: undefined }),
      ),
    ).resolves.toEqual({ status: "admitted", userId: USER_ID });
    expect(authenticate).toHaveBeenCalledWith({ token: VALID_TOKEN });
  });

  it("rejects a handshake without a token before authenticating", async () => {
    const { authenticate, service } = buildService();

    await expect(service.admit(handshake({ handshakeAuth: {} }))).resolves.toEqual({
      code: REALTIME_CONTRACT.errorCodes.unauthorized,
      status: "rejected",
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("rejects a handshake with an invalid token", async () => {
    const { service } = buildService();

    await expect(service.admit(handshake({ handshakeAuth: { token: "nope" } }))).resolves.toEqual({
      code: REALTIME_CONTRACT.errorCodes.unauthorized,
      status: "rejected",
    });
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { authenticate, service } = buildService();
    authenticate.mockResolvedValue(null);

    await expect(service.admit(handshake())).resolves.toEqual({
      code: REALTIME_CONTRACT.errorCodes.unauthorized,
      status: "rejected",
    });
  });

  it("refuses at the authenticated-connection ceiling without paying for authentication", async () => {
    const { authenticate, service } = buildService({
      authenticatedConnections: REALTIME_ADMISSION.maxAuthenticatedConnections,
    });

    await expect(service.admit(handshake())).resolves.toEqual({
      code: REALTIME_CONTRACT.errorCodes.connectionLimit,
      status: "rejected",
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("admits a handshake one slot below the authenticated-connection ceiling", async () => {
    const { service } = buildService({
      authenticatedConnections: REALTIME_ADMISSION.maxAuthenticatedConnections - 1,
    });

    await expect(service.admit(handshake())).resolves.toEqual({
      status: "admitted",
      userId: USER_ID,
    });
  });
});
