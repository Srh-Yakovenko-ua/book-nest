import type { CancelledPlanContext, ReadingGoalRiskLevel } from "@app/shared";

import { ReadingGoalRiskLevelSchema, selectNextBook } from "@app/shared";

import type { ActiveReadingGoalMembership } from "../../reading-goals/index.js";
import type {
  CancelledSeriesRow,
  UnresolvedCancelledRow,
} from "../infrastructure/cancelled-follow-up.repository.js";

import { isMultiBookSeries } from "./series-set.js";

export type CancelledPlanEntry = {
  contexts: CancelledPlanContext[];
  id: string;
};

type PlanFlags = {
  goals: ActiveReadingGoalMembership[];
  inQueue: boolean;
  isSeriesNext: boolean;
};

const RISK_SEVERITY = ReadingGoalRiskLevelSchema.options;

const AT_RISK_FROM_SEVERITY = RISK_SEVERITY.indexOf(ReadingGoalRiskLevelSchema.enum.high);

const PLAN_PRIORITY = {
  goalAndQueue: 2,
  goalAtRisk: 0,
  goalOnly: 3,
  queueOnly: 4,
  seriesNext: 1,
} as const;

export function buildCancelledPlanEntries({
  goals,
  rows,
  seriesRows,
}: {
  goals: readonly ActiveReadingGoalMembership[];
  rows: readonly UnresolvedCancelledRow[];
  seriesRows: readonly CancelledSeriesRow[];
}): CancelledPlanEntry[] {
  const goalsByBook = groupGoalsByBook(goals);
  const seriesNextBookIds = selectSeriesNextBookIds(seriesRows);

  return rows
    .flatMap((row, index) => {
      const flags: PlanFlags = {
        goals: goalsByBook.get(row.id) ?? [],
        inQueue: row.inQueue,
        isSeriesNext: seriesNextBookIds.has(row.id),
      };
      const contexts = toPlanContexts(flags);
      return contexts.length === 0 ? [] : [{ entry: { contexts, id: row.id }, flags, index }];
    })
    .sort(
      (left, right) =>
        toPlanPriority(left.flags) - toPlanPriority(right.flags) || left.index - right.index,
    )
    .map((ranked) => ranked.entry);
}

export function selectSeriesNextBookIds(rows: readonly CancelledSeriesRow[]): Set<string> {
  const nextBookIds = rows.flatMap((row) => {
    if (!isMultiBookSeries(row)) {
      return [];
    }
    const next = selectNextBook(row.books);
    return next === undefined ? [] : [next.id];
  });

  return new Set(nextBookIds);
}

function groupGoalsByBook(
  goals: readonly ActiveReadingGoalMembership[],
): Map<string, ActiveReadingGoalMembership[]> {
  const grouped = new Map<string, ActiveReadingGoalMembership[]>();
  for (const goal of goals) {
    grouped.set(goal.bookId, [...(grouped.get(goal.bookId) ?? []), goal]);
  }
  return grouped;
}

function isAtRisk(riskLevel: ReadingGoalRiskLevel): boolean {
  return RISK_SEVERITY.indexOf(riskLevel) >= AT_RISK_FROM_SEVERITY;
}

function toGoalContext(goals: readonly ActiveReadingGoalMembership[]): CancelledPlanContext[] {
  const [first] = goals;
  if (first === undefined) {
    return [];
  }

  return [
    {
      goalName: goals.length === 1 ? first.goalName : null,
      goalsCount: goals.length,
      kind: "goal",
      riskLevel: toStrongestRisk(goals),
    },
  ];
}

function toPlanContexts({ goals, inQueue, isSeriesNext }: PlanFlags): CancelledPlanContext[] {
  return [
    ...(inQueue ? [{ kind: "queue" } as const] : []),
    ...toGoalContext(goals),
    ...(isSeriesNext ? [{ kind: "series_next" } as const] : []),
  ];
}

function toPlanPriority({ goals, inQueue, isSeriesNext }: PlanFlags): number {
  if (goals.some((goal) => isAtRisk(goal.riskLevel))) {
    return PLAN_PRIORITY.goalAtRisk;
  }
  if (isSeriesNext) {
    return PLAN_PRIORITY.seriesNext;
  }
  if (goals.length > 0) {
    return inQueue ? PLAN_PRIORITY.goalAndQueue : PLAN_PRIORITY.goalOnly;
  }
  return PLAN_PRIORITY.queueOnly;
}

function toStrongestRisk(goals: readonly ActiveReadingGoalMembership[]): ReadingGoalRiskLevel {
  return goals.reduce<ReadingGoalRiskLevel>(
    (strongest, goal) =>
      RISK_SEVERITY.indexOf(goal.riskLevel) > RISK_SEVERITY.indexOf(strongest)
        ? goal.riskLevel
        : strongest,
    ReadingGoalRiskLevelSchema.enum.none,
  );
}
