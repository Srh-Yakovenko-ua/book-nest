import { z } from "zod";

import { BookAuthorRefSchema } from "./authors.js";
import { collapseSpaces } from "./common.js";
import { NoHtmlString } from "./internal.js";
import { MediaViewSchema } from "./media.js";

export const READING_GOAL_NAME_MAX = 120;
export const READING_GOAL_TARGET_MAX = 1000;

export const ReadingGoalStatusSchema = z.enum(["active", "completed", "expired", "archived"]);

export type ReadingGoalStatus = z.infer<typeof ReadingGoalStatusSchema>;

const ReadingGoalNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(NoHtmlString.max(READING_GOAL_NAME_MAX, "Name must be at most 120 characters long"));

const ReadingGoalTargetCountSchema = z
  .number()
  .int()
  .min(1, "Target must be at least 1 book")
  .max(READING_GOAL_TARGET_MAX, "Target must be at most 1000 books");

export const CreateReadingGoalInputSchema = z.object({
  deadline: z.iso.date(),
  name: ReadingGoalNameSchema.optional(),
  targetCount: ReadingGoalTargetCountSchema,
});

export type CreateReadingGoalInput = z.infer<typeof CreateReadingGoalInputSchema>;

export const UpdateReadingGoalInputSchema = z.object({
  deadline: z.iso.date().optional(),
  name: ReadingGoalNameSchema.nullable().optional(),
  targetCount: ReadingGoalTargetCountSchema.optional(),
});

export type UpdateReadingGoalInput = z.infer<typeof UpdateReadingGoalInputSchema>;

export const ReadingGoalViewSchema = z.object({
  completedAt: z.iso.date().nullable(),
  completedCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  daysLeft: z.number().int().nullable(),
  deadline: z.iso.date(),
  id: z.string(),
  list: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  name: z.string().nullable(),
  remainingCount: z.number().int().nonnegative(),
  status: ReadingGoalStatusSchema,
  targetCount: z.number().int().positive(),
});

export type ReadingGoalView = z.infer<typeof ReadingGoalViewSchema>;

export const ReadingGoalBookSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  finishedAt: z.iso.date(),
  id: z.string(),
  title: z.string(),
});

export type ReadingGoalBook = z.infer<typeof ReadingGoalBookSchema>;

export const ReadingGoalDetailSchema = ReadingGoalViewSchema.extend({
  countedBooks: z.array(ReadingGoalBookSchema),
  listBookCount: z.number().int().nonnegative(),
});

export type ReadingGoalDetail = z.infer<typeof ReadingGoalDetailSchema>;
