import { createHash } from "node:crypto";

const QUEUE_VERSION_LENGTH = 16;

export function computeQueueVersion(queued: Array<{ id: string; queuePosition: number }>): string {
  const serialized = [...queued]
    .sort((first, second) => first.queuePosition - second.queuePosition)
    .map((entry) => `${entry.id}:${entry.queuePosition}`)
    .join("\n");

  return createHash("sha256").update(serialized).digest("hex").slice(0, QUEUE_VERSION_LENGTH);
}
