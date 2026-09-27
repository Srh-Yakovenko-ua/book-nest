import type { QueryKey } from "@tanstack/react-query";

import { describe, expect, it, vi } from "vitest";

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
