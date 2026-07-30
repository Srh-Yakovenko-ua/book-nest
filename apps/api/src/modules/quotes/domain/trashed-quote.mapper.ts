import type { TrashedQuoteView } from "@app/shared";

import type { TrashedQuoteRow } from "../infrastructure/quotes.repository.js";

export function toTrashedQuoteView(quote: TrashedQuoteRow): TrashedQuoteView {
  return {
    bookTitle: quote.book.title,
    deletedAt: quote.deletedAt.toISOString(),
    id: quote.id,
    purgeAt: quote.purgeAt.toISOString(),
    text: quote.text,
  };
}
