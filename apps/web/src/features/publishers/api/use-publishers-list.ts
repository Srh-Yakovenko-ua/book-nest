import type { z } from "zod";

import { LibraryPublishersPageSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { PublishersControllerLibraryListParams } from "@/shared/api/generated/model";

import { publishersControllerLibraryList } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export type PublishersListPage = z.infer<typeof LibraryPublishersPageSchema>;

export function usePublishersList(params: PublishersControllerLibraryListParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<PublishersListPage> =>
      LibraryPublishersPageSchema.parse(await publishersControllerLibraryList(params, { signal })),
    queryKey: publisherKeys.list(params),
  });
}
