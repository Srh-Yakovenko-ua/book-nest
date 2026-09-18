import type { BookView } from "@app/shared";

import { MediaViewSchema } from "@app/shared";
import { z } from "zod";

export const BookSelectOptionSchema = z.object({
  authorName: z.string(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export type BookSelectOption = z.infer<typeof BookSelectOptionSchema>;

export function toBookSelectOption(book: BookView): BookSelectOption {
  return {
    authorName: book.authors[0]?.name ?? "",
    cover: book.cover ?? null,
    id: book.id,
    title: book.title,
  };
}
