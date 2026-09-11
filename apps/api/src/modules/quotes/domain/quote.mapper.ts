import type { MediaView, Nullable, QuoteView } from "@app/shared";

import type { QuoteWithBook } from "../infrastructure/quotes.repository.js";

export function toQuoteView({
  cover,
  quote,
}: {
  cover: Nullable<MediaView>;
  quote: QuoteWithBook;
}): QuoteView {
  return {
    book: {
      cover,
      firstAuthorName: quote.book.firstAuthorName,
      id: quote.book.id,
      title: quote.book.title,
    },
    bookId: quote.bookId,
    chapter: quote.chapter,
    comment: quote.comment,
    createdAt: quote.createdAt.toISOString(),
    id: quote.id,
    isFavorite: quote.isFavorite,
    isSpoiler: quote.isSpoiler,
    page: quote.page,
    text: quote.text,
    updatedAt: quote.updatedAt.toISOString(),
  };
}
