import type { Nullable } from "@app/shared";

import { REALTIME_CONTRACT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { RealtimeEmit } from "../domain/realtime.port.js";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.js";

import { createLogger } from "../../../core/logger.js";
import { REALTIME_ADMISSION } from "../domain/realtime-admission.js";
import { RealtimePort } from "../domain/realtime.port.js";

const log = createLogger("realtime.adapter");

@Injectable()
export class SocketIoRealtimeAdapter extends RealtimePort {
  private server: Nullable<RealtimeServer> = null;

  attach(server: RealtimeServer): void {
    this.server = server;
  }

  countAuthenticatedConnections(): number {
    return this.server?.sockets.sockets.size ?? 0;
  }

  emitToUser({ event, userId }: RealtimeEmit): void {
    if (this.server === null) {
      log.warn({ eventType: event.type, userId }, "realtime server not attached, dropping event");
      return;
    }
    try {
      this.server.to(userId).emit(REALTIME_CONTRACT.channel, event);
    } catch (error) {
      log.warn({ err: error, eventType: event.type, userId }, "failed to emit realtime event");
    }
  }

  tryJoinUserRoom({ socket, userId }: { socket: RealtimeSocket; userId: string }): boolean {
    const alreadyJoined = socket.nsp.adapter.rooms.get(userId)?.size ?? 0;
    if (alreadyJoined >= REALTIME_ADMISSION.maxConnectionsPerUser) {
      return false;
    }
    void socket.join(userId);
    return true;
  }
}
