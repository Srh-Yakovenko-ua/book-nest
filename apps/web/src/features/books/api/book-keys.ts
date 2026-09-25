import type { QueryKey } from "@tanstack/react-query";

import type { BooksControllerQuickCountsParams } from "@/shared/api/generated/model";

export const BOOKS_ROOT = "/api/books";

export const bookKeys = {
  deliveryHistory: (id: string) => [...bookKeys.detail(id), "deliveries"] as const,
  detail: (id: string) => [BOOKS_ROOT, "detail", id] as const,
  quickCounts: (params: BooksControllerQuickCountsParams) =>
    [BOOKS_ROOT, "quick-counts", params] as const,
  root: [BOOKS_ROOT] as const,
};

export function matchesBooksExceptDetail(id: string) {
  return (query: { queryKey: QueryKey }) =>
    isBooksKey(query.queryKey) && !isBookDetailKey(query.queryKey, id);
}

function isBookDetailKey(key: QueryKey, id: string): boolean {
  return (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === BOOKS_ROOT &&
    key[1] === "detail" &&
    key[2] === id
  );
}

function isBooksKey(key: QueryKey): boolean {
  return Array.isArray(key) && key[0] === BOOKS_ROOT;
}
