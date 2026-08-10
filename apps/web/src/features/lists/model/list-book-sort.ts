import { ListDetailsControllerDetailSort } from "@/shared/api/generated/model";

export const LIST_BOOK_SORT_OPTIONS = [
  ListDetailsControllerDetailSort.position,
  ListDetailsControllerDetailSort.added_desc,
  ListDetailsControllerDetailSort.added_asc,
  ListDetailsControllerDetailSort.title_asc,
  ListDetailsControllerDetailSort.title_desc,
  ListDetailsControllerDetailSort.author_asc,
  ListDetailsControllerDetailSort.author_desc,
  ListDetailsControllerDetailSort.status_unread_first,
  ListDetailsControllerDetailSort.status_read_first,
  ListDetailsControllerDetailSort.rating_desc,
  ListDetailsControllerDetailSort.rating_asc,
  ListDetailsControllerDetailSort.pages_desc,
  ListDetailsControllerDetailSort.pages_asc,
] as const satisfies readonly ListDetailsControllerDetailSort[];

export const LIST_BOOK_SORT_DEFAULT = ListDetailsControllerDetailSort.position;

export type ListBookSortOption = (typeof LIST_BOOK_SORT_OPTIONS)[number];
