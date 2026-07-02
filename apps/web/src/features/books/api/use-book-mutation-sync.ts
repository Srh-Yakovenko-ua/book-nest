import type { BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { bookKeys, matchesBooksExceptDetail } from "./book-keys";

export function useBookMutationSync() {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    queryClient.setQueryData(bookKeys.detail(book.id), book);
    void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(book.id) });
  };
}
