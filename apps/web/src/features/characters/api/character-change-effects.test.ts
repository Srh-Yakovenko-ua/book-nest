import type { QueryKey } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";
import { tagsKeys } from "@/features/tags/api/tags-keys";
import { seededClient, staleFlags } from "@/test-query-cache";

import { characterChangeEffects } from "./character-change-effects";
import { characterKeys } from "./character-keys";

const KEYS = {
  bookDetail: bookKeys.detail("book-1"),
  chapters: bookKeys.chapters("book-1"),
  otherChapters: bookKeys.chapters("book-2"),
  overview: characterKeys.overview(),
  tagSummary: tagsKeys.summary,
} as const satisfies Record<string, QueryKey>;

describe("characterChangeEffects", () => {
  it("refreshes the character overview, the book's chapters and the tag summary after an edit in a book", async () => {
    const keys = [KEYS.overview, KEYS.chapters, KEYS.tagSummary];
    const client = seededClient(keys);

    await characterChangeEffects.charactersChanged(client, {
      bookId: "book-1",
      change: "updatedInBook",
    });

    expect(staleFlags(client, keys)).toEqual([true, true, true]);
  });

  it("leaves other books' chapters and the book detail fresh after an edit in a book", async () => {
    const keys = [KEYS.chapters, KEYS.otherChapters, KEYS.bookDetail];
    const client = seededClient(keys);

    await characterChangeEffects.charactersChanged(client, {
      bookId: "book-1",
      change: "updatedInBook",
    });

    expect(staleFlags(client, keys)).toEqual([true, false, false]);
  });

  it("refreshes the book's chapters but not the tag summary after a character is unlinked", async () => {
    const keys = [KEYS.chapters, KEYS.tagSummary];
    const client = seededClient(keys);

    await characterChangeEffects.charactersChanged(client, {
      bookId: "book-1",
      change: "unlinkedFromBook",
    });

    expect(staleFlags(client, keys)).toEqual([true, false]);
  });

  it.each(["softDeleted", "restored"] as const)(
    "refreshes every book's chapters and the tag summary but not book details after a character is %s",
    async (change) => {
      const keys = [KEYS.chapters, KEYS.otherChapters, KEYS.tagSummary, KEYS.bookDetail];
      const client = seededClient(keys);

      await characterChangeEffects.charactersChanged(client, { change });

      expect(staleFlags(client, keys)).toEqual([true, true, true, false]);
    },
  );

  it("refreshes the character overview and the tag summary but not chapters after a character is created in a book", async () => {
    const keys = [KEYS.overview, KEYS.tagSummary, KEYS.chapters];
    const client = seededClient(keys);

    await characterChangeEffects.charactersChanged(client, { change: "createdInBook" });

    expect(staleFlags(client, keys)).toEqual([true, true, false]);
  });
});
