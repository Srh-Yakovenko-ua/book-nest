const BOOKS_ROOT = "/api/books";

export const storeLinkKeys = {
  forBook: (bookId: string) => [BOOKS_ROOT, "detail", bookId, "store-links"] as const,
};
