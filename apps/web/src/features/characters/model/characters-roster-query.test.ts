import type { BookView, Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import {
  CHARACTERS_ROSTER_PAGE_SIZE,
  toBookCharactersListParams,
  toCharacterReadingContext,
} from "./characters-roster-query";

const rosterState = {
  characterPage: 1,
  characterSearch: "",
  characterSort: "importance",
} as const;

function makeBookAt(currentPage: Nullable<number>, readingStatus: ReadingStatus): BookView {
  return makeBookView({
    id: "book-1",
    readingProgress: {
      abandonedAt: null,
      currentPage,
      finishedAt: null,
      impression: null,
      lastProgressUpdateAt: null,
      note: null,
      pausedAt: null,
      rating: null,
      startedAt: null,
    },
    readingStatus,
  });
}

describe("toBookCharactersListParams", () => {
  it("always asks the backend for the selected sort", () => {
    expect(toBookCharactersListParams({ ...rosterState, characterSort: "name" }, {})).toEqual({
      pageNumber: 1,
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "name",
    });
  });

  it("omits an empty search and trims a filled one", () => {
    expect(toBookCharactersListParams(rosterState, {})).not.toHaveProperty("search");
    expect(
      toBookCharactersListParams({ ...rosterState, characterSearch: "  Ґеральт  " }, {}),
    ).toMatchObject({ search: "Ґеральт" });
  });

  it("forwards the reading context to the backend", () => {
    expect(
      toBookCharactersListParams(rosterState, { contextBookId: "book-1", contextPage: 42 }),
    ).toMatchObject({ contextBookId: "book-1", contextPage: 42 });
  });
});

describe("toCharacterReadingContext", () => {
  it("sends the current page for a book that is still being read", () => {
    expect(toCharacterReadingContext(makeBookAt(42, "reading"))).toEqual({
      contextBookId: "book-1",
      contextPage: 42,
    });
  });

  it("reveals everything once the book is finished or abandoned", () => {
    expect(toCharacterReadingContext(makeBookAt(42, "finished"))).toEqual({});
    expect(toCharacterReadingContext(makeBookAt(42, "dnf"))).toEqual({});
  });

  it("sends nothing when there is no usable position", () => {
    expect(toCharacterReadingContext(makeBookAt(null, "reading"))).toEqual({});
    expect(toCharacterReadingContext(makeBookAt(0, "reading"))).toEqual({});
  });
});
