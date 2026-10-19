import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

const AUTH_EVENT_NAMES = {
  sessionsRevoked: "auth.sessions_revoked",
} as const satisfies Record<string, string>;

type AuthEventMap = {
  [AUTH_EVENT_NAMES.sessionsRevoked]: [SessionsRevoked];
};

type SessionsRevoked = {
  userId: string;
};

@Injectable()
export class AuthEvents {
  private readonly emitter = new EventEmitter<AuthEventMap>();

  emitSessionsRevoked({ userId }: SessionsRevoked): void {
    this.emitter.emit(AUTH_EVENT_NAMES.sessionsRevoked, { userId });
  }

  onSessionsRevoked(listener: (payload: SessionsRevoked) => void): void {
    this.emitter.on(AUTH_EVENT_NAMES.sessionsRevoked, listener);
  }
}
