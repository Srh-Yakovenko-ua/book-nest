import type { MediaView, Nullable, TrashedBookView } from "@app/shared";

import type { TrashedBookRow } from "../infrastructure/books.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedBookView({
  book,
  cover,
}: {
  book: TrashedBookRow;
  cover: Nullable<MediaView>;
}): TrashedBookView {
  return {
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    cover,
    deletedAt: book.deletedAt.toISOString(),
    id: book.id,
    purgeAt: TRASH_RETENTION.purgeAfter(book.deletedAt).toISOString(),
    seriesTitle: book.series?.name ?? null,
    title: book.title,
  };
}
