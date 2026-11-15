import type { MergePublisherInput, PublisherMergeResult } from "@app/shared";

import { PublisherMergeResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesPublisherScopedBookKey } from "@/features/books/api/book-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { publishersControllerMergeCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { invalidatePublisherIdentityViews } from "./publisher-change-effects";
import { publisherKeys } from "./publisher-keys";

export function useMergePublisher(sourcePublisherId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MergePublisherInput): Promise<PublisherMergeResult> => {
      const response = await publishersControllerMergeCustom(sourcePublisherId, input);
      return PublisherMergeResultSchema.parse(response);
    },
    onSuccess: () => {
      const mergedSourceViews = matchesAnyKeyPrefix(
        publisherKeys.detail(sourcePublisherId),
        publisherKeys.overview(sourcePublisherId),
      );
      const mergedSourceBooks = matchesPublisherScopedBookKey(sourcePublisherId);
      retireQueries(queryClient, mergedSourceViews);
      retireQueries(queryClient, mergedSourceBooks);
      invalidatePublisherIdentityViews(queryClient, {
        keep: [mergedSourceViews, mergedSourceBooks],
      });
    },
  });
}
