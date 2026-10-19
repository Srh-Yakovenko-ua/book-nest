import type { Nullable, ReadingGoalActivityView } from "@app/shared";

import { ReadingGoalResultSchema, ReadingGoalUncountedReasonSchema } from "@app/shared";
import { z } from "zod";

const METADATA_FIELD = {
  count: z.number().int().nonnegative(),
  day: z.iso.date(),
  name: z.string().nullable(),
} as const;

const GoalActivityDetailSchema = z.discriminatedUnion("type", [
  z.object({
    metadata: z.object({
      completedCount: METADATA_FIELD.count,
      finishedAt: METADATA_FIELD.day,
      targetCount: METADATA_FIELD.count,
    }),
    type: z.literal("book_counted"),
  }),
  z.object({
    metadata: z.object({
      previousFinishedAt: METADATA_FIELD.day,
      reason: ReadingGoalUncountedReasonSchema,
    }),
    type: z.literal("book_uncounted"),
  }),
  z.object({
    metadata: z.object({ from: METADATA_FIELD.day, to: METADATA_FIELD.day }),
    type: z.literal("deadline_changed"),
  }),
  z.object({
    metadata: z.object({ result: ReadingGoalResultSchema.nullable() }),
    type: z.literal("goal_archived"),
  }),
  z.object({
    metadata: z.object({
      completedAt: METADATA_FIELD.day.nullable(),
      daysBeforeDeadline: METADATA_FIELD.count.nullable(),
    }),
    type: z.literal("goal_completed"),
  }),
  z.object({
    metadata: z.object({
      deadline: METADATA_FIELD.day,
      snapshotBookCount: METADATA_FIELD.count,
      targetCount: METADATA_FIELD.count,
    }),
    type: z.literal("goal_created"),
  }),
  z.object({
    metadata: z.object({
      completedCount: METADATA_FIELD.count,
      deadline: METADATA_FIELD.day,
      targetCount: METADATA_FIELD.count,
    }),
    type: z.literal("goal_expired"),
  }),
  z.object({
    metadata: z.object({ from: METADATA_FIELD.name, to: METADATA_FIELD.name }),
    type: z.literal("goal_renamed"),
  }),
  z.object({
    metadata: z.object({ from: METADATA_FIELD.count, to: METADATA_FIELD.count }),
    type: z.literal("target_changed"),
  }),
]);

export type GoalActivityDetail = z.infer<typeof GoalActivityDetailSchema>;

export function toGoalActivityDetail({
  metadata,
  type,
}: Pick<ReadingGoalActivityView, "metadata" | "type">): Nullable<GoalActivityDetail> {
  const parsed = GoalActivityDetailSchema.safeParse({ metadata, type });
  return parsed.success ? parsed.data : null;
}
