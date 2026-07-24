import type { ReadingQueuePlacement } from "@app/shared";

export const QUEUE_POSITION_TOO_LARGE_MESSAGE =
  "Позиція не може бути більшою за кількість книг у черзі + 1";

export type QueueInsertPositionResult =
  { message: string; ok: false } | { ok: true; position: number };

export function computeQueueInsertPosition({
  count,
  maxPosition,
  placement,
  position,
}: {
  count: number;
  maxPosition: number;
  placement: ReadingQueuePlacement;
  position?: number;
}): QueueInsertPositionResult {
  if (placement === "end") {
    return { ok: true, position: maxPosition + 1 };
  }
  if (placement === "start") {
    return { ok: true, position: 1 };
  }
  if (position === undefined || position > count + 1) {
    return { message: QUEUE_POSITION_TOO_LARGE_MESSAGE, ok: false };
  }

  return { ok: true, position };
}
