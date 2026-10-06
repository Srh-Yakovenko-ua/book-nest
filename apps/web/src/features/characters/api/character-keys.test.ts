import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { makeCharacterSummary, makeCharacterSummaryPage } from "../model/characters.fixtures";
import { characterKeys } from "./character-keys";

const BOOK_ID = "3f7b0b7a-0a1a-4f0a-9b1a-0a1a4f0a9b1a";

const LIST_PARAMS: BookCharactersControllerListParams = { pageSize: 20, sort: "importance" };

function matchedKeys(client: QueryClient, queryKey: readonly unknown[]) {
  return client.getQueriesData({ queryKey }).map(([key]) => key);
}

function seededClient(): QueryClient {
  const client = new QueryClient();
  const page = makeCharacterSummaryPage([makeCharacterSummary()]);

  client.setQueryData(characterKeys.bookRoster(BOOK_ID, LIST_PARAMS), page);
  client.setQueryData(characterKeys.bookRosterInfinite(BOOK_ID, LIST_PARAMS), {
    pageParams: [1],
    pages: [page],
  });

  return client;
}

describe("characterKeys.bookSummary", () => {
  it("separates two reading positions of the same book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextChapter: 5 })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextChapter: 40 }),
    );
  });

  it("separates two context books of the same roster book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextBookId: "first" })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextBookId: "second" }),
    );
  });

  it("stays stable for the same reading context", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextPage: 12 })).toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextPage: 12 }),
    );
  });
});

describe("characterKeys roster families", () => {
  it("keeps the finite and the infinite roster key apart for identical params", () => {
    expect(characterKeys.bookRoster(BOOK_ID, LIST_PARAMS)).not.toEqual(
      characterKeys.bookRosterInfinite(BOOK_ID, LIST_PARAMS),
    );
  });

  it("reaches only the finite entry from the finite write scope", () => {
    const client = seededClient();

    expect(matchedKeys(client, characterKeys.bookRosterFiniteScope(BOOK_ID))).toEqual([
      characterKeys.bookRoster(BOOK_ID, LIST_PARAMS),
    ]);
  });

  it("reaches only the infinite entry from the infinite write scope", () => {
    const client = seededClient();

    expect(matchedKeys(client, characterKeys.bookRosterInfiniteScope(BOOK_ID))).toEqual([
      characterKeys.bookRosterInfinite(BOOK_ID, LIST_PARAMS),
    ]);
  });

  it("reaches both families from the shared invalidation scope", () => {
    const client = seededClient();

    expect(matchedKeys(client, characterKeys.bookRosterScope(BOOK_ID))).toHaveLength(2);
  });

  it("leaves another book's roster untouched by either write scope", () => {
    const client = seededClient();

    expect(matchedKeys(client, characterKeys.bookRosterFiniteScope("other-book"))).toEqual([]);
    expect(matchedKeys(client, characterKeys.bookRosterInfiniteScope("other-book"))).toEqual([]);
  });
});
