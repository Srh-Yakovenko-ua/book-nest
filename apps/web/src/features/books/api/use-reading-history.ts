import { ReadingHistoryViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BookReadingControllerGetReadingHistoryParams } from "@/shared/api/generated/model/bookReadingControllerGetReadingHistoryParams";

import {
  bookReadingControllerGetReadingHistory,
  getBookReadingControllerGetReadingHistoryQueryKey,
} from "@/shared/api/generated/endpoints/books/books";

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
    queryKey: getBookReadingControllerGetReadingHistoryQueryKey(bookId, params),
  });
}
