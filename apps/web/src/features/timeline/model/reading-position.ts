import type { Nullable } from "@app/shared";

type PagedEvent = {
  pageNumber: Nullable<number>;
};

export function isEventAhead(event: PagedEvent, currentPage: Nullable<number>): boolean {
  if (currentPage === null || event.pageNumber === null) return false;
  return event.pageNumber > currentPage;
}

export function positionMarkerIndex(
  events: readonly PagedEvent[],
  currentPage: Nullable<number>,
): Nullable<number> {
  if (currentPage === null) return null;
  const index = events.findIndex((event) => isEventAhead(event, currentPage));
  return index === -1 ? events.length : index;
}

export function splitEventsAtPosition<Event extends PagedEvent>(
  events: readonly Event[],
  currentPage: Nullable<number>,
): { ahead: Event[]; markerIndex: Nullable<number>; read: Event[] } {
  const markerIndex = positionMarkerIndex(events, currentPage);
  if (markerIndex === null) {
    return { ahead: [], markerIndex: null, read: [...events] };
  }
  return {
    ahead: events.slice(markerIndex),
    markerIndex,
    read: events.slice(0, markerIndex),
  };
}
