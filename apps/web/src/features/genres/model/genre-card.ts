import type { GenreStatsView } from "@app/shared";

export type GenreCoverPreview =
  | { covers: string[]; hiddenBooksCount: number; kind: "covers" }
  | { hiddenBooksCount: number; kind: "placeholder" };

const GENRE_CARD = {
  coverPreviewLimit: 4,
  placeholderSlots: 1,
} as const;

export function genreCoverPreview({
  booksCount,
  coverUrls,
}: Pick<GenreStatsView, "booksCount" | "coverUrls">): GenreCoverPreview {
  const covers = coverUrls.slice(0, GENRE_CARD.coverPreviewLimit);

  if (covers.length === 0) {
    return {
      hiddenBooksCount: Math.max(0, booksCount - GENRE_CARD.placeholderSlots),
      kind: "placeholder",
    };
  }

  return { covers, hiddenBooksCount: Math.max(0, booksCount - covers.length), kind: "covers" };
}

export function genreReadProgressPercent({
  booksCount,
  readCount,
}: Pick<GenreStatsView, "booksCount" | "readCount">): number {
  return booksCount > 0 ? Math.round((readCount / booksCount) * 100) : 0;
}
