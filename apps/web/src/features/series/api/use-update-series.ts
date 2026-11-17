import type { SeriesView, UpdateSeriesInput } from "@app/shared";

import { SeriesViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateSeriesInputDto } from "@/shared/api/generated/model";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { seriesControllerUpdate } from "@/shared/api/generated/endpoints/series/series";

export function useUpdateSeries(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSeriesInput): Promise<SeriesView> => {
      const response = await seriesControllerUpdate(id, input as UpdateSeriesInputDto);
      return SeriesViewSchema.parse(response);
    },
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["seriesChanged"] });
    },
  });
}
