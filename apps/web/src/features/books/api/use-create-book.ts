import type { BookView, CreateBookInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateBookInputDto } from "@/shared/api/generated/model";

import { seriesKeys } from "@/features/series/api/series-keys";
import { booksControllerCreate } from "@/shared/api/generated/endpoints/books/books";

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookInput): Promise<BookView> => {
      const response = await booksControllerCreate(input as CreateBookInputDto);
      return BookViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    },
  });
}
