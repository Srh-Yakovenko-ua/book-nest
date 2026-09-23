import type { z } from "zod";

import { CatalogLocaleSchema, LibraryPublishersSummarySchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { publishersControllerLibrarySummary } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export type PublishersSummary = z.infer<typeof LibraryPublishersSummarySchema>;

export function usePublisherSummary() {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    queryFn: async ({ signal }): Promise<PublishersSummary> =>
      LibraryPublishersSummarySchema.parse(
        await publishersControllerLibrarySummary({ locale }, { signal }),
      ),
    queryKey: publisherKeys.summary(locale),
  });
}
