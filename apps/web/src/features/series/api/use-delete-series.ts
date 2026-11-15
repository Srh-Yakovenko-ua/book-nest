import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { seriesControllerDelete } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export function useDeleteSeries(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seriesControllerDelete(id),
    onSuccess: () => {
      const deletedSeriesViews = matchesAnyKeyPrefix(
        seriesKeys.detail(id),
        seriesKeys.charactersScope(id),
        seriesKeys.defaultReadingContext(id),
        seriesKeys.orderCheckPreference(id),
      );
      retireQueries(queryClient, deletedSeriesViews);
      void bookChangeEffects.booksChanged(queryClient, {
        changes: ["seriesChanged"],
        keep: [deletedSeriesViews],
      });
    },
  });
}
