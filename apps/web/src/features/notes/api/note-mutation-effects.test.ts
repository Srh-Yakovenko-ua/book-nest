import type { QueryKey } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";
import { createTestQueryClient } from "@/test-utils";

import { makeBookNote, makeSeriesNote } from "../model/notes.fixtures";
import { refreshAfterNoteMutation } from "./note-mutation-effects";
import { notesKeys } from "./notes-keys";

async function invalidatedAfter(
  mutation: Parameters<typeof refreshAfterNoteMutation>[1],
): Promise<QueryKey[]> {
  const queryClient = createTestQueryClient();
  const spy = vi.spyOn(queryClient, "invalidateQueries");

  await refreshAfterNoteMutation(queryClient, mutation);

  return spy.mock.calls.flatMap(([filters]) =>
    filters?.queryKey === undefined ? [] : [filters.queryKey],
  );
}

describe("refreshAfterNoteMutation overviews", () => {
  it("refreshes both overviews after a series note is deleted", async () => {
    const keys = await invalidatedAfter({ kind: "delete", note: makeSeriesNote() });

    expect(keys).toContainEqual(notesKeys.archivePart("books", "overview"));
    expect(keys).toContainEqual(notesKeys.archivePart("series", "overview"));
  });

  it("refreshes both overviews after a book note is deleted", async () => {
    const keys = await invalidatedAfter({ kind: "delete", note: makeBookNote() });

    expect(keys).toContainEqual(notesKeys.archivePart("books", "overview"));
    expect(keys).toContainEqual(notesKeys.archivePart("series", "overview"));
  });

  it("leaves the Books overview alone after a series note is created", async () => {
    const keys = await invalidatedAfter({ kind: "create", note: makeSeriesNote() });

    expect(keys).not.toContainEqual(notesKeys.archivePart("books", "overview"));
  });
});

describe("refreshAfterNoteMutation chapter suggestions", () => {
  const SEEDED_KEYS = {
    bookDetail: bookKeys.detail("book-1"),
    notedBookChapters: bookKeys.chapters("book-1"),
    otherBookChapters: bookKeys.chapters("book-2"),
  } as const;

  async function staleAfter(mutation: Parameters<typeof refreshAfterNoteMutation>[1]) {
    const queryClient = new QueryClient();
    for (const key of Object.values(SEEDED_KEYS)) queryClient.setQueryData(key, {});

    await refreshAfterNoteMutation(queryClient, mutation);

    return {
      bookDetail: queryClient.getQueryState(SEEDED_KEYS.bookDetail)?.isInvalidated,
      notedBookChapters: queryClient.getQueryState(SEEDED_KEYS.notedBookChapters)?.isInvalidated,
      otherBookChapters: queryClient.getQueryState(SEEDED_KEYS.otherBookChapters)?.isInvalidated,
    };
  }

  it.each(["create", "update", "delete"] as const)(
    "marks only the noted book's chapters stale after a book note %s",
    async (kind) => {
      expect(await staleAfter({ kind, note: makeBookNote() })).toEqual({
        bookDetail: false,
        notedBookChapters: true,
        otherBookChapters: false,
      });
    },
  );

  it.each(["create", "update", "delete"] as const)(
    "leaves every book's chapters alone after a series note %s",
    async (kind) => {
      expect(await staleAfter({ kind, note: makeSeriesNote() })).toEqual({
        bookDetail: false,
        notedBookChapters: false,
        otherBookChapters: false,
      });
    },
  );
});
