type BookCoverArtVariant = {
  src: string;
  titleTone: BookCoverTitleTone;
};

type BookCoverTitleTone = "ink" | "paper";

export const BOOK_COVER_ART = {
  height: 1024,
  variants: [
    { src: "/illustrations/book-covers/cover-1.png", titleTone: "paper" },
    { src: "/illustrations/book-covers/cover-2.png", titleTone: "ink" },
    { src: "/illustrations/book-covers/cover-3.png", titleTone: "paper" },
    { src: "/illustrations/book-covers/cover-4.png", titleTone: "ink" },
    { src: "/illustrations/book-covers/cover-5.png", titleTone: "ink" },
    { src: "/illustrations/book-covers/cover-6.png", titleTone: "paper" },
  ],
  width: 768,
} as const satisfies {
  height: number;
  variants: readonly BookCoverArtVariant[];
  width: number;
};

const FNV_1A = { offsetBasis: 0x811c9dc5, prime: 0x01000193 } as const;

export function pickBookCoverArt(seed: string): BookCoverArtVariant {
  const variants: readonly BookCoverArtVariant[] = BOOK_COVER_ART.variants;
  return variants[hashSeed(seed) % variants.length] ?? BOOK_COVER_ART.variants[0];
}

function hashSeed(seed: string): number {
  let hash: number = FNV_1A.offsetBasis;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_1A.prime);
  }
  return hash >>> 0;
}
