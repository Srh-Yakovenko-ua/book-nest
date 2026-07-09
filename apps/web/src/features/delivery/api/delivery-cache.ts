import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";

const IMPACTED_PREFIXES = ["/api/delivery", "/api/books", "/api/series"];

export function matchesDeliveryImpacted(query: { queryKey: QueryKey }): boolean {
  const first = query.queryKey[0];
  if (typeof first !== "string") return false;
  return IMPACTED_PREFIXES.some((prefix) => first.startsWith(prefix));
}

export function useDeliverySync() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ predicate: matchesDeliveryImpacted });
}
