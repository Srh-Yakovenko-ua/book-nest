import type { LibraryPublisherListItem } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";
import type { z } from "zod";

import { CatalogLocaleSchema, LibraryPublishersPageSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { publishersControllerLibraryList } from "@/shared/api/generated/endpoints/publishers/publishers";

import type { PublishersListQuery } from "../model/publisher-query";

import { publisherKeys } from "./publisher-keys";

export type PublishersListPage = z.infer<typeof LibraryPublishersPageSchema>;

export type PublishersListResult = {
  items: LibraryPublisherListItem[];
  totalCount: number;
};

export function selectPublishersList(data: InfiniteData<PublishersListPage>): PublishersListResult {
  const seen = new Set<string>();
  const items: LibraryPublisherListItem[] = [];

  for (const item of data.pages.flatMap((page) => page.items)) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  return { items, totalCount: data.pages[0]?.totalCount ?? 0 };
}

export function usePublishersList(listQuery: PublishersListQuery) {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());
  const params = { ...listQuery, locale };

  return useInfiniteQuery({
    getNextPageParam: (lastPage: PublishersListPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<PublishersListPage> =>
      LibraryPublishersPageSchema.parse(
        await publishersControllerLibraryList({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: publisherKeys.list(params),
    select: selectPublishersList,
  });
}
