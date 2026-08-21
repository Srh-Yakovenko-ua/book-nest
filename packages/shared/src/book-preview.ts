import { z } from "zod";

import { OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { MediaViewSchema } from "./media.js";

export const BookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  firstAuthorName: z.string(),
  genres: z.array(z.string()),
  id: z.string(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  publisher: z.object({ id: z.string(), name: z.string() }).nullable(),
  readingStatus: ReadingStatusSchema,
  series: z
    .object({
      id: z.string(),
      name: z.string(),
      partNumber: z.number().nullable(),
      totalBooks: z.number().int().nullable(),
    })
    .nullable(),
  tags: z.array(z.string()),
  title: z.string(),
});

export type BookPreview = z.infer<typeof BookPreviewSchema>;
