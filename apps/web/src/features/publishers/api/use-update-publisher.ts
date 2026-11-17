import type { LibraryPublisherDetail, UpdatePublisherInput } from "@app/shared";

import { LibraryPublisherDetailSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdatePublisherDto } from "@/shared/api/generated/model";

import { matchesAnyKeyPrefix } from "@/lib/query-keys";
import { publishersControllerUpdateCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherChangeEffects } from "./publisher-change-effects";
import { publisherKeys } from "./publisher-keys";

export function useUpdatePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePublisherInput): Promise<LibraryPublisherDetail> => {
      const response = await publishersControllerUpdateCustom(id, input as UpdatePublisherDto);
      return LibraryPublisherDetailSchema.parse(response);
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(publisherKeys.detail(id), detail);
      void publisherChangeEffects.publishersChanged(queryClient, {
        change: "updated",
        keep: [matchesAnyKeyPrefix(publisherKeys.detail(id))],
      });
    },
  });
}
