import type { z } from "zod";

import { LibraryPublishersSummarySchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { publishersControllerLibrarySummary } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export type PublishersSummary = z.infer<typeof LibraryPublishersSummarySchema>;

export function usePublisherSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<PublishersSummary> =>
      LibraryPublishersSummarySchema.parse(await publishersControllerLibrarySummary({ signal })),
    queryKey: publisherKeys.summary,
  });
}
