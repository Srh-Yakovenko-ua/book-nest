import type { CollectionPresence } from "@/lib/collection-presence";

import { useSeriesOverview } from "@/features/series/api/use-series-overview";
import { toCollectionPresence } from "@/lib/collection-presence";

export function useSeriesPresence(): CollectionPresence {
  const overview = useSeriesOverview();
  return toCollectionPresence({ query: overview, total: (data) => data.totalSeries });
}
