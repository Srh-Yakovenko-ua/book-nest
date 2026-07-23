import type {
  Nullable,
  SeriesOrderActionCode,
  SeriesOrderBookView,
  SeriesOrderFixStrategy,
  SeriesOrderIssueView,
  SeriesOrderPositionView,
  SeriesOrderProblemType,
  SeriesOrderSeverity,
} from "@app/shared";

import {
  SERIES_ORDER_ERROR_CODES,
  SERIES_ORDER_ISSUES_LIMIT_DEFAULT,
  SeriesOrderFixStrategySchema,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

import { ApiError } from "@/lib/http-client";

export type SeriesOrderActionLabelKey =
  | "addAll"
  | "addBefore"
  | "addNext"
  | "addToWishlist"
  | "disableSeries"
  | "fixOrder"
  | "ignore"
  | "openBook"
  | "openLoan"
  | "openOrder"
  | "openPurchase"
  | "resumeBook";

export type SeriesOrderComparisonRow = {
  changed: boolean;
  current: SeriesOrderPositionView;
  queuePosition: Nullable<number>;
  recommended: SeriesOrderPositionView;
};

export type SeriesOrderErrorKey =
  | "alreadyInQueue"
  | "forbidden"
  | "generic"
  | "issueStale"
  | "notFound"
  | "queueLimit"
  | "queueStale";

export type SeriesOrderFixTarget = {
  affectedBook: SeriesOrderBookView;
  fingerprint: string;
  previousBook: Nullable<SeriesOrderBookView>;
  problemType: SeriesOrderProblemType;
  queueVersion: string;
  recommendedOrder: SeriesOrderPositionView[];
  seriesTitle: string;
  strategy: SeriesOrderFixStrategy;
};

export const SERIES_ORDER_SIDEBAR_LIMIT = SERIES_ORDER_ISSUES_LIMIT_DEFAULT;

type DescribedProblemType =
  | "current_reading_ahead_of_order"
  | "multiple_previous_missing"
  | "previous_book_in_transit"
  | "previous_book_lent_out"
  | "previous_book_not_owned"
  | "previous_book_paused"
  | "previous_book_want_to_buy";

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

const MENU_ACTIONS: readonly SeriesOrderActionCode[] = ["IGNORE_ISSUE", "DISABLE_SERIES_CHECK"];

const OPEN_PREVIOUS_BOOK_ONLY_ACTION_PROBLEM: SeriesOrderProblemType =
  "current_reading_ahead_of_order";

const NAVIGATION_ACTIONS: readonly SeriesOrderActionCode[] = [
  "OPEN_LOAN",
  "OPEN_ORDER",
  "OPEN_PREVIOUS_BOOK",
  "OPEN_PURCHASE",
  "RESUME_PREVIOUS_BOOK",
];

const PREVIOUS_BOOK_ACTIONS: readonly SeriesOrderActionCode[] = [
  ...NAVIGATION_ACTIONS,
  "ADD_PREVIOUS_TO_WISHLIST",
];

const DESCRIBED_PROBLEM_TYPES: readonly SeriesOrderProblemType[] = [
  "current_reading_ahead_of_order",
  "multiple_previous_missing",
  "previous_book_in_transit",
  "previous_book_lent_out",
  "previous_book_not_owned",
  "previous_book_paused",
  "previous_book_want_to_buy",
] satisfies readonly DescribedProblemType[];

const STALE_ERROR_KEYS: readonly SeriesOrderErrorKey[] = [
  "alreadyInQueue",
  "issueStale",
  "queueStale",
];

const ACTION_LABEL_KEYS = {
  ADD_ALL_PREVIOUS_BEFORE: "addAll",
  ADD_NEXT_PREVIOUS_BEFORE: "addBefore",
  ADD_PREVIOUS_TO_WISHLIST: "addToWishlist",
  DISABLE_SERIES_CHECK: "disableSeries",
  IGNORE_ISSUE: "ignore",
  OPEN_LOAN: "openLoan",
  OPEN_ORDER: "openOrder",
  OPEN_PREVIOUS_BOOK: "openBook",
  OPEN_PURCHASE: "openPurchase",
  REORDER_SERIES_SLOTS: "fixOrder",
  RESUME_PREVIOUS_BOOK: "resumeBook",
} as const satisfies Record<SeriesOrderActionCode, SeriesOrderActionLabelKey>;

const SEVERITY_ENTRIES = {
  error: { icon: "alert-circle", tone: "danger" },
  info: { icon: "info", tone: "info" },
  warning: { icon: "alert-triangle", tone: "warning" },
} as const satisfies Record<SeriesOrderSeverity, { icon: UiIconName; tone: StatusTone }>;

export function hasProblemDescription(
  problemType: SeriesOrderProblemType,
): problemType is DescribedProblemType {
  return DESCRIBED_PROBLEM_TYPES.includes(problemType);
}

export function isSeriesOrderFixStrategy(
  code: SeriesOrderActionCode,
): code is SeriesOrderFixStrategy {
  return SeriesOrderFixStrategySchema.options.includes(code);
}

export function isSeriesOrderStaleError(key: SeriesOrderErrorKey): boolean {
  return STALE_ERROR_KEYS.includes(key);
}

export function seriesOrderActionHref(
  code: SeriesOrderActionCode,
  issue: SeriesOrderIssueView,
): null | string {
  if (!NAVIGATION_ACTIONS.includes(code)) return null;
  if (issue.previousBook === null) return null;
  return `/books/${issue.previousBook.id}`;
}

export function seriesOrderActionLabelKey(
  code: SeriesOrderActionCode,
  problemType: SeriesOrderProblemType,
): SeriesOrderActionLabelKey {
  if (code === "ADD_NEXT_PREVIOUS_BEFORE" && problemType === "multiple_previous_missing") {
    return "addNext";
  }
  if (code === "OPEN_PREVIOUS_BOOK" && problemType === OPEN_PREVIOUS_BOOK_ONLY_ACTION_PROBLEM) {
    return "resumeBook";
  }
  return ACTION_LABEL_KEYS[code];
}

export function toRecommendedOrderPositions(
  items: SeriesOrderPositionView[],
): SeriesOrderPositionView[] {
  const slots = items
    .map((item) => item.queuePosition)
    .filter((position): position is number => position !== null)
    .sort((first, second) => first - second);
  let cursor = 0;
  return items.map((item) => {
    if (item.queuePosition === null) return item;
    const queuePosition = slots[cursor] ?? item.queuePosition;
    cursor += 1;
    return { ...item, queuePosition };
  });
}

export function toSeriesOrderComparison(
  currentOrder: SeriesOrderPositionView[],
  recommendedOrder: SeriesOrderPositionView[],
): SeriesOrderComparisonRow[] {
  const recommendedBySlot = new Map<number, SeriesOrderPositionView>();
  for (const item of toRecommendedOrderPositions(recommendedOrder)) {
    if (item.queuePosition !== null) recommendedBySlot.set(item.queuePosition, item);
  }
  return currentOrder.map((current) => {
    const recommended =
      current.queuePosition === null
        ? current
        : (recommendedBySlot.get(current.queuePosition) ?? current);
    return {
      changed: recommended.bookId !== current.bookId,
      current,
      queuePosition: current.queuePosition,
      recommended,
    };
  });
}

export function toSeriesOrderErrorKey(error: unknown): SeriesOrderErrorKey {
  if (!(error instanceof ApiError)) return "generic";

  switch (error.code) {
    case SERIES_ORDER_ERROR_CODES.ALREADY_IN_QUEUE:
      return "alreadyInQueue";
    case SERIES_ORDER_ERROR_CODES.ISSUE_STALE:
      return "issueStale";
    case SERIES_ORDER_ERROR_CODES.QUEUE_LIMIT_REACHED:
      return "queueLimit";
    case SERIES_ORDER_ERROR_CODES.QUEUE_STALE:
      return "queueStale";
    default:
      break;
  }

  if (error.status === HTTP_FORBIDDEN) return "forbidden";
  if (error.status === HTTP_NOT_FOUND) return "notFound";
  return "generic";
}

export function toSeverityStatus(severity: SeriesOrderSeverity, label: string): StatusEntry {
  return { ...SEVERITY_ENTRIES[severity], label, value: severity };
}

export function visibleSeriesOrderActions(issue: SeriesOrderIssueView): SeriesOrderActionCode[] {
  return issue.allowedActions.filter((code) => {
    if (
      code === "OPEN_PREVIOUS_BOOK" &&
      issue.problemType !== OPEN_PREVIOUS_BOOK_ONLY_ACTION_PROBLEM
    )
      return false;
    if (MENU_ACTIONS.includes(code)) return false;
    if (issue.previousBook === null && PREVIOUS_BOOK_ACTIONS.includes(code)) return false;
    return true;
  });
}
