import type { CollectionPresence } from "@/lib/collection-presence";

import { toCollectionPresence } from "@/lib/collection-presence";

import { useLibraryOverview } from "./use-library-overview";

export type LibraryPresence = CollectionPresence;

export function useLibraryPresence(): LibraryPresence {
  const overview = useLibraryOverview("all");
  return toCollectionPresence({ query: overview, total: (data) => data.summary.total });
}
