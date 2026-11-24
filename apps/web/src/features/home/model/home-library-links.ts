import { createSerializer } from "nuqs";

import { libraryQueryParsers } from "@/features/books";

import type { HomeLibraryCountKey } from "./home-summary";

const serializeLibrary = createSerializer(libraryQueryParsers);

const HOME_LIBRARY_ROUTES = {
  addBook: "/books/new",
  catalogue: "/books",
  favorites: "/favorites",
} as const;

export const HOME_LIBRARY_LINKS = {
  addBook: HOME_LIBRARY_ROUTES.addBook,
  counts: {
    favorites: HOME_LIBRARY_ROUTES.favorites,
    finished: serializeLibrary(HOME_LIBRARY_ROUTES.catalogue, { status: ["finished"] }),
    reading: serializeLibrary(HOME_LIBRARY_ROUTES.catalogue, { status: ["reading", "rereading"] }),
    total: HOME_LIBRARY_ROUTES.catalogue,
  } satisfies Record<HomeLibraryCountKey, string>,
  newestBooks: serializeLibrary(HOME_LIBRARY_ROUTES.catalogue, { sort: "created_desc" }),
} as const;

export function homeBookHref(bookId: string): string {
  return `${HOME_LIBRARY_ROUTES.catalogue}/${bookId}`;
}
