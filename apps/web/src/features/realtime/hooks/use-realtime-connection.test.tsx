import type { UserView } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { REALTIME_CONTRACT } from "@app/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { registerAuthBridge } from "@/lib/auth-bridge";
import { ApiError } from "@/lib/http-client";
import { getNotificationsControllerUnreadCountQueryKey } from "@/shared/api/generated/endpoints/notifications/notifications";
import { createTestQueryClient } from "@/test-utils";

import { useRealtimeConnection } from "./use-realtime-connection";

type FakeSocket = ReturnType<typeof createFakeSocket>;

type SocketListener = (...args: unknown[]) => void;

const { ioMock } = vi.hoisted(() => ({ ioMock: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: ioMock }));

const USER: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@book-nest.net",
  emailVerified: true,
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reader",
  nickname: "reader",
  role: "user",
};

const DISCONNECT_REASON = {
  client: "io client disconnect",
  server: "io server disconnect",
} as const satisfies Record<string, string>;

const EXPECTED_SOCKET_OPTIONS = {
  auth: { token: "access-token-1" },
  path: REALTIME_CONTRACT.path,
  reconnectionDelayMax: 30_000,
  transports: ["websocket"],
} as const;

const LONGEST_MANUAL_RECONNECT_DELAY_MS = 5_000;

const UNREAD_COUNT = 7;

let socket: FakeSocket;
let onRefreshFailed: Mock<() => void>;
let refresh: Mock<() => Promise<string>>;

function createFakeSocket() {
  const listeners = new Map<string, SocketListener[]>();

  const socket = {
    active: true,
    auth: {} as { token?: string },
    connect: vi.fn(() => socket),
    connected: false,
    disconnect: vi.fn(() => {
      if (!socket.connected) return socket;
      socket.connected = false;
      socket.emitFrame("disconnect", DISCONNECT_REASON.client);
      return socket;
    }),
    emitFrame: (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    on: vi.fn((event: string, listener: SocketListener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return socket;
    }),
    removeAllListeners: vi.fn(() => {
      listeners.clear();
      return socket;
    }),
    simulateConnect: () => {
      socket.connected = true;
      socket.emitFrame("connect");
    },
  };

  return socket;
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function refuseHandshake(message: string) {
  return act(async () => {
    socket.emitFrame("connect_error", new Error(message));
    await Promise.resolve();
  });
}

function renderConnection(client: QueryClient) {
  return renderHook(() => useRealtimeConnection(), { wrapper: makeWrapper(client) });
}

beforeEach(() => {
  socket = createFakeSocket();
  ioMock.mockReset();
  ioMock.mockReturnValue(socket);
  onRefreshFailed = vi.fn<() => void>();
  refresh = vi.fn<() => Promise<string>>(() => Promise.resolve("access-token-1"));
  registerAuthBridge({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onRefreshFailed,
    refresh,
  });
  useAuthStore.getState().setSession("access-token-1", USER);
});

afterEach(() => {
  act(() => {
    useAuthStore.getState().clearSession();
  });
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useRealtimeConnection", () => {
  it("opens no socket while the session is not authenticated", () => {
    useAuthStore.getState().setStatus("loading");

    renderConnection(createTestQueryClient());

    expect(ioMock).not.toHaveBeenCalled();
  });

  it("opens a websocket-only socket that socket.io keeps retrying forever", () => {
    renderConnection(createTestQueryClient());

    expect(ioMock).toHaveBeenCalledWith(expect.any(String), EXPECTED_SOCKET_OPTIONS);
  });

  it("disconnects and drops every listener on unmount", () => {
    const { unmount } = renderConnection(createTestQueryClient());

    expect(ioMock).toHaveBeenCalledTimes(1);

    unmount();

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it("re-handshakes with the new token when the access token rotates", () => {
    renderConnection(createTestQueryClient());

    act(() => {
      useAuthStore.getState().setSession("access-token-2", USER);
    });

    expect(socket.auth).toEqual({ token: "access-token-2" });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("writes the unread count from a notifications.changed frame into the query cache", () => {
    const client = createTestQueryClient();
    renderConnection(client);

    act(() => {
      socket.emitFrame(REALTIME_CONTRACT.channel, {
        type: REALTIME_CONTRACT.events.notificationsChanged,
        unreadCount: UNREAD_COUNT,
      });
    });

    expect(client.getQueryData(getNotificationsControllerUnreadCountQueryKey())).toEqual({
      unreadCount: UNREAD_COUNT,
    });
  });

  it("ignores a frame whose type this client does not know", () => {
    const client = createTestQueryClient();
    renderConnection(client);

    expect(() => {
      act(() => {
        socket.emitFrame(REALTIME_CONTRACT.channel, { somethingNew: true, type: "future.event" });
      });
    }).not.toThrow();

    expect(client.getQueryData(getNotificationsControllerUnreadCountQueryKey())).toBeUndefined();
  });

  it("stops instead of retrying when the gateway reports the connection limit", async () => {
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.connectionLimit);

    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stops instead of retrying when the gateway refuses the origin", async () => {
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.forbiddenOrigin);

    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("leaves a transient handshake failure to socket.io", async () => {
    vi.useFakeTimers();
    renderConnection(createTestQueryClient());
    socket.active = true;

    await refuseHandshake("websocket error");
    act(() => {
      vi.advanceTimersByTime(LONGEST_MANUAL_RECONNECT_DELAY_MS);
    });

    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("retries after a delay when the server denies the handshake for an unknown reason", async () => {
    vi.useFakeTimers();
    renderConnection(createTestQueryClient());
    socket.active = false;

    await refuseHandshake("realtime_some_future_code");
    expect(socket.connect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LONGEST_MANUAL_RECONNECT_DELAY_MS);
    });

    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("reconnects after a delay when the server drops an established socket", () => {
    vi.useFakeTimers();
    renderConnection(createTestQueryClient());

    act(() => {
      socket.emitFrame("disconnect", DISCONNECT_REASON.server);
    });
    expect(socket.connect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LONGEST_MANUAL_RECONNECT_DELAY_MS);
    });

    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect when the client itself closed the socket", () => {
    vi.useFakeTimers();
    renderConnection(createTestQueryClient());

    act(() => {
      socket.simulateConnect();
      socket.disconnect();
    });
    act(() => {
      vi.advanceTimersByTime(LONGEST_MANUAL_RECONNECT_DELAY_MS);
    });

    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("refreshes the token and re-handshakes when the gateway reports an unauthorized handshake", async () => {
    refresh.mockResolvedValue("access-token-2");
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(socket.auth).toEqual({ token: "access-token-2" });
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("re-handshakes even when the refreshed token is byte-identical to the rejected one", async () => {
    refresh.mockResolvedValue("access-token-1");
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(socket.auth).toEqual({ token: "access-token-1" });
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("spends only one refresh when the refreshed token is rejected again", async () => {
    refresh.mockResolvedValue("access-token-1");
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);
    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("refreshes again after the socket reconnects", async () => {
    refresh.mockResolvedValue("access-token-1");
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);
    act(() => {
      socket.simulateConnect();
    });
    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("clears the session when the refresh is rejected as unauthorized", async () => {
    refresh.mockRejectedValue(new ApiError(401, "unauthorized"));
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh fails for a transport reason", async () => {
    refresh.mockRejectedValue(new TypeError("Failed to fetch"));
    renderConnection(createTestQueryClient());

    await refuseHandshake(REALTIME_CONTRACT.errorCodes.unauthorized);

    expect(onRefreshFailed).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });
});
