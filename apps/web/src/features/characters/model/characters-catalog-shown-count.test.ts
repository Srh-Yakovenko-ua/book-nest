import { describe, expect, it } from "vitest";

import { countShownCharacters } from "./characters-catalog-shown-count";

const PAGE_SIZE = 24;

function heldPages(firstPage: number, lastPage: number, lastPageItems: number, totalCount: number) {
  return Array.from({ length: lastPage - firstPage + 1 }, (_unused, index) => {
    const page = firstPage + index;
    const itemCount = page === lastPage ? lastPageItems : PAGE_SIZE;
    return {
      items: Array.from({ length: itemCount }, (_item, position) => position),
      page,
      pageSize: PAGE_SIZE,
      totalCount,
    };
  });
}

describe("countShownCharacters", () => {
  it("shows nothing before the first page arrives", () => {
    expect(countShownCharacters([])).toEqual({ shown: 0, total: 0 });
  });

  it("counts the items of a single first page", () => {
    expect(countShownCharacters(heldPages(1, 1, 5, 5))).toEqual({ shown: 5, total: 5 });
  });

  it("still counts the first page once only pages 2 to 11 are held", () => {
    expect(countShownCharacters(heldPages(2, 11, PAGE_SIZE, 300))).toEqual({
      shown: 264,
      total: 300,
    });
  });

  it("reaches the total on a short last page", () => {
    expect(countShownCharacters(heldPages(4, 13, 5, 293))).toEqual({ shown: 293, total: 293 });
  });

  it("never claims more than the total the backend reports", () => {
    expect(countShownCharacters(heldPages(1, 3, PAGE_SIZE, 60))).toEqual({ shown: 60, total: 60 });
  });

  it("takes the total from the newest page once the catalog grew while scrolling", () => {
    const pages = [...heldPages(1, 2, PAGE_SIZE, 50), ...heldPages(3, 3, 12, 60)];

    expect(countShownCharacters(pages)).toEqual({ shown: 60, total: 60 });
  });

  it("takes the total from the newest page once characters were deleted while scrolling", () => {
    const pages = [...heldPages(1, 2, PAGE_SIZE, 50), ...heldPages(3, 3, 0, 45)];

    expect(countShownCharacters(pages)).toEqual({ shown: 45, total: 45 });
  });
});
