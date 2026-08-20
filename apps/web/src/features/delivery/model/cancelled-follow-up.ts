import type {
  CancelledFollowUpBook,
  CancelledOutcome,
  CancelledOutcomeCounts,
  CancelledPlanBook,
  CancelledPlanContext,
  Nullable,
  ReadingGoalRiskLevel,
} from "@app/shared";

import { CANCELLED_OUTCOMES } from "@app/shared";

import { formatDate } from "@/lib/format";

import type { DeliveryBookPreviewModel } from "./delivery-book-preview";

import { toDeliveryBookPreviewModel } from "./delivery-book-preview";

export type CancelledDecisionRow = DeliveryBookPreviewModel & {
  cancelledOnText: string;
  cancelReason: Nullable<string>;
};

export type CancelledOutcomeRow = {
  key: CancelledOutcome;
  text: string;
};

export type CancelledPlanLabels = {
  goalNamed: (name: string) => string;
  goalsCount: (count: number) => string;
  goalUnnamed: string;
  queue: string;
  risk: (level: ReadingGoalRiskLevel) => Nullable<string>;
  seriesNext: string;
};

export type CancelledPlanRow = DeliveryBookPreviewModel & {
  contextText: string;
};

const CONTEXT_SEPARATOR = " · ";

export function buildCancelledDecisionRows({
  books,
  cancelledOn,
  locale,
}: {
  books: readonly CancelledFollowUpBook[];
  cancelledOn: (date: string) => string;
  locale: string;
}): CancelledDecisionRow[] {
  return books.map((book) => ({
    ...toDeliveryBookPreviewModel(book),
    cancelledOnText: cancelledOn(formatDate(book.cancelledAt, locale)),
    cancelReason: book.cancelReason,
  }));
}

export function buildCancelledOutcomeRows({
  counts,
  label,
}: {
  counts: CancelledOutcomeCounts;
  label: (outcome: CancelledOutcome, count: number) => string;
}): CancelledOutcomeRow[] {
  return CANCELLED_OUTCOMES.flatMap((key) =>
    counts[key] === 0 ? [] : [{ key, text: label(key, counts[key]) }],
  );
}

export function buildCancelledPlanRows({
  books,
  labels,
}: {
  books: readonly CancelledPlanBook[];
  labels: CancelledPlanLabels;
}): CancelledPlanRow[] {
  return books.map((book) => ({
    ...toDeliveryBookPreviewModel(book),
    contextText: book.contexts
      .flatMap((context) => toContextText({ context, labels }))
      .join(CONTEXT_SEPARATOR),
  }));
}

function toContextText({
  context,
  labels,
}: {
  context: CancelledPlanContext;
  labels: CancelledPlanLabels;
}): string[] {
  switch (context.kind) {
    case "goal":
      return [toGoalText({ context, labels }), ...toRiskText({ context, labels })];
    case "queue":
      return [labels.queue];
    case "series_next":
      return [labels.seriesNext];
    default: {
      const exhaustiveCheck: never = context;
      return exhaustiveCheck;
    }
  }
}

function toGoalText({
  context,
  labels,
}: {
  context: Extract<CancelledPlanContext, { kind: "goal" }>;
  labels: CancelledPlanLabels;
}): string {
  if (context.goalsCount > 1) {
    return labels.goalsCount(context.goalsCount);
  }
  return context.goalName === null ? labels.goalUnnamed : labels.goalNamed(context.goalName);
}

function toRiskText({
  context,
  labels,
}: {
  context: Extract<CancelledPlanContext, { kind: "goal" }>;
  labels: CancelledPlanLabels;
}): string[] {
  const risk = labels.risk(context.riskLevel);
  return risk === null ? [] : [risk];
}
