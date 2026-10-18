import { describe, expect, it } from "vitest";

import type { RelationshipGraphScope } from "./relationship-graph-scope";

import {
  toRelationshipGraphCharacterHref,
  toRelationshipGraphLayoutKey,
} from "./relationship-graph-scope";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;
const CONTEXT_BOOK_ID = RELATIONSHIP_FIXTURE.secondBook.id;
const SERIES_ID = "5e5e5e5e-0000-4000-8000-000000000005";

const SCOPES = {
  book: { bookId: BOOK_ID, kind: "book" },
  seriesInBook: { contextBookId: CONTEXT_BOOK_ID, kind: "series", seriesId: SERIES_ID },
  seriesWithoutBook: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
} satisfies Record<string, RelationshipGraphScope>;

describe("toRelationshipGraphLayoutKey", () => {
  it("keys a book graph by the book alone, without a reading context", () => {
    expect(toRelationshipGraphLayoutKey({ mode: "family", scope: SCOPES.book })).toEqual({
      contextBookId: null,
      mode: "family",
      scopeId: BOOK_ID,
      scopeType: "book",
    });
  });

  it("keys a series graph by the series and the chosen book", () => {
    expect(toRelationshipGraphLayoutKey({ mode: "all", scope: SCOPES.seriesInBook })).toEqual({
      contextBookId: CONTEXT_BOOK_ID,
      mode: "all",
      scopeId: SERIES_ID,
      scopeType: "series",
    });
  });

  it("keeps a series graph without a chosen book apart from every book context", () => {
    expect(toRelationshipGraphLayoutKey({ mode: "all", scope: SCOPES.seriesWithoutBook })).toEqual({
      contextBookId: null,
      mode: "all",
      scopeId: SERIES_ID,
      scopeType: "series",
    });
  });
});

describe("toRelationshipGraphCharacterHref", () => {
  it("opens a character of a book graph in that book's context", () => {
    expect(
      toRelationshipGraphCharacterHref({
        node: { id: CHARACTER_ID, importance: "major" },
        scope: SCOPES.book,
      }),
    ).toBe(`/characters/${CHARACTER_ID}?bookId=${BOOK_ID}`);
  });

  it("opens the plain character page for a book graph character who does not appear in that book", () => {
    expect(
      toRelationshipGraphCharacterHref({
        node: { id: CHARACTER_ID, importance: null },
        scope: SCOPES.book,
      }),
    ).toBe(`/characters/${CHARACTER_ID}`);
  });

  it("opens the plain character page for a series graph character even with a chosen book", () => {
    expect(
      toRelationshipGraphCharacterHref({
        node: { id: CHARACTER_ID, importance: "major" },
        scope: SCOPES.seriesInBook,
      }),
    ).toBe(`/characters/${CHARACTER_ID}`);
  });

  it("opens the plain character page when the series has no chosen book", () => {
    expect(
      toRelationshipGraphCharacterHref({
        node: { id: CHARACTER_ID, importance: "major" },
        scope: SCOPES.seriesWithoutBook,
      }),
    ).toBe(`/characters/${CHARACTER_ID}`);
  });
});
