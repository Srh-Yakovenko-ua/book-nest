import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { RealtimeGateway } from "./api/realtime.gateway.js";
import { RealtimeConnectionRegistry } from "./application/realtime-connection.registry.js";
import { RealtimeConnectionService } from "./application/realtime-connection.service.js";
import { RealtimeSessionRevocation } from "./application/realtime-session-revocation.js";
import { RealtimePort } from "./domain/realtime.port.js";
import { SocketIoRealtimeAdapter } from "./infrastructure/socket-io-realtime.adapter.js";

@Module({
  exports: [RealtimePort],
  imports: [AuthModule],
  providers: [
    RealtimeConnectionRegistry,
    RealtimeConnectionService,
    RealtimeGateway,
    RealtimeSessionRevocation,
    SocketIoRealtimeAdapter,
    { provide: RealtimePort, useExisting: SocketIoRealtimeAdapter },
  ],
})
export class RealtimeModule {}
