import type { MergePublisherInput, PublisherMergeResult } from "@app/shared";

import { PublisherMergeResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { publishersControllerMergeCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { invalidatePublisherQueries } from "./publisher-keys";

const PUBLISHER_PICKER_ROOT = "publishers";

export function useMergePublisher(sourcePublisherId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MergePublisherInput): Promise<PublisherMergeResult> => {
      const response = await publishersControllerMergeCustom(sourcePublisherId, input);
      return PublisherMergeResultSchema.parse(response);
    },
    onSuccess: () => {
      void invalidatePublisherQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: [PUBLISHER_PICKER_ROOT] });
    },
  });
}
