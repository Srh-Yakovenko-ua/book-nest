import type { BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "./book-change-effects";

export function useBookMutationSync(change: "loanChanged" | "statusChanged" = "statusChanged") {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    void bookChangeEffects.bookSaved(queryClient, { book, change });
  };
}
