import type { FavoriteSeriesContinuationsView } from "@app/shared";

import { FavoriteSeriesContinuationsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { seriesKeys } from "@/features/series/api/series-keys";
import { seriesControllerFavoriteContinuations } from "@/shared/api/generated/endpoints/series/series";

const FAVORITE_CONTINUATIONS_PARAMS = { limit: 50 } as const;

export function useFavoriteSeriesContinuations() {
  return useQuery({
    queryFn: async ({ signal }): Promise<FavoriteSeriesContinuationsView> =>
      FavoriteSeriesContinuationsViewSchema.parse(
        await seriesControllerFavoriteContinuations(FAVORITE_CONTINUATIONS_PARAMS, { signal }),
      ),
    queryKey: seriesKeys.favoriteContinuations(FAVORITE_CONTINUATIONS_PARAMS),
  });
}
