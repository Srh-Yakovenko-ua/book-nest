import type { PublisherView } from "@app/shared";

import { CatalogLocaleSchema, PublisherViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { publisherKeys } from "@/features/publishers/api/publisher-keys";
import { publishersControllerRecent } from "@/shared/api/generated/endpoints/publishers/publishers";

const RECENT_PUBLISHERS_LIMIT = 8;

export function useRecentPublishers() {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    queryFn: async (): Promise<PublisherView[]> => {
      const response = await publishersControllerRecent({
        limit: RECENT_PUBLISHERS_LIMIT,
        locale,
      });
      return z.array(PublisherViewSchema).parse(response);
    },
    queryKey: publisherKeys.picker.recent(locale),
  });
}
