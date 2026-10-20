import type { SeriesDetailsView } from "@app/shared";

import { SeriesDetailsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { seriesControllerGetById } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

type UseSeriesDetailsOptions = {
  enabled?: boolean;
};

export function useSeriesDetails(id: string, options: UseSeriesDetailsOptions = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: async (): Promise<SeriesDetailsView> => {
      const response = await seriesControllerGetById(id);
      return SeriesDetailsViewSchema.parse(response);
    },
    queryKey: seriesKeys.detail(id),
    retry: false,
  });
}
