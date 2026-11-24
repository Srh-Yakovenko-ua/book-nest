import type {
  HomeAttentionGroup,
  HomeAttentionSeverity,
  Nullable,
  QueuePriorityReason,
} from "@app/shared";

import { HOME_DASHBOARD_RULES, QueuePriorityReasonSchema } from "@app/shared";

import { daysBetweenIsoDates } from "../../../core/iso-date.js";
import { compareText } from "./compare-text.js";

export type QueueDeadlineEntry = {
  id: string;
  queuePriorityReason: Nullable<string>;
  targetDate: string;
  title: string;
};

type QueueDeadlineSeverity = Extract<HomeAttentionSeverity, "high" | "medium">;

const QUEUE_DEADLINE_SEVERITIES: readonly QueueDeadlineSeverity[] = ["high", "medium"];

const SINGLE_BOOK = 1;

export function buildQueueDeadlineAttention({
  entries,
  loanDueBookIds,
  today,
}: {
  entries: readonly QueueDeadlineEntry[];
  loanDueBookIds: ReadonlySet<string>;
  today: string;
}): HomeAttentionGroup[] {
  const signals = entries.flatMap((entry) => {
    if (loanDueBookIds.has(entry.id)) {
      return [];
    }
    const severity = resolveQueueDeadlineSeverity({ targetDate: entry.targetDate, today });
    return severity === null ? [] : [{ entry, severity }];
  });

  return QUEUE_DEADLINE_SEVERITIES.flatMap((severity): HomeAttentionGroup[] => {
    const grouped = signals
      .filter((signal) => signal.severity === severity)
      .map((signal) => signal.entry);
    const [first] = grouped;
    if (first === undefined) {
      return [];
    }
    const isSingle = grouped.length === SINGLE_BOOK;
    return [
      {
        bookId: isSingle ? first.id : null,
        bookTitle: isSingle ? first.title : null,
        count: grouped.length,
        dueDate: grouped.map((entry) => entry.targetDate).sort(compareText)[0] ?? null,
        id: `queue_deadline:${severity}`,
        queueReasons: collectQueueReasons(grouped),
        reason: "queue_deadline",
        severity,
        unit: "books",
      },
    ];
  });
}

export function resolveQueueDeadlineSeverity({
  targetDate,
  today,
}: {
  targetDate: string;
  today: string;
}): Nullable<QueueDeadlineSeverity> {
  const daysLeft = daysBetweenIsoDates({ endIsoDate: targetDate, startIsoDate: today });
  if (daysLeft < 0 || daysLeft > HOME_DASHBOARD_RULES.attention.queueDeadlineDays) {
    return null;
  }
  return daysLeft <= HOME_DASHBOARD_RULES.attention.queueUrgentDays ? "high" : "medium";
}

function collectQueueReasons(entries: readonly QueueDeadlineEntry[]): QueuePriorityReason[] {
  const reasons = new Set<QueuePriorityReason>();
  for (const entry of entries) {
    const parsed = QueuePriorityReasonSchema.safeParse(entry.queuePriorityReason);
    if (parsed.success) {
      reasons.add(parsed.data);
    }
  }
  return [...reasons].sort(compareText);
}
