import type { SeriesReadingContextDefaultView } from "@app/shared";

import { SeriesReadingContextDefaultViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { seriesReadingContextControllerGetDefault } from "@/shared/api/generated/endpoints/characters/characters";

import { seriesKeys } from "./series-keys";

export function useSeriesDefaultReadingContext({
  enabled,
  seriesId,
}: {
  enabled: boolean;
  seriesId: string;
}) {
  return useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<SeriesReadingContextDefaultView> =>
      SeriesReadingContextDefaultViewSchema.parse(
        await seriesReadingContextControllerGetDefault(seriesId, { signal }),
      ),
    queryKey: seriesKeys.defaultReadingContext(seriesId),
  });
}
