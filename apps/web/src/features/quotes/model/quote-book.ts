import type { BookView, MediaView, Nullable } from "@app/shared";

export type QuoteBookOption = {
  authorName: string;
  cover: Nullable<MediaView>;
  id: string;
  title: string;
};

export function toQuoteBookOption(book: BookView): QuoteBookOption {
  return {
    authorName: book.authors[0]?.name ?? "",
    cover: book.cover ?? null,
    id: book.id,
    title: book.title,
  };
}
