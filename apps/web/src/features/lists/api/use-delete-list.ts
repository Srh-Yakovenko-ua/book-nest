import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { goalKeys } from "@/features/reading-goals/api/goal-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { listsControllerDelete } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useDeleteList(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => listsControllerDelete(id),
    onSuccess: () => {
      const deletedListViews = matchesAnyKeyPrefix(
        listKeys.detail(id),
        listKeys.overview(id),
        listKeys.facets(id),
        listKeys.related(id),
        goalKeys.forList(id),
      );
      retireQueries(queryClient, deletedListViews);
      void bookChangeEffects.booksChanged(queryClient, {
        changes: ["listed"],
        keep: [deletedListViews],
      });
    },
  });
}
