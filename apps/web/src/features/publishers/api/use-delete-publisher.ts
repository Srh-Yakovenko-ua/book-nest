import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { publishersControllerDeleteCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

const PUBLISHER_PICKER_ROOT = "publishers";

export function useDeletePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => publishersControllerDeleteCustom(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publisherKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: [PUBLISHER_PICKER_ROOT] });
    },
  });
}
