import { Injectable, type OnModuleInit } from "@nestjs/common";

import { AuthEvents } from "../../auth/index.js";
import { RealtimePort } from "../domain/realtime.port.js";

@Injectable()
export class RealtimeSessionRevocation implements OnModuleInit {
  constructor(
    private readonly authEvents: AuthEvents,
    private readonly realtime: RealtimePort,
  ) {}

  onModuleInit(): void {
    this.authEvents.onSessionsRevoked(({ userId }) => {
      this.realtime.disconnectUser({ userId });
    });
  }
}
