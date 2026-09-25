import type {
  BooksControllerDedicationsParams,
  BooksControllerDedicationsQuickCountsParams,
} from "@/shared/api/generated/model";

import { BOOKS_ROOT } from "@/features/books/api/book-keys";

const DEDICATIONS_ROOT = [BOOKS_ROOT, "dedications"] as const;

export const dedicationKeys = {
  list: (params: BooksControllerDedicationsParams) =>
    [...dedicationKeys.root, "list", params] as const,
  quickCounts: (params: BooksControllerDedicationsQuickCountsParams) =>
    [...dedicationKeys.root, "quick-counts", params] as const,
  root: DEDICATIONS_ROOT,
  summary: [...DEDICATIONS_ROOT, "summary"] as const,
};
