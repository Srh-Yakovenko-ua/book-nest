const BOOKS_ROOT = "/api/books";

export const wishlistKeys = {
  facets: [BOOKS_ROOT, "wishlist", "facets"] as const,
  root: [BOOKS_ROOT, "wishlist"] as const,
};
