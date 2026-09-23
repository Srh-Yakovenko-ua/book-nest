import type { BookView, CreateBookInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateGenreDerivedQueries } from "@/features/genres/api/genres-keys";
import { listKeys } from "@/features/lists/api/list-keys";
import { publisherKeys } from "@/features/publishers/api/publisher-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { invalidateTagCollectionQueries } from "@/features/tags/api/tags-keys";
import { booksControllerCreate } from "@/shared/api/generated/endpoints/books/books";

import { RECENT_GENRES_KEY } from "./use-recent-genres";

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookInput): Promise<BookView> => {
      const response = await booksControllerCreate(input);
      return BookViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void queryClient.invalidateQueries({ queryKey: publisherKeys.root });
      void queryClient.invalidateQueries({ queryKey: ["publishers"] });
      void invalidateStatisticsQueries(queryClient);
      void invalidateGenreDerivedQueries(queryClient);
      void invalidateTagCollectionQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: RECENT_GENRES_KEY });
    },
  });
}
