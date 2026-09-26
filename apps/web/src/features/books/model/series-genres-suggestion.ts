import type { Nullable } from "@app/shared";

import { BOOK_GENRES_MAX } from "@app/shared";

import type { SeriesSelection } from "./create-book-form";

export type SeriesGenresHint = {
  seriesName: string;
  source: SeriesGenresSource;
};

export type SeriesGenresSource = "books" | "series";

export type SeriesGenresSuggestion =
  { genres: string[]; kind: "apply"; source: SeriesGenresSource } | { kind: "none" };

const NO_SUGGESTION: SeriesGenresSuggestion = { kind: "none" };

export function resolveSeriesGenresSuggestion(
  seriesSelection: Nullable<SeriesSelection>,
): SeriesGenresSuggestion {
  if (seriesSelection === null) return NO_SUGGESTION;

  if (seriesSelection.kind === "new") return applyGenres(seriesSelection.draft.genres, "series");

  if (seriesSelection.genres.length > 0) return applyGenres(seriesSelection.genres, "series");

  return applyGenres(seriesSelection.commonGenres, "books");
}

function applyGenres(genres: string[], source: SeriesGenresSource): SeriesGenresSuggestion {
  if (genres.length === 0) return NO_SUGGESTION;
  return { genres: genres.slice(0, BOOK_GENRES_MAX), kind: "apply", source };
}
