import { describe, expect, it } from "vitest";

import { isLibraryRangeValid, libraryRangeFlags } from "./library-query";

describe("isLibraryRangeValid", () => {
  it("is invalid when both bounds are set and min exceeds max", () => {
    const params = { yearMax: 199, yearMin: 1990 };
    expect(isLibraryRangeValid(params)).toBe(false);
    expect(libraryRangeFlags(params)).toEqual({ pages: false, rating: false, year: true });
  });

  it("is valid when only one bound is set", () => {
    expect(isLibraryRangeValid({ yearMin: 1990 })).toBe(true);
    expect(isLibraryRangeValid({ yearMax: 199 })).toBe(true);
  });

  it("is valid when min does not exceed max", () => {
    const params = {
      pagesMax: 100,
      pagesMin: 100,
      ratingMax: 5,
      ratingMin: 2,
      yearMax: 1990,
      yearMin: 199,
    };
    expect(isLibraryRangeValid(params)).toBe(true);
    expect(libraryRangeFlags(params)).toEqual({ pages: false, rating: false, year: false });
  });
});
