import type { BulkPagesCountInput, BulkPagesCountResult } from "@app/shared";

import { BulkPagesCountResultSchema, ReadingQueueVolumeSummaryViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/lib/http-client";

import { bulkBooksControllerPagesCount } from "@/shared/api/generated/endpoints/books/books";
import {
  getReadingQueueControllerGetQueueQueryKey,
  getReadingQueueControllerVolumeSummaryQueryKey,
  useReadingQueueControllerVolumeSummary,
} from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

import { bookKeys } from "./book-keys";

const selectVolumeSummary = (data: unknown) => ReadingQueueVolumeSummaryViewSchema.parse(data);

export function useBulkUpdatePagesCount() {
  const queryClient = useQueryClient();

  return useMutation<BulkPagesCountResult, ApiError, BulkPagesCountInput>({
    mutationFn: async (input) =>
      BulkPagesCountResultSchema.parse(await bulkBooksControllerPagesCount(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getReadingQueueControllerVolumeSummaryQueryKey(),
      });
      void queryClient.invalidateQueries({ queryKey: getReadingQueueControllerGetQueueQueryKey() });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}

export function useQueueVolumeSummary() {
  return useReadingQueueControllerVolumeSummary({ query: { select: selectVolumeSummary } });
}
