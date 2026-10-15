import type { BookView, Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import {
  CHARACTERS_ROSTER_PAGE_SIZE,
  toBookCharactersListParams,
  toCharacterBookContext,
} from "./characters-roster-query";

const rosterState = {
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
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "name",
    });
  });

  it("leaves the page number to the infinite query", () => {
    expect(toBookCharactersListParams(rosterState, {})).not.toHaveProperty("pageNumber");
  });

  it("omits an empty search and trims a filled one", () => {
    expect(toBookCharactersListParams(rosterState, {})).not.toHaveProperty("search");
    expect(
      toBookCharactersListParams({ ...rosterState, characterSearch: "  Ґеральт  " }, {}),
    ).toMatchObject({ search: "Ґеральт" });
  });

  it("forwards the context book to the backend", () => {
    expect(toBookCharactersListParams(rosterState, { contextBookId: "book-1" })).toEqual({
      contextBookId: "book-1",
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "importance",
    });
  });
});

describe("toCharacterBookContext", () => {
  it("names only the book while it is still being read", () => {
    expect(toCharacterBookContext(makeBookAt(42, "reading"))).toEqual({
      contextBookId: "book-1",
    });
  });

  it("reveals everything once the book is finished", () => {
    expect(toCharacterBookContext(makeBookAt(42, "finished"))).toEqual({});
  });

  it("reveals everything once the book is abandoned", () => {
    expect(toCharacterBookContext(makeBookAt(42, "dnf"))).toEqual({});
  });

  it("sends nothing when the book has no reading progress", () => {
    expect(toCharacterBookContext(makeBookView({ id: "book-1", readingProgress: null }))).toEqual(
      {},
    );
  });

  it("sends nothing when the current page is missing", () => {
    expect(toCharacterBookContext(makeBookAt(null, "reading"))).toEqual({});
  });

  it("sends nothing when the current page is not a positive whole page", () => {
    expect(toCharacterBookContext(makeBookAt(0, "reading"))).toEqual({});
    expect(toCharacterBookContext(makeBookAt(-3, "reading"))).toEqual({});
    expect(toCharacterBookContext(makeBookAt(4.5, "reading"))).toEqual({});
  });
});
