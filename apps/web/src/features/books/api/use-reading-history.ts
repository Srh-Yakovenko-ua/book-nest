import { ReadingHistoryViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BookReadingControllerGetReadingHistoryParams } from "@/shared/api/generated/model/bookReadingControllerGetReadingHistoryParams";

import { bookReadingControllerGetReadingHistory } from "@/shared/api/generated/endpoints/books/books";

import { bookKeys } from "./book-keys";

export function useReadingHistory(
  bookId: string,
  params: BookReadingControllerGetReadingHistoryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      ReadingHistoryViewSchema.parse(await bookReadingControllerGetReadingHistory(bookId, params)),
    queryKey: bookKeys.readingHistory(bookId, params),
  });
}
