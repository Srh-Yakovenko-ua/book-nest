import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { RelationshipListCriteria } from "../model/relationship-list-query";
import type { RelationshipReveal } from "../model/relationship-reveal";
import type { RelationshipScope } from "../model/relationship-scope";

import { toRelationshipScopeKey } from "../model/relationship-scope";
import { RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { relationshipKeys } from "./relationship-keys";

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;
const SERIES_ID = "5a5a5a5a-0000-4000-8000-000000000003";

const SCOPES = {
  book: { bookId: BOOK_ID, kind: "book" },
  characterGlobal: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
  characterInBook: { characterId: CHARACTER_ID, contextBookId: BOOK_ID, kind: "character" },
  series: { contextBookId: BOOK_ID, kind: "series", seriesId: SERIES_ID },
} as const satisfies Record<string, RelationshipScope>;

const DEFAULT_CRITERIA: RelationshipListCriteria = { sort: "name_asc" };

const NO_REVEAL: RelationshipReveal = { descriptionBookStateId: null, isTypeRevealed: false };

function detailsKey(scope: RelationshipScope, reveal: RelationshipReveal = NO_REVEAL) {
  return relationshipKeys.details({
    relationshipId: RELATIONSHIP_FIXTURE.relationshipId,
    reveal,
    scopeKey: toRelationshipScopeKey(scope),
  });
}

function listKey(scope: RelationshipScope, criteria: RelationshipListCriteria = DEFAULT_CRITERIA) {
  return relationshipKeys.list({ criteria, scopeKey: toRelationshipScopeKey(scope) });
}

describe("relationshipKeys.list", () => {
  it("separates a book list from a series list with the same criteria", () => {
    expect(listKey(SCOPES.book)).not.toEqual(listKey(SCOPES.series));
  });

  it("separates the global character list from the same character inside a book", () => {
    expect(listKey(SCOPES.characterGlobal)).not.toEqual(listKey(SCOPES.characterInBook));
  });

  it("separates two series context books", () => {
    expect(listKey(SCOPES.series)).not.toEqual(
      listKey({ ...SCOPES.series, contextBookId: "7b7b7b7b-0000-4000-8000-000000000004" }),
    );
  });

  it("separates two criteria within one scope", () => {
    expect(listKey(SCOPES.book)).not.toEqual(
      listKey(SCOPES.book, { categories: ["family"], sort: "name_asc" }),
    );
  });

  it("stays stable for the same scope and criteria", () => {
    expect(listKey(SCOPES.book, { q: "Цірі", sort: "newest" })).toEqual(
      listKey({ bookId: BOOK_ID, kind: "book" }, { q: "Цірі", sort: "newest" }),
    );
  });
});

describe("relationshipKeys.details", () => {
  it("separates the masked view from the type reveal", () => {
    expect(detailsKey(SCOPES.book)).not.toEqual(
      detailsKey(SCOPES.book, { descriptionBookStateId: null, isTypeRevealed: true }),
    );
  });

  it("separates the reveals of two book state descriptions", () => {
    expect(
      detailsKey(SCOPES.book, { descriptionBookStateId: "state-1", isTypeRevealed: false }),
    ).not.toEqual(
      detailsKey(SCOPES.book, { descriptionBookStateId: "state-2", isTypeRevealed: false }),
    );
  });

  it("separates the same relationship opened from two contexts", () => {
    expect(detailsKey(SCOPES.characterGlobal)).not.toEqual(detailsKey(SCOPES.characterInBook));
  });
});

describe("relationshipKeys.all", () => {
  it("reaches every list and details entry and nothing outside relationships", () => {
    const client = new QueryClient();
    client.setQueryData(listKey(SCOPES.book), { pageParams: [1], pages: [] });
    client.setQueryData(detailsKey(SCOPES.series), {});
    client.setQueryData(["characters", "detail", CHARACTER_ID], {});

    expect(client.getQueriesData({ queryKey: relationshipKeys.all }).map(([key]) => key)).toEqual([
      listKey(SCOPES.book),
      detailsKey(SCOPES.series),
    ]);
  });
});
