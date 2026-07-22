import type { QueryKey } from "@tanstack/react-query";

const READING_QUEUE_ROOT = "/api/reading-queue";

export function matchesReadingQueueKey(query: { queryKey: QueryKey }): boolean {
  const [root] = query.queryKey;
  return typeof root === "string" && root.startsWith(READING_QUEUE_ROOT);
}
