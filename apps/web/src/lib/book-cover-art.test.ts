import { describe, expect, it } from "vitest";

import { BOOK_COVER_ART, pickBookCoverArt } from "./book-cover-art";

const PINNED_PICKS = [
  {
    seed: "00000000-0000-4000-8000-000000000001",
    src: "/illustrations/book-covers/cover-3.png",
    titleTone: "paper",
  },
  {
    seed: "11111111-1111-4111-8111-111111111111",
    src: "/illustrations/book-covers/cover-2.png",
    titleTone: "ink",
  },
  {
    seed: "a3f1c2d4-5b6e-4f70-8a9b-0c1d2e3f4a5b",
    src: "/illustrations/book-covers/cover-1.png",
    titleTone: "paper",
  },
] as const;

const ALL_COVER_SOURCES = [
  "/illustrations/book-covers/cover-1.png",
  "/illustrations/book-covers/cover-2.png",
  "/illustrations/book-covers/cover-3.png",
  "/illustrations/book-covers/cover-4.png",
  "/illustrations/book-covers/cover-5.png",
  "/illustrations/book-covers/cover-6.png",
];

describe("pickBookCoverArt", () => {
  it.each(PINNED_PICKS)("picks $src with a $titleTone title for $seed", (pick) => {
    expect(pickBookCoverArt(pick.seed)).toEqual({ src: pick.src, titleTone: pick.titleTone });
  });

  it("gives the same seed the same cover on every call", () => {
    const seed = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

    const picked = Array.from({ length: 5 }, () => pickBookCoverArt(seed).src);

    expect(new Set(picked).size).toBe(1);
  });

  it("spreads sixty different book ids over all six covers", () => {
    const seeds = Array.from(
      { length: 60 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );

    const picked = new Set(seeds.map((seed) => pickBookCoverArt(seed).src));

    expect([...picked].sort()).toEqual(ALL_COVER_SOURCES);
  });
});

describe("BOOK_COVER_ART", () => {
  it.each(BOOK_COVER_ART.variants)("serves $src from the book-covers illustrations", (variant) => {
    expect(variant.src).toMatch(/^\/illustrations\/book-covers\/cover-\d\.png$/);
  });
});
