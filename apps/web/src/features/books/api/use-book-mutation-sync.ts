import type { BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { seriesKeys } from "@/features/series/api/series-keys";

import { bookKeys, matchesBooksExceptDetail } from "./book-keys";

export function useBookMutationSync() {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    queryClient.setQueryData(bookKeys.detail(book.id), book);
    void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(book.id) });
    void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/delivery"),
    });
  };
}
