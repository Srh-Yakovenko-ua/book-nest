import type { AgeCategory, BookLanguage } from "@app/shared";

export { BOOK_GENRES_MAX } from "@app/shared";

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
