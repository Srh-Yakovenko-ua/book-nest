import type { NewSeriesInput, SeriesView } from "@app/shared";

import { SeriesViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { NewSeriesInputDto } from "@/shared/api/generated/model";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { seriesControllerCreate } from "@/shared/api/generated/endpoints/series/series";

export function useCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewSeriesInput): Promise<SeriesView> => {
      const response = await seriesControllerCreate(input as NewSeriesInputDto);
      return SeriesViewSchema.parse(response);
    },
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["seriesCreated"] });
    },
  });
}
