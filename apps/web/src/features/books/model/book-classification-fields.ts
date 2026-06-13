import type { AgeCategory, BookGenre, BookLanguage, SeriesStatus } from "@app/shared";

export const BOOK_GENRE_OPTIONS = [
  "fantasy",
  "science_fiction",
  "dystopia",
  "romance",
  "thriller",
  "mystery",
  "detective",
  "horror",
  "historical_fiction",
  "literary_fiction",
  "contemporary",
  "young_adult",
  "childrens",
  "classics",
  "poetry",
  "drama",
  "short_stories",
  "nonfiction",
  "biography",
  "memoir",
  "self_help",
  "psychology",
  "philosophy",
  "history",
  "science",
  "business",
  "true_crime",
  "comics",
  "other",
] as const satisfies readonly BookGenre[];

export const AGE_CATEGORY_OPTIONS = [
  "not_specified",
  "no_restrictions",
  "6_plus",
  "12_plus",
  "14_plus",
  "16_plus",
  "18_plus",
] as const satisfies readonly AgeCategory[];

export const BOOK_LANGUAGE_OPTIONS = [
  "ukrainian",
  "english",
  "polish",
  "german",
  "french",
  "spanish",
  "other",
] as const satisfies readonly BookLanguage[];

export const SERIES_STATUS_OPTIONS = [
  "unknown",
  "ongoing",
  "completed",
] as const satisfies readonly SeriesStatus[];

export const BOOK_GENRES_MAX = 5;

export function isBookGenre(value: string): value is BookGenre {
  return (BOOK_GENRE_OPTIONS as readonly string[]).includes(value);
}
