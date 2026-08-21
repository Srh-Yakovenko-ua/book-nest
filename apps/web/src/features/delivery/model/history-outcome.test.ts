import type { ReceivedSeriesInsight, ReceivedUnreadView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DeliverySeriesOutcomeLabels, DeliveryUnreadReceivedLabels } from "./history-outcome";

import { buildDeliverySeriesOutcomeRows, buildDeliveryUnreadReceived } from "./history-outcome";

const UNREAD_LABELS: DeliveryUnreadReceivedLabels = {
  booksCount: (count) => `books:${count}`,
  inQueue: (count) => `queue:${count}`,
};

const SERIES_LABELS: DeliverySeriesOutcomeLabels = {
  series_completed: {
    detail: (count) => `completed.detail:${count}`,
    label: (count) => `completed.label:${count}`,
  },
  series_gaps_closed: {
    detail: (count) => `gaps.detail:${count}`,
    label: (count) => `gaps.label:${count}`,
  },
  series_topped_up: {
    detail: (count) => `topped.detail:${count}`,
    label: (count) => `topped.label:${count}`,
  },
};

function buildUnread(unreadReceived: null | ReceivedUnreadView) {
  return buildDeliveryUnreadReceived({ labels: UNREAD_LABELS, unreadReceived });
}

function preview(id: string) {
  return { authorName: `Author ${id}`, cover: null, id, title: `Book ${id}` };
}

function unread(overrides: Partial<ReceivedUnreadView> = {}): ReceivedUnreadView {
  return { bookPreviews: [preview("a")], booksCount: 1, inQueueCount: 0, ...overrides };
}

describe("buildDeliveryUnreadReceived", () => {
  it("has nothing to show while nothing has been received", () => {
    expect(buildUnread(null)).toBeNull();
  });

  it("marks the all-read case so the block can say so", () => {
    const model = buildUnread(unread({ bookPreviews: [], booksCount: 0 }));

    expect(model?.books).toEqual({ kind: "none" });
  });

  it("shows the only waiting book in full", () => {
    expect(buildUnread(unread())?.books).toEqual({
      book: {
        authorName: "Author a",
        bookHref: "/books/a",
        coverSrc: undefined,
        id: "a",
        title: "Book a",
      },
      kind: "single",
    });
  });

  it("stacks at most three covers and keeps the real count", () => {
    const model = buildUnread(
      unread({
        bookPreviews: [preview("a"), preview("b"), preview("c")],
        booksCount: 18,
      }),
    );

    expect(model?.booksCountText).toBe("books:18");
    expect(model?.books.kind === "stack" ? model.books.covers.length : 0).toBe(3);
  });

  it("mentions the reading queue only when some of them already sit in it", () => {
    expect(buildUnread(unread())?.inQueueText).toBeNull();
    expect(buildUnread(unread({ inQueueCount: 4 }))?.inQueueText).toBe("queue:4");
  });
});

describe("buildDeliverySeriesOutcomeRows", () => {
  it("shows nothing when the backend found no insight", () => {
    expect(buildDeliverySeriesOutcomeRows({ insights: [], labels: SERIES_LABELS })).toEqual([]);
  });

  it("keeps the backend order and gives every kind its own icon", () => {
    const insights: ReceivedSeriesInsight[] = [
      { booksCount: 3, kind: "series_completed", seriesCount: 2 },
      { booksCount: 4, kind: "series_gaps_closed", seriesCount: 3 },
      { booksCount: 6, kind: "series_topped_up", seriesCount: 5 },
    ];

    expect(buildDeliverySeriesOutcomeRows({ insights, labels: SERIES_LABELS })).toEqual([
      {
        detail: "completed.detail:3",
        icon: "library-big",
        id: "series_completed",
        label: "completed.label:2",
      },
      { detail: "gaps.detail:4", icon: "layers", id: "series_gaps_closed", label: "gaps.label:3" },
      { detail: "topped.detail:6", icon: "book", id: "series_topped_up", label: "topped.label:5" },
    ]);
  });
});
