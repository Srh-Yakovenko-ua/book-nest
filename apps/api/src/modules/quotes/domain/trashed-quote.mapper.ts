import type { TrashedQuoteView } from "@app/shared";

import type { TrashedQuoteRow } from "../infrastructure/quotes.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedQuoteView(quote: TrashedQuoteRow): TrashedQuoteView {
  return {
    bookTitle: quote.book.title,
    deletedAt: quote.deletedAt.toISOString(),
    id: quote.id,
    purgeAt: TRASH_RETENTION.purgeAfter(quote.deletedAt).toISOString(),
    text: quote.text,
  };
}
