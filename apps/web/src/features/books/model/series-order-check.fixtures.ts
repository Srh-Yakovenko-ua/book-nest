import type {
  ApplySeriesOrderFixResponse,
  MediaView,
  SeriesOrderBookView,
  SeriesOrderFixPreviewView,
  SeriesOrderIssuesView,
  SeriesOrderIssueView,
  SeriesOrderPositionView,
} from "@app/shared";

import {
  ApplySeriesOrderFixResponseSchema,
  SeriesOrderFixPreviewViewSchema,
  SeriesOrderIssuesViewSchema,
  SeriesOrderIssueViewSchema,
} from "@app/shared";

export const AFFECTED_BOOK_TITLE = "Друга книга";
export const PREVIOUS_BOOK_TITLE = "Перша книга";
export const SERIES_TITLE = "Тестова серія";
export const QUEUE_VERSION = "queue-version-1";

export function makeApplySeriesOrderFixResponse(
  overrides: Partial<ApplySeriesOrderFixResponse> = {},
): ApplySeriesOrderFixResponse {
  return ApplySeriesOrderFixResponseSchema.parse({
    addedBookIds: ["book-previous"],
    changedBookIds: ["book-affected"],
    queueVersion: "queue-version-2",
    resolvedFingerprint: "fp-1",
    success: true,
    ...overrides,
  });
}

export function makeSeriesOrderBook(
  overrides: Partial<SeriesOrderBookView> = {},
): SeriesOrderBookView {
  return {
    cover: null,
    id: "book-affected",
    isCurrentReading: false,
    ownershipStatus: "owned",
    queuePosition: 1,
    readingStatus: "not_started",
    seriesPosition: 2,
    title: AFFECTED_BOOK_TITLE,
    ...overrides,
  };
}

export function makeSeriesOrderCover(overrides: Partial<MediaView> = {}): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-01-15T10:00:00.000Z",
    height: 800,
    id: "media-1",
    kind: "book_cover",
    name: "cover.webp",
    sizeBytes: 1024,
    urls: {
      card: "https://cdn.test/card.webp",
      full: "https://cdn.test/full.webp",
      thumb: "https://cdn.test/thumb.webp",
    },
    width: 600,
    ...overrides,
  };
}

export function makeSeriesOrderFixPreview(
  overrides: Partial<SeriesOrderFixPreviewView> = {},
): SeriesOrderFixPreviewView {
  return SeriesOrderFixPreviewViewSchema.parse({
    addedBooksCount: 1,
    after: [
      {
        belongsToAffectedSeries: true,
        bookId: "book-previous",
        queuePosition: 1,
        title: PREVIOUS_BOOK_TITLE,
      },
      {
        belongsToAffectedSeries: true,
        bookId: "book-affected",
        queuePosition: 2,
        title: AFFECTED_BOOK_TITLE,
      },
    ],
    before: [
      {
        belongsToAffectedSeries: true,
        bookId: "book-affected",
        queuePosition: 1,
        title: AFFECTED_BOOK_TITLE,
      },
    ],
    changes: [
      {
        bookId: "book-previous",
        fromPosition: null,
        title: PREVIOUS_BOOK_TITLE,
        toPosition: 1,
        type: "add",
      },
      {
        bookId: "book-affected",
        fromPosition: 1,
        title: AFFECTED_BOOK_TITLE,
        toPosition: 2,
        type: "move",
      },
    ],
    fingerprint: "fp-1",
    movedBooksCount: 1,
    queueVersion: QUEUE_VERSION,
    series: { id: "series-1", title: SERIES_TITLE },
    shiftedUnrelatedBooksCount: 0,
    strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    warnings: [],
    ...overrides,
  });
}

export function makeSeriesOrderIssue(
  overrides: Partial<SeriesOrderIssueView> = {},
): SeriesOrderIssueView {
  return SeriesOrderIssueViewSchema.parse({
    affectedBook: makeSeriesOrderBook(),
    allowedActions: ["ADD_NEXT_PREVIOUS_BEFORE", "IGNORE_ISSUE", "DISABLE_SERIES_CHECK"],
    currentOrder: [
      makeSeriesOrderPosition(),
      makeSeriesOrderPosition({
        bookId: "book-previous",
        queuePosition: null,
        seriesPosition: 1,
        title: PREVIOUS_BOOK_TITLE,
      }),
    ],
    fingerprint: "fp-1",
    previousBook: makeSeriesOrderBook({
      id: "book-previous",
      queuePosition: null,
      seriesPosition: 1,
      title: PREVIOUS_BOOK_TITLE,
    }),
    problemType: "missing_previous_from_queue",
    recommendedOrder: [
      makeSeriesOrderPosition({
        bookId: "book-previous",
        queuePosition: 1,
        seriesPosition: 1,
        title: PREVIOUS_BOOK_TITLE,
      }),
      makeSeriesOrderPosition({ queuePosition: 2 }),
    ],
    relatedProblems: [],
    series: { id: "series-1", title: SERIES_TITLE },
    severity: "warning",
    unresolvedPreviousCount: 1,
    ...overrides,
  });
}

export function makeSeriesOrderIssues(count: number): SeriesOrderIssueView[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    return makeSeriesOrderIssue({
      fingerprint: `fp-${position}`,
      series: { id: `series-${position}`, title: `Серія ${position}` },
    });
  });
}

export function makeSeriesOrderIssuesView({
  items = [makeSeriesOrderIssue()],
  queueVersion = QUEUE_VERSION,
  total,
}: {
  items?: SeriesOrderIssueView[];
  queueVersion?: string;
  total?: number;
} = {}): SeriesOrderIssuesView {
  return SeriesOrderIssuesViewSchema.parse({
    items,
    queueVersion,
    total: total ?? items.length,
  });
}

export function makeSeriesOrderPosition(
  overrides: Partial<SeriesOrderPositionView> = {},
): SeriesOrderPositionView {
  return {
    bookId: "book-affected",
    cover: null,
    queuePosition: 1,
    seriesPosition: 2,
    title: AFFECTED_BOOK_TITLE,
    ...overrides,
  };
}
