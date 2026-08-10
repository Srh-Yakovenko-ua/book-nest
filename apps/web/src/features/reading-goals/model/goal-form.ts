import type {
  CreateReadingGoalInput,
  Nullable,
  ReadingGoalView,
  UpdateReadingGoalInput,
} from "@app/shared";

import { READING_GOAL_NAME_MAX, READING_GOAL_TARGET_MAX } from "@app/shared";
import { isAfter, isValid, parse, startOfDay } from "date-fns";
import { z } from "zod";

export const GOAL_FORM = {
  isoDateFormat: "yyyy-MM-dd",
  maxTargetCount: READING_GOAL_TARGET_MAX,
  minTargetCount: 1,
  nameMax: READING_GOAL_NAME_MAX,
  suggestedTargetCount: 5,
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

export function createGoalFormSchema({
  bookCount,
  messages,
}: {
  bookCount: number;
  messages: GoalFormMessages;
}) {
  return z.object({
    deadline: z
      .string({ error: messages.required })
      .min(1, { error: messages.required })
      .refine(isFutureIsoDate, { error: messages.deadlinePast }),
    name: z.string().max(GOAL_FORM.nameMax, { error: messages.nameMax }),
    targetCount: z
      .number({ error: messages.required })
      .int({ error: messages.targetMin })
      .min(GOAL_FORM.minTargetCount, { error: messages.targetMin })
      .max(maxTargetCount(bookCount), { error: messages.targetMax }),
  });
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

export function toUpdateGoalInput(values: GoalFormValues): UpdateReadingGoalInput {
  const name = values.name.trim();
  return {
    deadline: values.deadline,
    name: name === "" ? null : name,
    targetCount: values.targetCount,
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
