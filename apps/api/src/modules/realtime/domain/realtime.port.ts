import type { RealtimeEvent } from "@app/shared";

export type RealtimeEmit = {
  event: RealtimeEvent;
  userId: string;
};

export abstract class RealtimePort {
  abstract disconnectUser(target: { userId: string }): void;
  abstract emitToUser(emit: RealtimeEmit): void;
  abstract hasListeners(target: { userId: string }): Promise<boolean>;
}
