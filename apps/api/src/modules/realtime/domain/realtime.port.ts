import type { RealtimeEvent } from "@app/shared";

export type RealtimeEmit = {
  event: RealtimeEvent;
  userId: string;
};

export abstract class RealtimePort {
  abstract emitToUser(emit: RealtimeEmit): void;
}
