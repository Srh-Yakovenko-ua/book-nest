import type { PublisherView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { publishersControllerSearch } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherViewSchema } from "../model/publisher-view-schema";

const publisherSearchResultSchema = z.object({
  items: z.array(publisherViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const PUBLISHER_SEARCH_PAGE_SIZE = 20;

export function usePublishersSearch(search: string) {
  const trimmed = search.trim();
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PublisherView[]> => {
      const response = await publishersControllerSearch({
        locale,
        pageSize: PUBLISHER_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      const parsed = publisherSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["publishers", "search", trimmed, locale],
  });
}
