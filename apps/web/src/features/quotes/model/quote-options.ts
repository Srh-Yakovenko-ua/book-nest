import type { QuoteFilter, QuoteSort } from "@app/shared";

export const QUOTE_FILTER_OPTIONS = [
  "all",
  "no_spoiler",
  "with_spoiler",
  "favorites",
  "with_comment",
  "without_comment",
] as const satisfies readonly QuoteFilter[];

export const QUOTE_SORT_OPTIONS = [
  "newest",
  "oldest",
  "book_title",
  "book_author",
  "page",
  "favorites_first",
  "no_spoiler_first",
  "with_spoiler_first",
] as const satisfies readonly QuoteSort[];
