import { z } from "zod";

import { BookViewSchema } from "./books.js";

export const DedicationsSummaryViewSchema = z.object({
  favoriteCount: z.number(),
  finishedCount: z.number(),
  topAuthor: z
    .object({
      count: z.number(),
      name: z.string(),
    })
    .nullable(),
  topGenre: z
    .object({
      count: z.number(),
      genre: z.string(),
    })
    .nullable(),
  totalCount: z.number(),
  unfinishedCount: z.number(),
});

export type DedicationsSummaryView = z.infer<typeof DedicationsSummaryViewSchema>;

export const DedicationsViewSchema = z.object({
  books: z.array(BookViewSchema),
  summary: DedicationsSummaryViewSchema,
});

export type DedicationsView = z.infer<typeof DedicationsViewSchema>;
