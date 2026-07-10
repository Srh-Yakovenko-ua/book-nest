import type { ListBookSort } from "@app/shared";

export const LIST_BOOK_SORT_OPTIONS = [
  "position",
  "added_desc",
  "added_asc",
  "title_asc",
  "title_desc",
  "author_asc",
  "rating_desc",
  "pages_desc",
  "pages_asc",
] as const satisfies readonly ListBookSort[];

export const LIST_BOOK_SORT_DEFAULT: ListBookSort = "position";
