import { SeriesOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { seriesControllerOverview } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export type SeriesOverview = z.infer<typeof SeriesOverviewViewSchema>;

export function useSeriesOverview() {
  return useQuery({
    queryFn: async ({ signal }): Promise<SeriesOverview> => {
      const response = await seriesControllerOverview({ signal });
      return SeriesOverviewViewSchema.parse(response);
    },
    queryKey: seriesKeys.overview,
  });
}
