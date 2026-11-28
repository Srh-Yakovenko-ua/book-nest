import { createSerializer } from "nuqs";

import { LIBRARY_PUBLISHER_PRESENCE_MISSING, libraryQueryParsers } from "@/features/books";

export function buildMissingPublisherBooksHref() {
  return createSerializer(libraryQueryParsers)("/books", {
    publisherPresence: LIBRARY_PUBLISHER_PRESENCE_MISSING,
  });
}
