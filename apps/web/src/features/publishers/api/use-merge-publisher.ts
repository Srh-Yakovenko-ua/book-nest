import type { MergePublisherInput, PublisherMergeResult } from "@app/shared";

import { PublisherMergeResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { publishersControllerMergeCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherChangeEffects } from "./publisher-change-effects";

export function useMergePublisher(sourcePublisherId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MergePublisherInput): Promise<PublisherMergeResult> => {
      const response = await publishersControllerMergeCustom(sourcePublisherId, input);
      return PublisherMergeResultSchema.parse(response);
    },
    onSuccess: () => {
      void publisherChangeEffects.publisherRemoved(queryClient, {
        change: "merged",
        publisherId: sourcePublisherId,
      });
    },
  });
}
