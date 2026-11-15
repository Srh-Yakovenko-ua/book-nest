import type { BookDetailsView, BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "./book-change-effects";
import { bookKeys, matchesBookDetail } from "./book-keys";

export function useBookMutationSync(change: "loanChanged" | "statusChanged" = "statusChanged") {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    const detailKey = bookKeys.detail(book.id);
    const cachedDetail = queryClient.getQueryData<BookDetailsView>(detailKey);
    if (cachedDetail !== undefined) {
      queryClient.setQueryData<BookDetailsView>(detailKey, {
        ...book,
        notesCount: cachedDetail.notesCount,
        quotesCount: cachedDetail.quotesCount,
      });
    }
    void bookChangeEffects.booksChanged(queryClient, {
      changes: [change],
      keep: cachedDetail === undefined ? [] : [matchesBookDetail(book.id)],
    });
  };
}
