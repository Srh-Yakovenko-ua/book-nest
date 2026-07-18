import type { QuotesQuery } from "@app/shared";

const QUOTES_ROOT = "/api/quotes";

export const quoteKeys = {
  forBook: (bookId: string) => [QUOTES_ROOT, "book", bookId] as const,
  list: (params: QuotesQuery) => [QUOTES_ROOT, "list", params] as const,
  root: [QUOTES_ROOT] as const,
  summary: [QUOTES_ROOT, "summary"] as const,
};
