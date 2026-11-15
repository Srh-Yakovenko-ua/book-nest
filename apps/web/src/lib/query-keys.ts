import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { partialMatchKey } from "@tanstack/react-query";

export type QueryKeyMatcher = (query: { queryKey: QueryKey }) => boolean;

type ApiRoot = `/api/${string}`;

export function matchesAnyKeyPrefix(...prefixes: readonly QueryKey[]): QueryKeyMatcher {
  return ({ queryKey }) => prefixes.some((prefix) => partialMatchKey(queryKey, prefix));
}

export function matchesApiRoot(root: ApiRoot): QueryKeyMatcher {
  return ({ queryKey }) => {
    const [head] = queryKey;
    return typeof head === "string" && (head === root || head.startsWith(`${root}/`));
  };
}

export function retireQueries(queryClient: QueryClient, matches: QueryKeyMatcher): void {
  queryClient.removeQueries({
    predicate: (query) => matches(query) && query.getObserversCount() === 0,
  });
  void queryClient.cancelQueries({
    predicate: (query) => matches(query) && query.getObserversCount() > 0,
  });
  void queryClient.invalidateQueries({ predicate: matches, refetchType: "none" });
}
