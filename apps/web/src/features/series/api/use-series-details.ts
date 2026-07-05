import type { SeriesDetailsView } from "@app/shared";

import { SeriesDetailsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { seriesControllerGetById } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export function useSeriesDetails(id: string) {
  return useQuery({
    queryFn: async (): Promise<SeriesDetailsView> => {
      const response = await seriesControllerGetById(id);
      return SeriesDetailsViewSchema.parse(response);
    },
    queryKey: seriesKeys.detail(id),
    retry: false,
  });
}
