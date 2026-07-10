import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { listsControllerDelete } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useDeleteList(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => listsControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}
