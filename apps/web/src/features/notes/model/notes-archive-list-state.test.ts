import { describe, expect, it } from "vitest";

import type { NotesArchiveListSnapshot } from "./notes-archive-list-state";

import { notesArchiveListState } from "./notes-archive-list-state";
import { makeBookNote } from "./notes.fixtures";

const NO_QUERY = { hasActiveFilters: false, hasActiveSearch: false } as const;

function snapshot(overrides: Partial<NotesArchiveListSnapshot> = {}): NotesArchiveListSnapshot {
  return {
    data: { pages: [{ items: [makeBookNote({ id: "note-1" })] }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isPending: false,
    isPlaceholderData: false,
    ...overrides,
  };
}

const EMPTY_PAGES = { pages: [{ items: [] }] };

describe("notesArchiveListState", () => {
  it("loads while the first page is on its way", () => {
    const state = notesArchiveListState({
      ...NO_QUERY,
      list: snapshot({ data: undefined, isPending: true }),
    });

    expect(state).toEqual({ kind: "loading" });
  });

  it("fails when the first page never arrives", () => {
    const state = notesArchiveListState({ ...NO_QUERY, list: snapshot({ data: undefined }) });

    expect(state).toEqual({ kind: "error" });
  });

  it("calls an empty answer without search or filters an empty library", () => {
    const state = notesArchiveListState({ ...NO_QUERY, list: snapshot({ data: EMPTY_PAGES }) });

    expect(state).toEqual({ kind: "empty", reason: "library" });
  });

  it("blames the search before the filters for an empty answer", () => {
    const state = notesArchiveListState({
      hasActiveFilters: true,
      hasActiveSearch: true,
      list: snapshot({ data: EMPTY_PAGES }),
    });

    expect(state).toEqual({ kind: "empty", reason: "search" });
  });

  it("blames the filters for an empty answer without a search", () => {
    const state = notesArchiveListState({
      hasActiveFilters: true,
      hasActiveSearch: false,
      list: snapshot({ data: EMPTY_PAGES }),
    });

    expect(state).toEqual({ kind: "empty", reason: "filters" });
  });

  it("keeps loading instead of showing a stale empty answer from the previous query", () => {
    const state = notesArchiveListState({
      ...NO_QUERY,
      list: snapshot({ data: EMPTY_PAGES, isPlaceholderData: true }),
    });

    expect(state).toEqual({ kind: "loading" });
  });

  it("keeps the loaded notes when the next page fails", () => {
    const state = notesArchiveListState({
      ...NO_QUERY,
      list: snapshot({ hasNextPage: true, isFetchNextPageError: true }),
    });

    expect(state).toMatchObject({ kind: "ready", nextPage: "error" });
  });

  it("reports the next page loading ahead of an earlier failure", () => {
    const state = notesArchiveListState({
      ...NO_QUERY,
      list: snapshot({ hasNextPage: true, isFetchingNextPage: true, isFetchNextPageError: true }),
    });

    expect(state).toMatchObject({ kind: "ready", nextPage: "loading" });
  });

  it("offers more only while a next page exists", () => {
    expect(
      notesArchiveListState({ ...NO_QUERY, list: snapshot({ hasNextPage: true }) }),
    ).toMatchObject({ nextPage: "idle" });
    expect(notesArchiveListState({ ...NO_QUERY, list: snapshot() })).toMatchObject({
      nextPage: "none",
    });
  });

  it("marks the previous notes as refreshing while a new query loads", () => {
    const state = notesArchiveListState({
      ...NO_QUERY,
      list: snapshot({ isPlaceholderData: true }),
    });

    expect(state).toMatchObject({ isRefreshing: true, kind: "ready" });
  });
});
