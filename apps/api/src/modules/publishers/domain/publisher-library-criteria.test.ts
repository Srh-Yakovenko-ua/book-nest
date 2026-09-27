import { LibraryPublishersQuerySchema, LibraryPublishersQuickCountsQuerySchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import { toLibraryPublisherCriteria } from "./publisher-library-criteria.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("toLibraryPublisherCriteria", () => {
  it("defaults every advanced flag to false when the query leaves it out", () => {
    const query = LibraryPublishersQuickCountsQuerySchema.parse({});

    expect(toLibraryPublisherCriteria({ query, userId: USER_ID })).toEqual({
      geography: "all",
      hasBooksToBuy: false,
      hasQueue: false,
      hasRatedBooks: false,
      hasSeries: false,
      hasWantToRead: false,
      search: undefined,
      source: "all",
      userId: USER_ID,
    });
  });

  it("keeps search, geography, source and advanced flags from a full list query", () => {
    const query = LibraryPublishersQuerySchema.parse({
      filter: "read",
      geography: "foreign",
      hasRatedBooks: "true",
      hasSeries: "false",
      search: "penguin",
      source: "global",
    });

    const criteria = toLibraryPublisherCriteria({ query, userId: USER_ID });

    expect(criteria).toMatchObject({
      geography: "foreign",
      hasRatedBooks: true,
      hasSeries: false,
      search: "penguin",
      source: "global",
    });
    expect(criteria).not.toHaveProperty("filter");
  });
});

describe("LibraryPublishersQuickCountsQuerySchema", () => {
  it("drops the quick filter, paging, sort, order and locale", () => {
    const query = LibraryPublishersQuickCountsQuerySchema.parse({
      filter: "read",
      locale: "en",
      order: "asc",
      pageNumber: "2",
      pageSize: "5",
      sort: "name",
    });

    expect(query).toEqual({ geography: "all", source: "all" });
  });

  it("rejects an unknown geography the same way the list does", () => {
    expect(LibraryPublishersQuickCountsQuerySchema.safeParse({ geography: "mars" }).success).toBe(
      false,
    );
  });
});
