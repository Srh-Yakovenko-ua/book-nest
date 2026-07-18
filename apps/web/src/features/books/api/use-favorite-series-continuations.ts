import { FavoriteSeriesContinuationsViewSchema } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";

import {
  getSeriesControllerFavoriteContinuationsQueryKey,
  useSeriesControllerFavoriteContinuations,
} from "@/shared/api/generated/endpoints/series/series";

const FETCH_LIMIT = 50;

export function useFavoriteSeriesContinuations() {
  return useSeriesControllerFavoriteContinuations(
    { limit: FETCH_LIMIT },
    { query: { select: (data: unknown) => FavoriteSeriesContinuationsViewSchema.parse(data) } },
  );
}

export function useInvalidateFavoriteSeriesContinuations() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: getSeriesControllerFavoriteContinuationsQueryKey(),
    });
}
