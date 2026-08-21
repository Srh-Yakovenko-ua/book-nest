import type { LoanListItemView } from "@app/shared";

import type { BookRowBook } from "@/features/books/model/library-book";

export function toLoanRowBook(loan: LoanListItemView): BookRowBook {
  const { book } = loan;

  return {
    authors: book.firstAuthorName === "" ? [] : [book.firstAuthorName],
    cover: book.cover === null ? undefined : { alt: book.title, src: book.cover.urls.card },
    href: `/books/${book.id}`,
    id: book.id,
    originalTitle: book.originalTitle ?? undefined,
    ownershipStatus: book.ownershipStatus,
    title: book.title,
  };
}
