import type { Nullable } from "@app/shared";

type PagedEvent = {
  pageNumber: Nullable<number>;
};

type ReadingMarkerInput = {
  currentPage: Nullable<number>;
  events: readonly PagedEvent[];
  hasNextPage: boolean;
};

export function isEventAhead(event: PagedEvent, currentPage: Nullable<number>): boolean {
  if (currentPage === null || event.pageNumber === null) return false;
  return event.pageNumber > currentPage;
}

export function readingMarkerIndex({
  currentPage,
  events,
  hasNextPage,
}: ReadingMarkerInput): Nullable<number> {
  if (currentPage === null || events.length === 0) return null;

  const index = events.findIndex((event) => isEventAhead(event, currentPage));
  if (index !== -1) return index;
  return hasNextPage ? null : events.length;
}
