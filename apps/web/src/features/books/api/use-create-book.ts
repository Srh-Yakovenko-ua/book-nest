import type { BookView, CreateBookInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { booksControllerCreate } from "@/shared/api/generated/endpoints/books/books";

import { bookChangeEffects } from "./book-change-effects";

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookInput): Promise<BookView> => {
      const response = await booksControllerCreate(input);
      return BookViewSchema.parse(response);
    },
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["created"] });
    },
  });
}
