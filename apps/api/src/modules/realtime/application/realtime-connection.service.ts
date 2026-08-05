import { REALTIME_CONTRACT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { RealtimeAdmission } from "../domain/realtime-admission.js";
import type { RealtimeHandshake } from "../domain/realtime-handshake.js";

import { AccessTokenAuthenticator } from "../../auth/index.js";
import { REALTIME_ADMISSION } from "../domain/realtime-admission.js";
import { extractHandshakeToken } from "../domain/realtime-handshake.js";
import { SocketIoRealtimeAdapter } from "../infrastructure/socket-io-realtime.adapter.js";

@Injectable()
export class RealtimeConnectionService {
  constructor(
    private readonly accessTokenAuthenticator: AccessTokenAuthenticator,
    private readonly realtimeAdapter: SocketIoRealtimeAdapter,
  ) {}

  async admit({
    authorizationHeader,
    handshakeAuth,
  }: RealtimeHandshake): Promise<RealtimeAdmission> {
    const token = extractHandshakeToken({ authorizationHeader, handshakeAuth });
    if (token === null) {
      return { code: REALTIME_CONTRACT.errorCodes.unauthorized, status: "rejected" };
    }

    if (
      this.realtimeAdapter.countAuthenticatedConnections() >=
      REALTIME_ADMISSION.maxAuthenticatedConnections
    ) {
      return { code: REALTIME_CONTRACT.errorCodes.connectionLimit, status: "rejected" };
    }

    const session = await this.accessTokenAuthenticator.authenticate({ token });
    if (session === null) {
      return { code: REALTIME_CONTRACT.errorCodes.unauthorized, status: "rejected" };
    }

    return {
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      status: "admitted",
      userId: session.user.id,
    };
  }
}
