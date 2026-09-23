import type { LibraryPublisherOverview } from "@app/shared";

import { LibraryPublisherOverviewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { publishersControllerLibraryOverview } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export function usePublisherOverview(publisherId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<LibraryPublisherOverview> => {
      const response = await publishersControllerLibraryOverview(publisherId);
      return LibraryPublisherOverviewSchema.parse(response);
    },
    queryKey: publisherKeys.overview(publisherId),
    retry: false,
  });
}
