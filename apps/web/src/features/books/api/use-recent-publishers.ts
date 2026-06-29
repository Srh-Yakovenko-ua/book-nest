import type { PublisherView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { publishersControllerRecent } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherViewSchema } from "../model/publisher-view-schema";

const RECENT_PUBLISHERS_LIMIT = 8;

export function useRecentPublishers() {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    queryFn: async (): Promise<PublisherView[]> => {
      const response = await publishersControllerRecent({
        limit: RECENT_PUBLISHERS_LIMIT,
        locale,
      });
      return z.array(publisherViewSchema).parse(response);
    },
    queryKey: ["publishers", "recent", locale],
  });
}
