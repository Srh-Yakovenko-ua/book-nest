import { z } from "zod";

import { BookViewSchema } from "./books.js";

export const ReadingQueueItemViewSchema = z.object({
  book: BookViewSchema,
  position: z.number().int().positive(),
});

export type ReadingQueueItemView = z.infer<typeof ReadingQueueItemViewSchema>;

export const READING_QUEUE_LIMIT = 500;

export const ReadingQueueViewSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(ReadingQueueItemViewSchema),
  totalPagesCount: z.number().int().nonnegative(),
});

export type ReadingQueueView = z.infer<typeof ReadingQueueViewSchema>;

export const ReadingQueuePlacementSchema = z.enum(["start", "end", "specific"]);

export type ReadingQueuePlacement = z.infer<typeof ReadingQueuePlacementSchema>;

export const AddToReadingQueueInputSchema = z
  .object({
    bookId: z.uuid(),
    placement: ReadingQueuePlacementSchema,
    position: z.number().int().positive().optional(),
  })
  .refine((value) => value.placement !== "specific" || value.position !== undefined, {
    error: "Вкажіть позицію в черзі",
    path: ["position"],
  });

export type AddToReadingQueueInput = z.infer<typeof AddToReadingQueueInputSchema>;

const REORDER_MAX = 1000;

export const ReorderReadingQueueInputSchema = z.object({
  order: z.array(z.uuid()).min(1).max(REORDER_MAX),
});

export type ReorderReadingQueueInput = z.infer<typeof ReorderReadingQueueInputSchema>;

export const StartReadingFromQueueInputSchema = z.object({
  removeFromQueue: z.boolean(),
});

export type StartReadingFromQueueInput = z.infer<typeof StartReadingFromQueueInputSchema>;

export const ReadingQueueUnavailableBreakdownSchema = z.object({
  inTransit: z.number().int().nonnegative(),
  lentToSomeone: z.number().int().nonnegative(),
  none: z.number().int().nonnegative(),
  wantToBuy: z.number().int().nonnegative(),
});

export type ReadingQueueUnavailableBreakdown = z.infer<
  typeof ReadingQueueUnavailableBreakdownSchema
>;

export const ReadingQueueSummaryViewSchema = z.object({
  availableNowCount: z.number().int().nonnegative(),
  blockedBySeriesOrderCount: z.number().int().nonnegative(),
  seriesBooksCount: z.number().int().nonnegative(),
  seriesInQueueCount: z.number().int().nonnegative(),
  standaloneBooksCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  unavailableByOwnership: ReadingQueueUnavailableBreakdownSchema,
  unavailableCount: z.number().int().nonnegative(),
});

export type ReadingQueueSummaryView = z.infer<typeof ReadingQueueSummaryViewSchema>;
