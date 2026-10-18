import type {
  CreateReadingGoalInput,
  Nullable,
  ReadingGoalView,
  UpdateReadingGoalInput,
} from "@app/shared";

import { READING_GOAL_NAME_MAX, READING_GOAL_TARGET_MAX } from "@app/shared";
import { addMonths, endOfMonth, endOfYear, isAfter, isValid, parse, startOfDay } from "date-fns";
import { z } from "zod";

import { dateToIsoDay } from "@/lib/iso-day";

export const GOAL_FORM = {
  deadlineShortcutMonths: 3,
  isoDateFormat: "yyyy-MM-dd",
  maxTargetCount: READING_GOAL_TARGET_MAX,
  minTargetCount: 1,
  nameMax: READING_GOAL_NAME_MAX,
  suggestedTargetCount: 5,
  targetPresets: [3, 5, 10],
} as const;

export type GoalFormMessages = {
  deadlinePast: string;
  nameMax: string;
  required: string;
  targetMax: string;
  targetMin: string;
};

export type GoalFormValues = {
  deadline: string;
  name: string;
  targetCount: number;
};

type GoalDeadlineShortcut = {
  kind: "endOfMonth" | "endOfYear" | "inMonths";
  value: string;
};

type GoalTargetPreset = {
  kind: "all" | "count" | "max";
  value: number;
};

export function createGoalFormSchema({
  bookCount,
  initialDeadline,
  messages,
}: {
  bookCount: number;
  initialDeadline: string;
  messages: GoalFormMessages;
}) {
  return z.object({
    deadline: z
      .string({ error: messages.required })
      .min(1, { error: messages.required })
      .refine((value) => value === initialDeadline || isFutureIsoDate(value), {
        error: messages.deadlinePast,
      }),
    name: z.string().max(GOAL_FORM.nameMax, { error: messages.nameMax }),
    targetCount: z
      .number({ error: messages.required })
      .int({ error: messages.targetMin })
      .min(GOAL_FORM.minTargetCount, { error: messages.targetMin })
      .max(maxTargetCount(bookCount), { error: messages.targetMax }),
  });
}

export function goalDeadlineShortcuts(today: Date): GoalDeadlineShortcut[] {
  const candidates: { date: Date; kind: GoalDeadlineShortcut["kind"] }[] = [
    { date: endOfMonth(today), kind: "endOfMonth" },
    { date: addMonths(today, GOAL_FORM.deadlineShortcutMonths), kind: "inMonths" },
    { date: endOfYear(today), kind: "endOfYear" },
  ];

  return candidates
    .filter(({ date }) => isAfter(startOfDay(date), startOfDay(today)))
    .map(({ date, kind }) => ({ kind, value: dateToIsoDay(date) }))
    .filter(
      (shortcut, index, shortcuts) =>
        shortcuts.findIndex((other) => other.value === shortcut.value) === index,
    );
}

export function goalFormDefaults({
  bookCount,
  goal,
}: {
  bookCount: number;
  goal: Nullable<ReadingGoalView>;
}): GoalFormValues {
  if (goal === null) {
    return { deadline: "", name: "", targetCount: suggestedTargetCount(bookCount) };
  }
  return { deadline: goal.deadline, name: goal.name ?? "", targetCount: goal.targetCount };
}

export function goalTargetPresets(bookCount: number): GoalTargetPreset[] {
  if (bookCount < GOAL_FORM.minTargetCount) return [];

  const max = maxTargetCount(bookCount);
  const counts = GOAL_FORM.targetPresets
    .filter((count) => count <= max)
    .map((count): GoalTargetPreset => ({ kind: "count", value: count }));

  if (counts.some((preset) => preset.value === max)) return counts;
  return [...counts, { kind: max === bookCount ? "all" : "max", value: max }];
}

export function hasGoalChanges(input: UpdateReadingGoalInput): boolean {
  return Object.keys(input).length > 0;
}

export function maxTargetCount(bookCount: number): number {
  return Math.max(GOAL_FORM.minTargetCount, Math.min(GOAL_FORM.maxTargetCount, bookCount));
}

export function toCreateGoalInput(values: GoalFormValues): CreateReadingGoalInput {
  const name = values.name.trim();
  return {
    deadline: values.deadline,
    targetCount: values.targetCount,
    ...(name === "" ? {} : { name }),
  };
}

export function toUpdateGoalInput({
  initial,
  values,
}: {
  initial: GoalFormValues;
  values: GoalFormValues;
}): UpdateReadingGoalInput {
  const name = values.name.trim();
  return {
    ...(values.deadline === initial.deadline ? {} : { deadline: values.deadline }),
    ...(name === initial.name.trim() ? {} : { name: name === "" ? null : name }),
    ...(values.targetCount === initial.targetCount ? {} : { targetCount: values.targetCount }),
  };
}

function isFutureIsoDate(value: string): boolean {
  const parsed = parse(value, GOAL_FORM.isoDateFormat, new Date());
  if (!isValid(parsed)) return false;
  return isAfter(startOfDay(parsed), startOfDay(new Date()));
}

function suggestedTargetCount(bookCount: number): number {
  return Math.max(GOAL_FORM.minTargetCount, Math.min(GOAL_FORM.suggestedTargetCount, bookCount));
}
