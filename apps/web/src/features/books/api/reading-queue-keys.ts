import type { SeriesOrderFixInput } from "@app/shared";
import type { QueryKey } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";
import type {
  ReadingQueueControllerGetQueueParams,
  SeriesOrderCheckControllerListIssuesParams,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

const READING_QUEUE_ROOTS = {
  queue: "/api/reading-queue",
  seriesOrderFixPreview: "/api/reading-queue/series-order-issues/preview",
  seriesOrderIssues: "/api/reading-queue/series-order-issues",
  summary: "/api/reading-queue/summary",
  volumeSummary: "/api/reading-queue/volume-summary",
} as const;

export const readingQueueKeys = {
  queue: (params?: ReadingQueueControllerGetQueueParams) =>
    params === undefined
      ? ([READING_QUEUE_ROOTS.queue] as const)
      : ([READING_QUEUE_ROOTS.queue, params] as const),
  seriesOrderFixPreview: (fingerprint: string, input: SeriesOrderFixInput) =>
    [READING_QUEUE_ROOTS.seriesOrderFixPreview, fingerprint, input] as const,
  seriesOrderIssues: {
    all: [READING_QUEUE_ROOTS.seriesOrderIssues] as const,
    list: (params: SeriesOrderCheckControllerListIssuesParams) =>
      [READING_QUEUE_ROOTS.seriesOrderIssues, params] as const,
  },
  summary: [READING_QUEUE_ROOTS.summary] as const,
  volumeSummary: [READING_QUEUE_ROOTS.volumeSummary] as const,
};

const matchesReadingQueueRoot = matchesApiRoot(READING_QUEUE_ROOTS.queue);

const matchesVersionPinnedFixPreview = matchesApiRoot(READING_QUEUE_ROOTS.seriesOrderFixPreview);

export const matchesReadingQueueKey: QueryKeyMatcher = (query) =>
  matchesReadingQueueRoot(query) && !matchesVersionPinnedFixPreview(query);

export function matchesUnfilteredReadingQueueKey({ queryKey }: { queryKey: QueryKey }): boolean {
  const [root, params, ...rest] = queryKey;
  return root === READING_QUEUE_ROOTS.queue && rest.length === 0 && isUnfilteredQueueParams(params);
}

function isUnfilteredQueueParams(params: unknown): boolean {
  if (params === undefined) return true;
  if (typeof params !== "object" || params === null) return false;
  return Object.values(params).every(
    (value) => value === undefined || (Array.isArray(value) && value.length === 0),
  );
}
