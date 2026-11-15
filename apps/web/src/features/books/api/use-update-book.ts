import type { UpdateBookInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

import { bookChangeEffects } from "./book-change-effects";

export function useUpdateBook(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBookInput) => booksControllerUpdate(id, input),
    onSuccess: (_book, input) => {
      void bookChangeEffects.booksChanged(queryClient, {
        changes: input.tags === undefined ? ["edited"] : ["edited", "tagged"],
      });
    },
  });
}
