import type { LibraryPublisherDetail, UpdatePublisherInput } from "@app/shared";

import { LibraryPublisherDetailSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdatePublisherDto } from "@/shared/api/generated/model";

import { bookKeys } from "@/features/books/api/book-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { publishersControllerUpdateCustom } from "@/shared/api/generated/endpoints/publishers/publishers";

import { invalidatePublisherQueries, publisherKeys } from "./publisher-keys";

const RELATED_PICKER_ROOTS = { publishers: ["publishers"], series: ["series"] } as const;

export function useUpdatePublisher(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePublisherInput): Promise<LibraryPublisherDetail> => {
      const response = await publishersControllerUpdateCustom(id, input as UpdatePublisherDto);
      return LibraryPublisherDetailSchema.parse(response);
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(publisherKeys.detail(id), detail);
      void invalidatePublisherQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: RELATED_PICKER_ROOTS.publishers });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void queryClient.invalidateQueries({ queryKey: RELATED_PICKER_ROOTS.series });
    },
  });
}
