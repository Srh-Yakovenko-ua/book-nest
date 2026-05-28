import { describe, expect, it } from "vitest";

import { buildPaginator } from "./paginator.js";

describe("buildPaginator", () => {
  it("computes pagesCount with totalCount 25 and pageSize 10", () => {
    const result = buildPaginator({
      items: [],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 25,
    });

    expect(result.pagesCount).toBe(3);
  });

  it("returns pagesCount 0 when totalCount is 0", () => {
    const result = buildPaginator({
      items: [],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
    });

    expect(result.pagesCount).toBe(0);
  });

  it("returns pagesCount 1 when totalCount equals pageSize", () => {
    const result = buildPaginator({
      items: [],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 10,
    });

    expect(result.pagesCount).toBe(1);
  });

  it("rounds pagesCount up when totalCount overflows the last page by one", () => {
    const result = buildPaginator({
      items: [],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 11,
    });

    expect(result.pagesCount).toBe(2);
  });

  it("passes items array through unchanged by reference", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const result = buildPaginator({
      items,
      pageNumber: 1,
      pageSize: 10,
      totalCount: 3,
    });

    expect(result.items).toBe(items);
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("echoes page, pageSize and totalCount on the result", () => {
    const result = buildPaginator({
      items: [],
      pageNumber: 4,
      pageSize: 25,
      totalCount: 137,
    });

    expect(result).toMatchObject({
      page: 4,
      pagesCount: 6,
      pageSize: 25,
      totalCount: 137,
    });
  });
});
