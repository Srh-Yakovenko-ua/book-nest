import { describe, expect, it } from "vitest";

import type { WishlistQueryState } from "./wishlist-query";

import {
  countActiveWishlistFilters,
  hasActiveWishlistFilters,
  hasActiveWishlistSearch,
  isWishlistRangeValid,
  toWishlistParams,
  wishlistRangeFlags,
} from "./wishlist-query";

const EMPTY_STATE: WishlistQueryState = {
  age: [],
  author: [],
  bookType: null,
  currency: [],
  format: [],
  genre: [],
  hasCover: null,
  isFavorite: null,
  language: [],
  link: null,
  pagesMax: null,
  pagesMin: null,
  priceMax: null,
  priceMin: null,
  publisher: [],
  q: "",
  seriesPlacement: [],
  sort: "added_asc",
  store: [],
  tag: [],
  view: "grid",
  yearMax: null,
  yearMin: null,
};

function stateWith(patch: Partial<WishlistQueryState>): WishlistQueryState {
  return { ...EMPTY_STATE, ...patch };
}

describe("countActiveWishlistFilters", () => {
  it("counts nothing for an untouched wishlist", () => {
    expect(countActiveWishlistFilters(EMPTY_STATE)).toBe(0);
    expect(hasActiveWishlistFilters(EMPTY_STATE)).toBe(false);
  });

  it("does not count the search query as a filter", () => {
    expect(countActiveWishlistFilters(stateWith({ q: "відьмак" }))).toBe(0);
    expect(hasActiveWishlistSearch(stateWith({ q: "відьмак" }))).toBe(true);
  });

  it("counts a multi-value filter once no matter how many values it holds", () => {
    expect(countActiveWishlistFilters(stateWith({ store: ["Yakaboo", "Книгарня Є"] }))).toBe(1);
  });

  it("counts both ends of one range as a single filter", () => {
    expect(countActiveWishlistFilters(stateWith({ pagesMax: 500, pagesMin: 100 }))).toBe(1);
  });

  it("counts every distinct filter that is set", () => {
    const state = stateWith({
      age: ["long"],
      bookType: "series_part",
      hasCover: true,
      link: "has_price",
      seriesPlacement: ["gap"],
    });

    expect(countActiveWishlistFilters(state)).toBe(5);
  });

  it("treats an explicit no as an active filter", () => {
    expect(countActiveWishlistFilters(stateWith({ isFavorite: false }))).toBe(1);
  });

  it("counts the currency and its price range as two filters", () => {
    expect(countActiveWishlistFilters(stateWith({ currency: ["UAH"], priceMin: 200 }))).toBe(2);
  });

  it("does not count a price range that no single currency can express", () => {
    expect(countActiveWishlistFilters(stateWith({ priceMin: 200 }))).toBe(0);
    expect(countActiveWishlistFilters(stateWith({ currency: ["UAH", "USD"], priceMin: 200 }))).toBe(
      1,
    );
  });
});

describe("wishlistRangeFlags", () => {
  it("flags nothing when a range has only one end", () => {
    expect(wishlistRangeFlags(stateWith({ pagesMin: 100 }))).toEqual({
      pages: false,
      price: false,
      year: false,
    });
  });

  it("flags an inverted range", () => {
    expect(wishlistRangeFlags(stateWith({ priceMax: 100, priceMin: 500 })).price).toBe(true);
    expect(isWishlistRangeValid(stateWith({ priceMax: 100, priceMin: 500 }))).toBe(false);
  });

  it("accepts a range whose ends are equal", () => {
    expect(isWishlistRangeValid(stateWith({ yearMax: 2020, yearMin: 2020 }))).toBe(true);
  });
});

describe("toWishlistParams", () => {
  it("sends nothing but the empty collections for an untouched wishlist", () => {
    expect(toWishlistParams(EMPTY_STATE)).toEqual({
      age: [],
      author: [],
      currency: [],
      format: [],
      genre: [],
      language: [],
      publisher: [],
      seriesPlacement: [],
      sort: "added_asc",
      store: [],
      tag: [],
    });
  });

  it("trims the search query and drops it when only whitespace is left", () => {
    expect(toWishlistParams(stateWith({ q: "  відьмак  " })).q).toBe("відьмак");
    expect(toWishlistParams(stateWith({ q: "   " })).q).toBeUndefined();
  });

  it("stringifies the boolean filters the way the endpoint expects", () => {
    const params = toWishlistParams(stateWith({ hasCover: false, isFavorite: true }));

    expect(params.hasCover).toBe("false");
    expect(params.isFavorite).toBe("true");
  });

  it("drops a price range while no currency is chosen", () => {
    const params = toWishlistParams(stateWith({ priceMin: 100 }));

    expect(params.priceCurrency).toBeUndefined();
    expect(params.priceMin).toBeUndefined();
  });

  it("drops a price range while several currencies are chosen", () => {
    const params = toWishlistParams(stateWith({ currency: ["UAH", "USD"], priceMin: 100 }));

    expect(params.priceCurrency).toBeUndefined();
    expect(params.priceMin).toBeUndefined();
    expect(params.currency).toEqual(["UAH", "USD"]);
  });

  it("prices the range in the single chosen currency", () => {
    const params = toWishlistParams(stateWith({ currency: ["USD"], priceMin: 10 }));

    expect(params.priceCurrency).toBe("USD");
    expect(params.priceMin).toBe(10);
    expect(params.currency).toEqual(["USD"]);
  });

  it("keeps a lone currency as a plain filter while no price bound is set", () => {
    const params = toWishlistParams(stateWith({ currency: ["UAH"] }));

    expect(params.priceCurrency).toBeUndefined();
    expect(params.currency).toEqual(["UAH"]);
  });

  it("holds back an inverted range instead of letting the endpoint reject it", () => {
    const params = toWishlistParams(stateWith({ pagesMax: 10, pagesMin: 900, yearMin: 2000 }));

    expect(params.pagesMin).toBeUndefined();
    expect(params.pagesMax).toBeUndefined();
    expect(params.yearMin).toBe(2000);
  });

  it("hands the sort to the endpoint instead of ordering in the browser", () => {
    expect(toWishlistParams(EMPTY_STATE).sort).toBe("added_asc");
    expect(toWishlistParams(stateWith({ sort: "price_asc" })).sort).toBe("price_asc");
  });

  it("does not count the sort as an active filter", () => {
    expect(countActiveWishlistFilters(stateWith({ sort: "price_desc" }))).toBe(0);
  });

  it("passes multi-value filters through as arrays", () => {
    const params = toWishlistParams(
      stateWith({ age: ["recent", "long"], store: ["Yakaboo", "Книгарня Є"] }),
    );

    expect(params.age).toEqual(["recent", "long"]);
    expect(params.store).toEqual(["Yakaboo", "Книгарня Є"]);
  });
});
