import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";
import { relationshipKeys } from "@/features/character-relationships/api/relationship-keys";
import { toRelationshipScopeKey } from "@/features/character-relationships/model/relationship-scope";

import {
  invalidateCharacterFavoriteViews,
  invalidateCharacterIdentityViews,
} from "./character-identity-sync";
import { characterKeys } from "./character-keys";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const RELATIONSHIP_ID = "22222222-2222-4222-8222-222222222222";

const SEEDED_KEYS = {
  book: bookKeys.detail(BOOK_ID),
  character: characterKeys.books(CHARACTER_ID),
  relationship: relationshipKeys.editable(RELATIONSHIP_ID),
} as const;

const FAVORITE_SEEDED_KEYS = {
  books: characterKeys.books(CHARACTER_ID),
  details: characterKeys.detailsScope(CHARACTER_ID),
  facts: characterKeys.factsScope({ bookId: BOOK_ID, characterId: CHARACTER_ID }),
  graph: relationshipKeys.graphScope,
  relationshipList: relationshipKeys.list({
    criteria: { sort: "name_asc" },
    scopeKey: toRelationshipScopeKey({ bookId: BOOK_ID, kind: "book" }),
  }),
} as const;

describe("invalidateCharacterIdentityViews", () => {
  it("marks the character and relationship views stale and leaves unrelated views fresh", () => {
    const client = new QueryClient();
    for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});

    invalidateCharacterIdentityViews(client);

    expect({
      book: client.getQueryState(SEEDED_KEYS.book)?.isInvalidated,
      character: client.getQueryState(SEEDED_KEYS.character)?.isInvalidated,
      relationship: client.getQueryState(SEEDED_KEYS.relationship)?.isInvalidated,
    }).toEqual({ book: false, character: true, relationship: true });
  });
});

describe("invalidateCharacterFavoriteViews", () => {
  it("marks the character's details and the relationship graph stale and leaves its facts, books and relationship lists fresh", () => {
    const client = new QueryClient();
    for (const key of Object.values(FAVORITE_SEEDED_KEYS)) client.setQueryData(key, {});

    invalidateCharacterFavoriteViews(client, { characterId: CHARACTER_ID });

    expect({
      books: client.getQueryState(FAVORITE_SEEDED_KEYS.books)?.isInvalidated,
      details: client.getQueryState(FAVORITE_SEEDED_KEYS.details)?.isInvalidated,
      facts: client.getQueryState(FAVORITE_SEEDED_KEYS.facts)?.isInvalidated,
      graph: client.getQueryState(FAVORITE_SEEDED_KEYS.graph)?.isInvalidated,
      relationshipList: client.getQueryState(FAVORITE_SEEDED_KEYS.relationshipList)?.isInvalidated,
    }).toEqual({
      books: false,
      details: true,
      facts: false,
      graph: true,
      relationshipList: false,
    });
  });
});
