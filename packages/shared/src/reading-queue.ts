import { z } from "zod";

import { BookViewSchema } from "./books.js";

export const ReadingQueueItemViewSchema = z.object({
  book: BookViewSchema,
  position: z.number().int().positive(),
});

export type ReadingQueueItemView = z.infer<typeof ReadingQueueItemViewSchema>;

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
