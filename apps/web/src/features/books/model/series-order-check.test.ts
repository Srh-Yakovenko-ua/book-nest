import type { SeriesOrderActionCode, SeriesOrderProblemType } from "@app/shared";

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

  it("asks to arrange by series when several books are out of order", () => {
    expect(seriesOrderActionLabelKey("REORDER_SERIES_SLOTS", "multiple_books_out_of_order")).toBe(
      "arrangeBySeries",
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
    "previous_book_paused",
  ] as const)("describes %s with a second line", (problemType) => {
    expect(hasProblemDescription(problemType)).toBe(true);
  });

  it.each([
    "missing_previous_from_queue",
    "multiple_books_out_of_order",
    "previous_book_after_later_book",
    "previous_book_in_transit",
    "previous_book_lent_out",
    "previous_book_not_owned",
    "previous_book_want_to_buy",
  ] as const satisfies readonly SeriesOrderProblemType[])(
    "shows %s with a title only",
    (problemType) => {
      expect(hasProblemDescription(problemType)).toBe(false);
    },
  );
});

describe("SERIES_ORDER_SIDEBAR_LIMIT", () => {
  it("asks the backend for three issues in the sidebar", () => {
    expect(SERIES_ORDER_SIDEBAR_LIMIT).toBe(3);
  });
});
