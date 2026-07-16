import type { ReadingStatus } from "@app/shared";

export function readingStatusTitleKey(status: ReadingStatus): "summaryTitle" | "title" {
  return status === "finished" ? "summaryTitle" : "title";
}
