import type { BookView } from "@app/shared";

import { ReadingQueueViewSchema } from "@app/shared";

import { useReadingQueueControllerGetQueue } from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

export function useReadingQueue() {
  return useReadingQueueControllerGetQueue({
    query: {
      select: (data) => ReadingQueueViewSchema.parse(data),
    },
  });
}

export function useReadingQueuePosition(book: Pick<BookView, "id" | "isInReadingQueue">) {
  const query = useReadingQueueControllerGetQueue({
    query: {
      enabled: book.isInReadingQueue,
      select: (data) => ReadingQueueViewSchema.parse(data),
    },
  });

  return query.data?.items.find((item) => item.book.id === book.id)?.position ?? null;
}
