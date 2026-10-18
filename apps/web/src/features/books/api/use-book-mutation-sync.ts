import type { BookDetailsView, BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { invalidateGenreDerivedQueries } from "@/features/genres/api/genres-keys";
import { invalidatePublisherQueries } from "@/features/publishers/api/publisher-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";

import { bookKeys, matchesBooksExceptDetail } from "./book-keys";
import { matchesReadingQueueKey } from "./reading-queue-keys";

export function useBookMutationSync() {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    const detailKey = bookKeys.detail(book.id);
    const cachedDetail = queryClient.getQueryData<BookDetailsView>(detailKey);
    if (cachedDetail === undefined) {
      void queryClient.invalidateQueries({ exact: true, queryKey: detailKey });
    } else {
      queryClient.setQueryData<BookDetailsView>(detailKey, {
        ...book,
        notesCount: cachedDetail.notesCount,
      });
    }
    void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(book.id) });
    void queryClient.invalidateQueries({ predicate: matchesReadingQueueKey });
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === `/api/books/${book.id}/reading-history`,
    });
    void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/delivery"),
    });
    void invalidateStatisticsQueries(queryClient);
    void invalidateGenreDerivedQueries(queryClient);
    void invalidatePublisherQueries(queryClient);
  };
}
