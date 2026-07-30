import type { Nullable, RealtimeErrorCode } from "@app/shared";
import type { IncomingMessage } from "node:http";

import { REALTIME_CONTRACT } from "@app/shared";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from "@nestjs/websockets";
import { differenceInMilliseconds } from "date-fns";

import type { RealtimeServer, RealtimeSocket } from "../infrastructure/realtime-socket.js";

import { env } from "../../../config/env.js";
import { createLogger } from "../../../core/logger.js";
import { RealtimeConnectionRegistry } from "../application/realtime-connection.registry.js";
import { RealtimeConnectionService } from "../application/realtime-connection.service.js";
import { isAllowedOrigin, resolveSourceBucket } from "../domain/realtime-handshake.js";
import { REALTIME_TRANSPORT } from "../domain/realtime-transport.js";
import { SocketIoRealtimeAdapter } from "../infrastructure/socket-io-realtime.adapter.js";

type EngineConnection = RealtimeSocket["conn"];

const INBOUND_MESSAGE_PACKET = "message";

const log = createLogger("realtime.gateway");

@WebSocketGateway({
  connectTimeout: REALTIME_TRANSPORT.connectTimeoutMs,
  maxHttpBufferSize: REALTIME_TRANSPORT.maxHttpBufferSizeBytes,
  path: REALTIME_CONTRACT.path,
  serveClient: false,
  transports: ["websocket"],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit<RealtimeServer>
{
  private readonly tokenExpiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly connectionRegistry: RealtimeConnectionRegistry,
    private readonly connectionService: RealtimeConnectionService,
    private readonly realtimeAdapter: SocketIoRealtimeAdapter,
  ) {}

  afterInit(server: RealtimeServer): void {
    this.realtimeAdapter.attach(server);
    server.engine.opts.allowRequest = (request, callback) => {
      this.reserveConnectionSlot({ callback, request });
    };
    server.engine.on("connection", (connection: EngineConnection) => {
      this.limitInboundMessages(connection);
    });
    server.use((socket, next) => {
      void this.admitSocket({ next, socket });
    });
  }

  handleConnection(socket: RealtimeSocket): void {
    this.scheduleTokenExpiry(socket);
    log.debug({ socketId: socket.id, userId: socket.data.userId }, "realtime client connected");
  }

  handleDisconnect(socket: RealtimeSocket): void {
    this.clearTokenExpiry(socket);
    log.debug({ socketId: socket.id, userId: socket.data.userId }, "realtime client disconnected");
  }

  private async admitSocket({
    next,
    socket,
  }: {
    next: (error?: Error) => void;
    socket: RealtimeSocket;
  }): Promise<void> {
    try {
      const origin = socket.handshake.headers.origin;
      if (!isAllowedOrigin({ allowedOrigins: env.corsOrigins, origin })) {
        log.warn({ origin }, "realtime handshake refused: origin not allowed");
        this.rejectSocket({ code: REALTIME_CONTRACT.errorCodes.forbiddenOrigin, next, socket });
        return;
      }

      const admission = await this.connectionService.admit({
        authorizationHeader: socket.handshake.headers.authorization,
        handshakeAuth: socket.handshake.auth,
      });

      if (admission.status === "rejected") {
        this.rejectSocket({ code: admission.code, next, socket });
        return;
      }

      if (!this.realtimeAdapter.tryJoinUserRoom({ socket, userId: admission.userId })) {
        this.rejectSocket({ code: REALTIME_CONTRACT.errorCodes.connectionLimit, next, socket });
        return;
      }

      socket.data.accessTokenExpiresAt = admission.accessTokenExpiresAt;
      socket.data.userId = admission.userId;
      next();
    } catch (error) {
      log.error({ err: error, socketId: socket.id }, "realtime handshake failed");
      this.rejectSocket({ code: REALTIME_CONTRACT.errorCodes.unauthorized, next, socket });
    }
  }

  private clearTokenExpiry(socket: RealtimeSocket): void {
    const timer = this.tokenExpiryTimers.get(socket.id);
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    this.tokenExpiryTimers.delete(socket.id);
  }

  private limitInboundMessages(connection: EngineConnection): void {
    let inboundMessages = 0;
    connection.on("packet", (packet: { type: string }) => {
      if (packet.type !== INBOUND_MESSAGE_PACKET) {
        return;
      }
      inboundMessages += 1;
      if (inboundMessages <= REALTIME_TRANSPORT.maxInboundMessages) {
        return;
      }
      log.warn({ inboundMessages }, "realtime connection exceeded its inbound budget");
      connection.close(true);
    });
  }

  private rejectSocket({
    code,
    next,
    socket,
  }: {
    code: RealtimeErrorCode;
    next: (error?: Error) => void;
    socket: RealtimeSocket;
  }): void {
    log.warn({ code, socketId: socket.id }, "realtime handshake rejected");
    next(new Error(code));
    setImmediate(() => {
      socket.conn.close();
    });
  }

  private reserveConnectionSlot({
    callback,
    request,
  }: {
    callback: (error: Nullable<string> | undefined, success: boolean) => void;
    request: IncomingMessage;
  }): void {
    const sourceBucket = resolveSourceBucket({
      forwardedFor: request.headers["x-forwarded-for"],
      remoteAddress: request.socket.remoteAddress,
      trustForwardedHeader: env.trustProxy,
    });

    if (!this.connectionRegistry.tryAcquire(sourceBucket)) {
      log.warn({ sourceBucket }, "realtime upgrade refused: connection limit reached");
      callback(REALTIME_CONTRACT.errorCodes.connectionLimit, false);
      return;
    }

    request.socket.once("close", () => {
      this.connectionRegistry.release(sourceBucket);
    });
    callback(undefined, true);
  }

  private scheduleTokenExpiry(socket: RealtimeSocket): void {
    const remainingMs = Math.max(
      0,
      differenceInMilliseconds(socket.data.accessTokenExpiresAt, new Date()),
    );

    const timer = setTimeout(() => {
      log.info(
        { socketId: socket.id, userId: socket.data.userId },
        "realtime access token expired, closing the socket",
      );
      socket.disconnect(true);
    }, remainingMs);
    timer.unref();

    this.tokenExpiryTimers.set(socket.id, timer);
  }
}
