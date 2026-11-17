import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { matchesAnyKeyPrefix, matchesApiRoot, retireQueries } from "./query-keys";

const matchesBooks = matchesApiRoot("/api/books");

const RETIRED_KEYS = {
  observed: ["/api/books", "detail", "observed-book"],
  unobserved: ["/api/books", "detail", "unobserved-book"],
} as const;

describe("matchesApiRoot", () => {
  it("matches a key whose head is the root itself", () => {
    expect(matchesBooks({ queryKey: ["/api/books"] })).toBe(true);
  });

  it("matches a generated key whose head is a sub-path of the root", () => {
    expect(matchesBooks({ queryKey: ["/api/books/facets", {}] })).toBe(true);
  });

  it("does not match a sibling resource that only shares the root as a text prefix", () => {
    expect(matchesBooks({ queryKey: ["/api/books-to-buy"] })).toBe(false);
  });

  it("does not match a key whose head is not a string", () => {
    expect(matchesBooks({ queryKey: [["/api/books"]] })).toBe(false);
  });

  it("does not match an empty key", () => {
    expect(matchesBooks({ queryKey: [] })).toBe(false);
  });
});

describe("retireQueries", () => {
  it("keeps the data of an observed match and marks it invalidated without refetching it", () => {
    const client = new QueryClient();
    const queryFn = vi.fn(() => Promise.resolve("refetched"));
    client.setQueryData(RETIRED_KEYS.observed, "cached");
    const observer = new QueryObserver(client, {
      queryFn,
      queryKey: RETIRED_KEYS.observed,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    retireQueries(client, matchesAnyKeyPrefix(RETIRED_KEYS.observed));

    expect(client.getQueryState(RETIRED_KEYS.observed)).toMatchObject({
      data: "cached",
      isInvalidated: true,
    });
    expect(queryFn).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("removes a match that nothing observes", () => {
    const client = new QueryClient();
    client.setQueryData(RETIRED_KEYS.unobserved, "cached");

    retireQueries(client, matchesAnyKeyPrefix(RETIRED_KEYS.unobserved));

    expect(client.getQueryState(RETIRED_KEYS.unobserved)).toBeUndefined();
  });
});
