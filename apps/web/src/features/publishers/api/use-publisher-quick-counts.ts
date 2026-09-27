import type { LibraryPublishersQuickCounts } from "@app/shared";

import { LibraryPublishersQuickCountsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { PublishersControllerLibraryQuickCountsParams } from "@/shared/api/generated/model";

import { publishersControllerLibraryQuickCounts } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export function usePublisherQuickCounts(params: PublishersControllerLibraryQuickCountsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<LibraryPublishersQuickCounts> =>
      LibraryPublishersQuickCountsSchema.parse(
        await publishersControllerLibraryQuickCounts(params, { signal }),
      ),
    queryKey: publisherKeys.quickCounts(params),
  });
}
