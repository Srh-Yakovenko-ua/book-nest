"use client";

import type { Nullable, RealtimeErrorCode } from "@app/shared";

import { REALTIME_CONTRACT } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { getAuthBridge } from "@/lib/auth-bridge";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http-client";
import { createLogger } from "@/lib/logger";

import { applyRealtimeEvent, parseRealtimeFrame } from "../model/realtime-events";

type ConnectErrorAction = "backoff" | "reauthenticate" | "reconnectLater" | "stop";

const CONNECT_ERROR_ACTIONS = {
  [REALTIME_CONTRACT.errorCodes.connectionLimit]: "stop",
  [REALTIME_CONTRACT.errorCodes.forbiddenOrigin]: "stop",
  [REALTIME_CONTRACT.errorCodes.unauthorized]: "reauthenticate",
} as const satisfies Record<RealtimeErrorCode, ConnectErrorAction>;

const RECONNECTION = {
  delayMaxMs: 30_000,
  manualDelayJitterMs: 4_000,
  manualDelayMinMs: 1_000,
  serverDisconnectReason: "io server disconnect",
} as const satisfies {
  delayMaxMs: number;
  manualDelayJitterMs: number;
  manualDelayMinMs: number;
  serverDisconnectReason: string;
};

const SESSION_REVOKED_STATUS = 401;

const log = createLogger("realtime");

export function useRealtimeConnection(): void {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    const initialToken = useAuthStore.getState().accessToken;
    if (initialToken === null) return;

    const socket = io(env.NEXT_PUBLIC_REALTIME_URL || window.location.origin, {
      auth: { token: initialToken },
      path: REALTIME_CONTRACT.path,
      reconnectionDelayMax: RECONNECTION.delayMaxMs,
      transports: ["websocket"],
    });

    let presentedToken = initialToken;
    let reauthenticationSpent = false;
    let manualReconnectTimer: Nullable<ReturnType<typeof setTimeout>> = null;

    const handshakeWith = (token: string): void => {
      presentedToken = token;
      socket.auth = { token };
      socket.connect();
    };

    const reconnectAfterJitteredDelay = (): void => {
      if (manualReconnectTimer !== null) return;
      manualReconnectTimer = setTimeout(
        () => {
          manualReconnectTimer = null;
          socket.connect();
        },
        RECONNECTION.manualDelayMinMs + Math.random() * RECONNECTION.manualDelayJitterMs,
      );
    };

    const reauthenticate = (): void => {
      if (reauthenticationSpent) {
        log.warn("handshake still unauthorized after a token refresh, giving up");
        socket.disconnect();
        return;
      }

      const authBridge = getAuthBridge();
      if (authBridge === null) {
        log.warn("no auth bridge is registered, cannot refresh the handshake token");
        socket.disconnect();
        return;
      }

      reauthenticationSpent = true;
      void authBridge
        .refresh()
        .then(handshakeWith)
        .catch((error: unknown) => {
          log.warn("token refresh for the realtime handshake failed", error);
          if (error instanceof ApiError && error.status === SESSION_REVOKED_STATUS) {
            authBridge.onRefreshFailed();
          }
          socket.disconnect();
        });
    };

    socket.on("connect", () => {
      reauthenticationSpent = false;
    });

    socket.on(REALTIME_CONTRACT.channel, (payload: unknown) => {
      const event = parseRealtimeFrame(payload);
      if (event === null) return;
      applyRealtimeEvent({ event, queryClient });
    });

    socket.on("connect_error", (error) => {
      const action = resolveConnectErrorAction({
        message: error.message,
        retriedBySocketIo: socket.active,
      });

      switch (action) {
        case "backoff":
          log.debug("handshake failed, socket.io will retry", error.message);
          return;
        case "reauthenticate":
          reauthenticate();
          return;
        case "reconnectLater":
          log.warn("handshake refused for an unrecognised reason, retrying later", error.message);
          reconnectAfterJitteredDelay();
          return;
        case "stop":
          log.warn("handshake refused, no retry will help", error.message);
          socket.disconnect();
          return;
        default:
          return assertNever(action);
      }
    });

    socket.on("disconnect", (reason) => {
      if (reason !== RECONNECTION.serverDisconnectReason) return;
      reconnectAfterJitteredDelay();
    });

    const unsubscribeFromToken = useAuthStore.subscribe((state) => {
      if (state.accessToken === null || state.accessToken === presentedToken) return;
      socket.disconnect();
      handshakeWith(state.accessToken);
    });

    return () => {
      unsubscribeFromToken();
      if (manualReconnectTimer !== null) clearTimeout(manualReconnectTimer);
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, [queryClient, status]);
}

function assertNever(value: never): never {
  throw new Error(`unhandled realtime connect error action: ${JSON.stringify(value)}`);
}

function isRealtimeErrorCode(value: string): value is RealtimeErrorCode {
  return Object.hasOwn(CONNECT_ERROR_ACTIONS, value);
}

function resolveConnectErrorAction({
  message,
  retriedBySocketIo,
}: {
  message: string;
  retriedBySocketIo: boolean;
}): ConnectErrorAction {
  if (isRealtimeErrorCode(message)) return CONNECT_ERROR_ACTIONS[message];
  return retriedBySocketIo ? "backoff" : "reconnectLater";
}
