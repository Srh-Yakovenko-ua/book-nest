import type {
  AddToReadingQueueInput,
  BookView,
  ReadingQueueItemView,
  ReadingQueueView,
} from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { ReadingQueueViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { seriesKeys } from "@/features/series/api/series-keys";
import {
  getReadingQueueControllerGetQueueQueryKey,
  getSeriesOrderCheckControllerListIssuesQueryKey,
  readingQueueControllerAddToQueue,
  readingQueueControllerRemoveFromQueue,
  readingQueueControllerReorder,
  readingQueueControllerStartReading,
  useReadingQueueControllerGetQueue,
} from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

import { bookKeys } from "./book-keys";

const selectReadingQueueView = (data: unknown) => ReadingQueueViewSchema.parse(data);

export function useAddToReadingQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddToReadingQueueInput) =>
      ReadingQueueViewSchema.parse(await readingQueueControllerAddToQueue(input)),
    onSuccess: (view) => applyReadingQueueView(queryClient, view),
  });
}

export function useReadingQueue() {
  return useReadingQueueControllerGetQueue({
    query: {
      select: selectReadingQueueView,
    },
  });
}

export function useReadingQueuePosition(book: Pick<BookView, "id" | "isInReadingQueue">) {
  const query = useReadingQueueControllerGetQueue({
    query: {
      enabled: book.isInReadingQueue,
      select: selectReadingQueueView,
    },
  });

  return query.data?.items.find((item) => item.book.id === book.id)?.position ?? null;
}

export function useRemoveFromQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookId: string) =>
      ReadingQueueViewSchema.parse(await readingQueueControllerRemoveFromQueue(bookId)),
    onSuccess: (view) => applyReadingQueueView(queryClient, view),
  });
}

export function useReorderReadingQueue() {
  const queryClient = useQueryClient();
  const queueKey = getReadingQueueControllerGetQueueQueryKey();

  return useMutation<ReadingQueueView, Error, string[], { previous: ReadingQueueView | undefined }>(
    {
      mutationFn: async (order) =>
        ReadingQueueViewSchema.parse(await readingQueueControllerReorder({ order })),
      onError: (_error, _order, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(queueKey, context.previous);
        }
      },
      onMutate: async (order) => {
        await queryClient.cancelQueries({ queryKey: queueKey });
        const previous = queryClient.getQueryData<ReadingQueueView>(queueKey);
        if (previous !== undefined) {
          queryClient.setQueryData<ReadingQueueView>(queueKey, reorderQueueView(previous, order));
        }
        return { previous };
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: bookKeys.root });
        void queryClient.invalidateQueries({
          queryKey: getSeriesOrderCheckControllerListIssuesQueryKey(),
        });
      },
      onSuccess: (view) => {
        queryClient.setQueryData(queueKey, view);
      },
    },
  );
}

export function useStartReadingFromQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, removeFromQueue }: { bookId: string; removeFromQueue: boolean }) =>
      ReadingQueueViewSchema.parse(
        await readingQueueControllerStartReading(bookId, { removeFromQueue }),
      ),
    onSuccess: (view) => applyReadingQueueView(queryClient, view),
  });
}

function applyReadingQueueView(queryClient: QueryClient, view: ReadingQueueView) {
  queryClient.setQueryData(getReadingQueueControllerGetQueueQueryKey(), view);
  void queryClient.invalidateQueries({ queryKey: bookKeys.root });
  void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
  void queryClient.invalidateQueries({
    queryKey: getSeriesOrderCheckControllerListIssuesQueryKey(),
  });
}

function reorderQueueView(view: ReadingQueueView, order: string[]): ReadingQueueView {
  const itemById = new Map(view.items.map((item) => [item.book.id, item]));
  const items = order
    .map((bookId) => itemById.get(bookId))
    .filter((item): item is ReadingQueueItemView => item !== undefined)
    .map((item, index) => ({ ...item, position: index + 1 }));

  return { ...view, count: items.length, items };
}
