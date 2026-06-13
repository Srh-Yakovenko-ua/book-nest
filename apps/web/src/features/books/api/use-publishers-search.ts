import type { PublisherView } from "@app/shared";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { publishersControllerSearch } from "@/shared/api/generated/endpoints/publishers/publishers";

const publisherViewSchema = z.object({
  countryCode: z.string().nullable(),
  foundedYear: z.number().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  logoAttribution: z.string().nullable(),
  logoLicense: z.string().nullable(),
  logoLicenseUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  name: z.string(),
  websiteUrl: z.string().nullable(),
}) satisfies z.ZodType<PublisherView>;

const publisherSearchResultSchema = z.object({
  items: z.array(publisherViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const PUBLISHER_SEARCH_MIN_LENGTH = 2;
const PUBLISHER_SEARCH_PAGE_SIZE = 8;

export function usePublishersSearch(search: string) {
  const trimmed = search.trim();
  const enabled = trimmed.length >= PUBLISHER_SEARCH_MIN_LENGTH;

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PublisherView[]> => {
      const response = await publishersControllerSearch({
        pageSize: PUBLISHER_SEARCH_PAGE_SIZE,
        search: trimmed,
      });
      const parsed = publisherSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["publishers", "search", trimmed],
  });
}
