import type { LibraryPublisherDetail, UpdatePublisherInput } from "@app/shared";

import { LibraryPublisherDetailSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdatePublisherDto } from "@/shared/api/generated/model";

import { bookKeys } from "@/features/books/api/book-keys";
import { publishersControllerUpdateCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

const PUBLISHER_PICKER_ROOT = "publishers";

export function useUpdatePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePublisherInput): Promise<LibraryPublisherDetail> => {
      const response = await publishersControllerUpdateCustom(id, input as UpdatePublisherDto);
      return LibraryPublisherDetailSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publisherKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: [PUBLISHER_PICKER_ROOT] });
    },
  });
}
