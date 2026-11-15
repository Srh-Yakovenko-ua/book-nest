import type { NoteView } from "@app/shared";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { infiniteScrollStateOf } from "@/hooks/use-infinite-scroll-sentinel";

export type NotesArchiveEmptyCopy = Partial<Record<NotesArchiveEmptyReason, EmptyStateEntry>>;

export type NotesArchiveEmptyReason = "filters" | "library" | "search";

export type NotesArchiveListSnapshot = {
  data: undefined | { pages: { items: NoteView[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
};

export type NotesArchiveListState =
  | { isRefreshing: boolean; kind: "ready"; nextPage: InfiniteScrollState; notes: NoteView[] }
  | { kind: "empty"; reason: NotesArchiveEmptyReason }
  | { kind: "error" }
  | { kind: "loading" };

type NotesArchiveListStateInput = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  list: NotesArchiveListSnapshot;
};

export function notesArchiveListState({
  hasActiveFilters,
  hasActiveSearch,
  list,
}: NotesArchiveListStateInput): NotesArchiveListState {
  if (list.data === undefined) return list.isPending ? { kind: "loading" } : { kind: "error" };

  const notes = list.data.pages.flatMap((page) => page.items);

  if (notes.length === 0) {
    if (list.isPlaceholderData) return { kind: "loading" };
    return { kind: "empty", reason: emptyReason({ hasActiveFilters, hasActiveSearch }) };
  }

  return {
    isRefreshing: list.isPlaceholderData,
    kind: "ready",
    nextPage: infiniteScrollStateOf(list),
    notes,
  };
}

function emptyReason({
  hasActiveFilters,
  hasActiveSearch,
}: Omit<NotesArchiveListStateInput, "list">): NotesArchiveEmptyReason {
  if (hasActiveSearch) return "search";
  if (hasActiveFilters) return "filters";
  return "library";
}
