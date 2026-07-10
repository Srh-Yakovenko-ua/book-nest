import type { ChangelogListResponse, ChangelogLocale } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { ChangelogListResponseSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { changelogControllerList } from "@/shared/api/generated/endpoints/changelog/changelog";

export const CHANGELOG_QUERY_PREFIX = "/api/changelog";
const CHANGELOG_LIMIT = 20;
const CHANGELOG_STALE_TIME = 60_000;

type ChangelogQueryKey = readonly [string, { limit: number; locale: ChangelogLocale }];

export function useChangelog(locale: ChangelogLocale) {
  return useInfiniteQuery<
    ChangelogListResponse,
    Error,
    InfiniteData<ChangelogListResponse>,
    ChangelogQueryKey,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ChangelogListResponseSchema.parse(
        await changelogControllerList({ cursor: pageParam, limit: CHANGELOG_LIMIT, locale }),
      ),
    queryKey: [CHANGELOG_QUERY_PREFIX, { limit: CHANGELOG_LIMIT, locale }],
    staleTime: CHANGELOG_STALE_TIME,
  });
}
