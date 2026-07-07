import type { ReadingQueuePlacement } from "@app/shared";

export const QUEUE_POSITION_NOT_INTEGER_MESSAGE = "Позиція має бути цілим числом";
export const QUEUE_POSITION_NOT_POSITIVE_MESSAGE = "Позиція має бути більшою за 0";
export const QUEUE_POSITION_TOO_LARGE_MESSAGE =
  "Позиція не може бути більшою за кількість книг у черзі + 1";

export type QueueInsertPositionResult =
  | { message: string; ok: false }
  | { ok: true; position: number };

export function computeQueueInsertPosition({
  count,
  placement,
  position,
}: {
  count: number;
  placement: ReadingQueuePlacement;
  position?: number;
}): QueueInsertPositionResult {
  if (placement === "end") {
    return { ok: true, position: count + 1 };
  }
  if (placement === "start") {
    return { ok: true, position: 1 };
  }
  if (position === undefined) {
    return { message: QUEUE_POSITION_NOT_POSITIVE_MESSAGE, ok: false };
  }
  if (!Number.isInteger(position)) {
    return { message: QUEUE_POSITION_NOT_INTEGER_MESSAGE, ok: false };
  }
  if (position < 1) {
    return { message: QUEUE_POSITION_NOT_POSITIVE_MESSAGE, ok: false };
  }
  if (position > count + 1) {
    return { message: QUEUE_POSITION_TOO_LARGE_MESSAGE, ok: false };
  }

  return { ok: true, position };
}
