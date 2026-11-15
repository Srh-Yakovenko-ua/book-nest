import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  invalidateBookQueries,
  matchesPublisherScopedBookKey,
} from "@/features/books/api/book-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { publishersControllerDeleteCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { matchesPublisherCatalogKey, publisherKeys } from "./publisher-keys";

export function useDeletePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => publishersControllerDeleteCustom(id),
    onSuccess: () => {
      const deletedPublisherViews = matchesAnyKeyPrefix(
        publisherKeys.detail(id),
        publisherKeys.overview(id),
      );
      const deletedPublisherBooks = matchesPublisherScopedBookKey(id);
      retireQueries(queryClient, deletedPublisherViews);
      retireQueries(queryClient, deletedPublisherBooks);
      void queryClient.invalidateQueries({
        predicate: (query) => matchesPublisherCatalogKey(query) && !deletedPublisherViews(query),
      });
      void invalidateBookQueries(queryClient, { keep: [deletedPublisherBooks] });
      void queryClient.invalidateQueries({ queryKey: publisherKeys.picker.all });
    },
  });
}
