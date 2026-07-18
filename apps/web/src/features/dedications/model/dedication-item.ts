import type { BookView } from "@app/shared";

export function authorNamesOf(book: BookView): string {
  return book.authors.map((author) => author.name).join(", ");
}

export function dedicationTextOf(book: BookView): string {
  return book.dedication?.trim() ?? "";
}
