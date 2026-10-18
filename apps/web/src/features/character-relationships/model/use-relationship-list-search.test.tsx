import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";
import { useRelationshipListSearch } from "./use-relationship-list-search";

function relationshipSearchFrom(search: string): Record<string, string> {
  const { result } = renderHook(() => useRelationshipListSearch(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter searchParams={search}>{children}</NuqsTestingAdapter>
    ),
  });
  return Object.fromEntries(result.current);
}

describe("useRelationshipListSearch", () => {
  it("carries the relationship list state and none of the other page params", () => {
    expect(
      relationshipSearchFrom(
        "bookId=book-1&tab=relationships&q=silver&relQ=ciri&relCat=family,romantic&relSort=newest",
      ),
    ).toEqual({ relCat: "family,romantic", relQ: "ciri", relSort: "newest" });
  });

  it("leaves out the default sort and the empty search and filters", () => {
    expect(relationshipSearchFrom("relSort=name_asc&relQ=&relCat=&relStatus=")).toEqual({});
  });

  it("drops the values the list would not accept", () => {
    expect(
      relationshipSearchFrom("relBook=book-2&relCat=family,unknown&relSort=random&relCanon=maybe"),
    ).toEqual({ relCat: "family" });
  });

  it("keeps a book filter that names a book", () => {
    expect(relationshipSearchFrom(`relBook=${RELATIONSHIP_FIXTURE.book.id}`)).toEqual({
      relBook: RELATIONSHIP_FIXTURE.book.id,
    });
  });

  it("keeps a search with spaces and reserved characters intact", () => {
    const search = new URLSearchParams({ relQ: "Цірі & Ґеральт + 100%" }).toString();

    expect(relationshipSearchFrom(search)).toEqual({ relQ: "Цірі & Ґеральт + 100%" });
  });
});
