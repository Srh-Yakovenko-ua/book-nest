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
