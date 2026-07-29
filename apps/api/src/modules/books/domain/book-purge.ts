import type { Nullable } from "@app/shared";

import { z } from "zod";

export const BOOK_PURGE_QUEUE_NAME = "book-purge";
export const BOOK_PURGE_JOB = "book-purge";

export const BOOK_PURGE_RECONCILE_BATCH = 100;

export const BookPurgeJobSchema = z.object({
  bookId: z.uuid(),
  userId: z.uuid(),
});

export type BookPurgeJob = z.infer<typeof BookPurgeJobSchema>;

type PurgeMediaSource = {
  bookCharacters: { portraitMediaId: Nullable<string> }[];
  coverMediaId: Nullable<string>;
};

export function collectMediaIds(book: PurgeMediaSource): string[] {
  const ids = [
    book.coverMediaId,
    ...book.bookCharacters.map((appearance) => appearance.portraitMediaId),
  ];
  return [...new Set(ids.filter((id): id is string => id !== null))];
}
