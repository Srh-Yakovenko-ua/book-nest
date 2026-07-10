import type { ReadingStatus } from "@app/shared";

const QUEUE_HIDDEN_STATUSES: readonly ReadingStatus[] = ["reading", "rereading", "finished"];

export function shouldShowReadingQueue(status: ReadingStatus): boolean {
  return !QUEUE_HIDDEN_STATUSES.includes(status);
}
