import type {
  SeriesOrderActionCode,
  SeriesOrderPositionView,
  SeriesOrderProblemType,
} from "@app/shared";

import { SERIES_ORDER_ERROR_CODES } from "@app/shared";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/http-client";

import type { SeriesOrderErrorKey } from "./series-order-check";

import {
  hasProblemDescription,
  isSeriesOrderFixStrategy,
  isSeriesOrderStaleError,
  SERIES_ORDER_SIDEBAR_LIMIT,
  seriesOrderActionHref,
  seriesOrderActionLabelKey,
  toRecommendedOrderPositions,
  toSeriesOrderComparison,
  toSeriesOrderErrorKey,
  toSeverityStatus,
  visibleSeriesOrderActions,
} from "./series-order-check";
import { makeSeriesOrderIssue } from "./series-order-check.fixtures";

function apiError(status: number, code?: string): ApiError {
  return new ApiError(status, "failed", undefined, code);
}

describe("toSeverityStatus", () => {
  it("maps an error severity to the danger tone", () => {
    expect(toSeverityStatus("error", "Помилка")).toEqual({
      icon: "alert-circle",
      label: "Помилка",
      tone: "danger",
      value: "error",
    });
  });

  it("maps a warning severity to the warning tone", () => {
    expect(toSeverityStatus("warning", "Попередження")).toEqual({
      icon: "alert-triangle",
      label: "Попередження",
      tone: "warning",
      value: "warning",
    });
  });

  it("maps an info severity to the info tone", () => {
    expect(toSeverityStatus("info", "Інформація")).toEqual({
      icon: "info",
      label: "Інформація",
      tone: "info",
      value: "info",
    });
  });
});

describe("seriesOrderActionLabelKey", () => {
  it.each([
    ["ADD_ALL_PREVIOUS_BEFORE", "addAll"],
    ["ADD_NEXT_PREVIOUS_BEFORE", "addBefore"],
    ["ADD_PREVIOUS_TO_WISHLIST", "addToWishlist"],
    ["DISABLE_SERIES_CHECK", "disableSeries"],
    ["IGNORE_ISSUE", "ignore"],
    ["OPEN_LOAN", "openLoan"],
    ["OPEN_ORDER", "openOrder"],
    ["OPEN_PREVIOUS_BOOK", "openBook"],
    ["OPEN_PURCHASE", "openPurchase"],
    ["REORDER_SERIES_SLOTS", "fixOrder"],
    ["RESUME_PREVIOUS_BOOK", "resumeBook"],
  ] as const)("maps %s to the %s label", (code, expected) => {
    expect(seriesOrderActionLabelKey(code, "missing_previous_from_queue")).toBe(expected);
  });

  it("asks to add the next book when several previous books are missing", () => {
    expect(seriesOrderActionLabelKey("ADD_NEXT_PREVIOUS_BEFORE", "multiple_previous_missing")).toBe(
      "addNext",
    );
  });

  it("uses the unified fix-order label even when several books are out of order", () => {
    expect(seriesOrderActionLabelKey("REORDER_SERIES_SLOTS", "multiple_books_out_of_order")).toBe(
      "fixOrder",
    );
  });

  it("asks to go back to the previous book when the current reading is ahead", () => {
    expect(seriesOrderActionLabelKey("OPEN_PREVIOUS_BOOK", "current_reading_ahead_of_order")).toBe(
      "resumeBook",
    );
  });
});

describe("seriesOrderActionHref", () => {
  it.each([
    "OPEN_LOAN",
    "OPEN_ORDER",
    "OPEN_PREVIOUS_BOOK",
    "OPEN_PURCHASE",
    "RESUME_PREVIOUS_BOOK",
  ] as const)("points %s at the previous book", (code) => {
    const issue = makeSeriesOrderIssue();

    expect(seriesOrderActionHref(code, issue)).toBe("/books/book-previous");
  });

  it.each(["ADD_NEXT_PREVIOUS_BEFORE", "ADD_PREVIOUS_TO_WISHLIST", "IGNORE_ISSUE"] as const)(
    "gives %s no href because it is not a navigation action",
    (code) => {
      expect(seriesOrderActionHref(code, makeSeriesOrderIssue())).toBeNull();
    },
  );

  it("gives no href when there is no previous book to open", () => {
    const issue = makeSeriesOrderIssue({ previousBook: null });

    expect(seriesOrderActionHref("OPEN_PREVIOUS_BOOK", issue)).toBeNull();
  });
});

describe("toSeriesOrderErrorKey", () => {
  it.each([
    [SERIES_ORDER_ERROR_CODES.ALREADY_IN_QUEUE, "alreadyInQueue"],
    [SERIES_ORDER_ERROR_CODES.ISSUE_STALE, "issueStale"],
    [SERIES_ORDER_ERROR_CODES.QUEUE_LIMIT_REACHED, "queueLimit"],
    [SERIES_ORDER_ERROR_CODES.QUEUE_STALE, "queueStale"],
  ] as const)("maps the %s code to the %s message", (code, expected) => {
    expect(toSeriesOrderErrorKey(apiError(409, code))).toBe(expected);
  });

  it("maps a 403 without a known code to the forbidden message", () => {
    expect(toSeriesOrderErrorKey(apiError(403))).toBe("forbidden");
  });

  it("maps a 404 without a known code to the not found message", () => {
    expect(toSeriesOrderErrorKey(apiError(404))).toBe("notFound");
  });

  it("falls back to the generic message for an unmapped code", () => {
    expect(
      toSeriesOrderErrorKey(apiError(422, SERIES_ORDER_ERROR_CODES.INVALID_FIX_STRATEGY)),
    ).toBe("generic");
  });

  it("falls back to the generic message for a server error", () => {
    expect(toSeriesOrderErrorKey(apiError(500))).toBe("generic");
  });

  it("falls back to the generic message for a non-api error", () => {
    expect(toSeriesOrderErrorKey(new Error("network down"))).toBe("generic");
  });
});

describe("visibleSeriesOrderActions", () => {
  it("keeps the allowed actions in the order the backend sent them", () => {
    const issue = makeSeriesOrderIssue({
      allowedActions: ["ADD_ALL_PREVIOUS_BEFORE", "ADD_NEXT_PREVIOUS_BEFORE"],
    });

    expect(visibleSeriesOrderActions(issue)).toEqual([
      "ADD_ALL_PREVIOUS_BEFORE",
      "ADD_NEXT_PREVIOUS_BEFORE",
    ]);
  });

  it("hides the actions that belong to the overflow menu", () => {
    const issue = makeSeriesOrderIssue({
      allowedActions: ["REORDER_SERIES_SLOTS", "IGNORE_ISSUE", "DISABLE_SERIES_CHECK"],
    });

    expect(visibleSeriesOrderActions(issue)).toEqual(["REORDER_SERIES_SLOTS"]);
  });

  it("hides the open-previous-book action because the title already links there", () => {
    const issue = makeSeriesOrderIssue({
      allowedActions: ["OPEN_PREVIOUS_BOOK", "RESUME_PREVIOUS_BOOK"],
    });

    expect(visibleSeriesOrderActions(issue)).toEqual(["RESUME_PREVIOUS_BOOK"]);
  });

  it("keeps the open-previous-book action when it is the only remedy for the problem", () => {
    const issue = makeSeriesOrderIssue({
      allowedActions: ["OPEN_PREVIOUS_BOOK"],
      problemType: "current_reading_ahead_of_order",
    });

    expect(visibleSeriesOrderActions(issue)).toEqual(["OPEN_PREVIOUS_BOOK"]);
  });

  it("hides previous-book actions when there is no previous book", () => {
    const issue = makeSeriesOrderIssue({
      allowedActions: ["OPEN_PREVIOUS_BOOK", "ADD_PREVIOUS_TO_WISHLIST", "REORDER_SERIES_SLOTS"],
      previousBook: null,
    });

    expect(visibleSeriesOrderActions(issue)).toEqual(["REORDER_SERIES_SLOTS"]);
  });

  it("returns nothing when the backend allows no actions", () => {
    expect(visibleSeriesOrderActions(makeSeriesOrderIssue({ allowedActions: [] }))).toEqual([]);
  });
});

describe("isSeriesOrderFixStrategy", () => {
  it.each(["ADD_ALL_PREVIOUS_BEFORE", "ADD_NEXT_PREVIOUS_BEFORE", "REORDER_SERIES_SLOTS"] as const)(
    "treats %s as a fix strategy",
    (code) => {
      expect(isSeriesOrderFixStrategy(code)).toBe(true);
    },
  );

  it.each([
    "ADD_PREVIOUS_TO_WISHLIST",
    "DISABLE_SERIES_CHECK",
    "IGNORE_ISSUE",
    "OPEN_LOAN",
    "OPEN_ORDER",
    "OPEN_PREVIOUS_BOOK",
    "OPEN_PURCHASE",
    "RESUME_PREVIOUS_BOOK",
  ] as const satisfies readonly SeriesOrderActionCode[])(
    "does not treat %s as a fix strategy",
    (code) => {
      expect(isSeriesOrderFixStrategy(code)).toBe(false);
    },
  );
});

describe("isSeriesOrderStaleError", () => {
  it.each(["alreadyInQueue", "issueStale", "queueStale"] as const)(
    "treats %s as stale so the dialog can close",
    (key) => {
      expect(isSeriesOrderStaleError(key)).toBe(true);
    },
  );

  it.each([
    "forbidden",
    "generic",
    "notFound",
    "queueLimit",
  ] as const satisfies readonly SeriesOrderErrorKey[])("keeps the dialog open for %s", (key) => {
    expect(isSeriesOrderStaleError(key)).toBe(false);
  });
});

describe("hasProblemDescription", () => {
  it.each([
    "current_reading_ahead_of_order",
    "multiple_previous_missing",
    "previous_book_in_transit",
    "previous_book_lent_out",
    "previous_book_not_owned",
    "previous_book_paused",
    "previous_book_want_to_buy",
  ] as const)("describes %s with a second line", (problemType) => {
    expect(hasProblemDescription(problemType)).toBe(true);
  });

  it.each([
    "missing_previous_from_queue",
    "multiple_books_out_of_order",
    "previous_book_after_later_book",
  ] as const satisfies readonly SeriesOrderProblemType[])(
    "shows %s with a title only",
    (problemType) => {
      expect(hasProblemDescription(problemType)).toBe(false);
    },
  );
});

describe("toRecommendedOrderPositions", () => {
  it("reassigns the occupied slots in reading order", () => {
    const items: SeriesOrderPositionView[] = [
      { bookId: "book-1", cover: null, queuePosition: 10, seriesPosition: 1, title: "Книга 1" },
      { bookId: "book-2", cover: null, queuePosition: 9, seriesPosition: 2, title: "Книга 2" },
    ];

    expect(toRecommendedOrderPositions(items)).toEqual([
      { bookId: "book-1", cover: null, queuePosition: 9, seriesPosition: 1, title: "Книга 1" },
      { bookId: "book-2", cover: null, queuePosition: 10, seriesPosition: 2, title: "Книга 2" },
    ]);
  });

  it("keeps books that are not in the queue as null without consuming a slot", () => {
    const items: SeriesOrderPositionView[] = [
      { bookId: "book-1", cover: null, queuePosition: null, seriesPosition: 1, title: "Книга 1" },
      { bookId: "book-2", cover: null, queuePosition: 5, seriesPosition: 2, title: "Книга 2" },
      { bookId: "book-3", cover: null, queuePosition: 3, seriesPosition: 3, title: "Книга 3" },
    ];

    expect(toRecommendedOrderPositions(items)).toEqual([
      { bookId: "book-1", cover: null, queuePosition: null, seriesPosition: 1, title: "Книга 1" },
      { bookId: "book-2", cover: null, queuePosition: 3, seriesPosition: 2, title: "Книга 2" },
      { bookId: "book-3", cover: null, queuePosition: 5, seriesPosition: 3, title: "Книга 3" },
    ]);
  });

  it("leaves an already ordered list unchanged", () => {
    const items: SeriesOrderPositionView[] = [
      { bookId: "book-1", cover: null, queuePosition: 1, seriesPosition: 1, title: "Книга 1" },
      { bookId: "book-2", cover: null, queuePosition: 2, seriesPosition: 2, title: "Книга 2" },
    ];

    expect(toRecommendedOrderPositions(items)).toEqual(items);
  });

  it("leaves a single-item list unchanged", () => {
    const items: SeriesOrderPositionView[] = [
      { bookId: "book-1", cover: null, queuePosition: 7, seriesPosition: 1, title: "Книга 1" },
    ];

    expect(toRecommendedOrderPositions(items)).toEqual(items);
  });
});

describe("toSeriesOrderComparison", () => {
  it("pairs each queue slot with the book that should occupy it", () => {
    const currentOrder: SeriesOrderPositionView[] = [
      {
        bookId: "b3",
        cover: null,
        queuePosition: 11,
        seriesPosition: 3,
        title: "Зруйнований палац",
      },
      { bookId: "b2", cover: null, queuePosition: 12, seriesPosition: 2, title: "Зламаний принц" },
      {
        bookId: "b1",
        cover: null,
        queuePosition: 13,
        seriesPosition: 1,
        title: "Паперова принцеса",
      },
    ];
    const recommendedOrder: SeriesOrderPositionView[] = [
      {
        bookId: "b1",
        cover: null,
        queuePosition: 13,
        seriesPosition: 1,
        title: "Паперова принцеса",
      },
      { bookId: "b2", cover: null, queuePosition: 12, seriesPosition: 2, title: "Зламаний принц" },
      {
        bookId: "b3",
        cover: null,
        queuePosition: 11,
        seriesPosition: 3,
        title: "Зруйнований палац",
      },
    ];

    const rows = toSeriesOrderComparison(currentOrder, recommendedOrder);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      changed: true,
      current: { bookId: "b3", seriesPosition: 3 },
      queuePosition: 11,
      recommended: { bookId: "b1", seriesPosition: 1 },
    });
    expect(rows[1]).toMatchObject({
      changed: false,
      current: { bookId: "b2" },
      queuePosition: 12,
      recommended: { bookId: "b2" },
    });
    expect(rows[2]).toMatchObject({
      changed: true,
      current: { bookId: "b1", seriesPosition: 1 },
      queuePosition: 13,
      recommended: { bookId: "b3", seriesPosition: 3 },
    });
  });

  it("marks every slot unchanged when the queue already matches the series order", () => {
    const order: SeriesOrderPositionView[] = [
      { bookId: "b1", cover: null, queuePosition: 1, seriesPosition: 1, title: "Перша" },
      { bookId: "b2", cover: null, queuePosition: 2, seriesPosition: 2, title: "Друга" },
    ];

    const rows = toSeriesOrderComparison(order, order);

    expect(rows.map((row) => row.changed)).toEqual([false, false]);
  });

  it("keeps a book outside the queue paired with itself", () => {
    const currentOrder: SeriesOrderPositionView[] = [
      { bookId: "b1", cover: null, queuePosition: null, seriesPosition: 1, title: "Перша" },
    ];
    const recommendedOrder: SeriesOrderPositionView[] = [
      { bookId: "b1", cover: null, queuePosition: null, seriesPosition: 1, title: "Перша" },
    ];

    const [row] = toSeriesOrderComparison(currentOrder, recommendedOrder);

    expect(row?.changed).toBe(false);
    expect(row?.recommended).toBe(row?.current);
    expect(row?.queuePosition).toBeNull();
  });
});

describe("SERIES_ORDER_SIDEBAR_LIMIT", () => {
  it("asks the backend for three issues in the sidebar", () => {
    expect(SERIES_ORDER_SIDEBAR_LIMIT).toBe(3);
  });
});
