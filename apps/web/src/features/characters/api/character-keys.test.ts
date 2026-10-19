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
  it("separates a spoiler-safe summary from the full one", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextBookId: BOOK_ID })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, {}),
    );
  });

  it("separates two context books of the same roster book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextBookId: "first" })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextBookId: "second" }),
    );
  });

  it("stays stable for the same context book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextBookId: "first" })).toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextBookId: "first" }),
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

describe("characterKeys.customLabels", () => {
  it("sits inside the character scope a saved book character invalidates", () => {
    const client = new QueryClient();
    client.setQueryData(characterKeys.customLabels(), { roles: [], statuses: [] });

    expect(matchedKeys(client, characterKeys.all)).toEqual([characterKeys.customLabels()]);
  });
});

describe("characterKeys facts", () => {
  const SCOPE = { bookId: BOOK_ID, characterId: "char-1" };

  it("separates the facts of two books of the same character", () => {
    expect(characterKeys.factsInfinite({ ...SCOPE, q: "" })).not.toEqual(
      characterKeys.factsInfinite({ ...SCOPE, bookId: "other-book", q: "" }),
    );
  });

  it("separates two searches within the same book", () => {
    expect(characterKeys.factsInfinite({ ...SCOPE, q: "" })).not.toEqual(
      characterKeys.factsInfinite({ ...SCOPE, q: "silver" }),
    );
  });

  it("reaches every search of the book from the facts scope and nothing of another book", () => {
    const client = new QueryClient();
    const page = { items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 };
    client.setQueryData(characterKeys.factsInfinite({ ...SCOPE, q: "" }), page);
    client.setQueryData(characterKeys.factsInfinite({ ...SCOPE, q: "silver" }), page);
    client.setQueryData(
      characterKeys.factsInfinite({ ...SCOPE, bookId: "other-book", q: "" }),
      page,
    );
    client.setQueryData(
      characterKeys.factsInfinite({ ...SCOPE, characterId: "char-2", q: "" }),
      page,
    );

    expect(matchedKeys(client, characterKeys.factsScope(SCOPE))).toEqual([
      characterKeys.factsInfinite({ ...SCOPE, q: "" }),
      characterKeys.factsInfinite({ ...SCOPE, q: "silver" }),
    ]);
  });
});
