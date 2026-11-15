import type {
  AddToReadingQueueInput,
  BookView,
  ReadingQueueItemView,
  ReadingQueueSummaryView,
  ReadingQueueView,
} from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { ReadingQueueSummaryViewSchema, ReadingQueueViewSchema } from "@app/shared";
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ReadingQueueControllerGetQueueParams } from "@/shared/api/generated/model";

import { resetRelationshipReaderViews } from "@/features/character-relationships/api/relationship-mutation-effects";
import {
  readingQueueControllerAddToQueue,
  readingQueueControllerGetQueue,
  readingQueueControllerRemoveFromQueue,
  readingQueueControllerReorder,
  readingQueueControllerStartReading,
  readingQueueControllerSummary,
} from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

import { bookChangeEffects } from "./book-change-effects";
import { matchesReadingQueueKey, readingQueueKeys } from "./reading-queue-keys";

export function useAddToReadingQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddToReadingQueueInput) =>
      ReadingQueueViewSchema.parse(await readingQueueControllerAddToQueue(input)),
    onSuccess: (view) => applyReadingQueueView(queryClient, view),
  });
}

export function useReadingQueue(params?: ReadingQueueControllerGetQueueParams) {
  return useQuery({ ...readingQueueQueryOptions(params), placeholderData: keepPreviousData });
}

export function useReadingQueuePosition(book: Pick<BookView, "id" | "isInReadingQueue">) {
  const query = useQuery({ ...readingQueueQueryOptions(), enabled: book.isInReadingQueue });

  return query.data?.items.find((item) => item.book.id === book.id)?.position ?? null;
}

export function useReadingQueueSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<ReadingQueueSummaryView> =>
      ReadingQueueSummaryViewSchema.parse(await readingQueueControllerSummary({ signal })),
    queryKey: readingQueueKeys.summary,
  });
}

export function useRemoveFromQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookId: string) =>
      ReadingQueueViewSchema.parse(await readingQueueControllerRemoveFromQueue(bookId)),
    onSuccess: (view) => applyReadingQueueView(queryClient, view),
  });
}

export function useReorderReadingQueue(params?: ReadingQueueControllerGetQueueParams) {
  const queryClient = useQueryClient();
  const queueKey = readingQueueKeys.queue(params);

  return useMutation<ReadingQueueView, Error, string[], { previous: ReadingQueueView | undefined }>(
    {
      mutationFn: async (order) =>
        ReadingQueueViewSchema.parse(await readingQueueControllerReorder({ order })),
      onError: (_error, _order, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(queueKey, context.previous);
        }
        void queryClient.invalidateQueries({ predicate: matchesReadingQueueKey });
      },
      onMutate: async (order) => {
        await queryClient.cancelQueries({ queryKey: queueKey });
        const previous = queryClient.getQueryData<ReadingQueueView>(queueKey);
        if (previous !== undefined) {
          queryClient.setQueryData<ReadingQueueView>(queueKey, reorderQueueView(previous, order));
        }
        return { previous };
      },
      onSuccess: (view) => {
        void bookChangeEffects.readingQueueChanged(queryClient, {
          change: "queueReordered",
          view,
        });
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
    onSuccess: (view) => {
      void bookChangeEffects.readingQueueChanged(queryClient, { change: "statusChanged", view });
      void resetRelationshipReaderViews(queryClient);
    },
  });
}

function applyReadingQueueView(queryClient: QueryClient, view: ReadingQueueView) {
  void bookChangeEffects.readingQueueChanged(queryClient, { change: "queueChanged", view });
}

function readingQueueQueryOptions(params?: ReadingQueueControllerGetQueueParams) {
  return queryOptions({
    queryFn: async ({ signal }): Promise<ReadingQueueView> =>
      ReadingQueueViewSchema.parse(await readingQueueControllerGetQueue(params, { signal })),
    queryKey: readingQueueKeys.queue(params),
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
