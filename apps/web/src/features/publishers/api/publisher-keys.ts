import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type {
  PublishersControllerLibraryListParams,
  PublishersControllerLibrarySummaryLocale,
} from "@/shared/api/generated/model";

const PUBLISHERS_ROOT = "/api/publishers";

export const publisherKeys = {
  detail: (id: string) => [PUBLISHERS_ROOT, "detail", id] as const,
  list: (params: PublishersControllerLibraryListParams) =>
    [PUBLISHERS_ROOT, "list", params] as const,
  overview: (id: string) => [PUBLISHERS_ROOT, "overview", id] as const,
  root: [PUBLISHERS_ROOT] as const,
  summary: (locale: PublishersControllerLibrarySummaryLocale) =>
    [PUBLISHERS_ROOT, "summary", locale] as const,
};

export function invalidatePublisherQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: matchesPublisherKey });
}

function matchesPublisherKey(query: { queryKey: QueryKey }): boolean {
  const [root] = query.queryKey;
  if (typeof root !== "string") return false;
  return root === PUBLISHERS_ROOT || root.startsWith(`${PUBLISHERS_ROOT}/`);
}
