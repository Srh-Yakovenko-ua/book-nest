import type {
  BulkPagesCountInput,
  BulkPagesCountResult,
  ReadingQueueVolumeSummaryView,
} from "@app/shared";

import { BulkPagesCountResultSchema, ReadingQueueVolumeSummaryViewSchema } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/lib/http-client";

import { bulkBooksControllerPagesCount } from "@/shared/api/generated/endpoints/books/books";
import { readingQueueControllerVolumeSummary } from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

import { bookChangeEffects } from "./book-change-effects";
import { readingQueueKeys } from "./reading-queue-keys";

export function useBulkUpdatePagesCount() {
  const queryClient = useQueryClient();

  return useMutation<BulkPagesCountResult, ApiError, BulkPagesCountInput>({
    mutationFn: async (input) =>
      BulkPagesCountResultSchema.parse(await bulkBooksControllerPagesCount(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["pagesCounted"] });
    },
  });
}

export function useQueueVolumeSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<ReadingQueueVolumeSummaryView> =>
      ReadingQueueVolumeSummaryViewSchema.parse(
        await readingQueueControllerVolumeSummary({ signal }),
      ),
    queryKey: readingQueueKeys.volumeSummary,
  });
}
