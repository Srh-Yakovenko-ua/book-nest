import { useMutation, useQueryClient } from "@tanstack/react-query";

import { publishersControllerDeleteCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherChangeEffects } from "./publisher-change-effects";

export function useDeletePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => publishersControllerDeleteCustom(id),
    onSuccess: () => {
      void publisherChangeEffects.publisherRemoved(queryClient, {
        change: "deleted",
        publisherId: id,
      });
    },
  });
}
