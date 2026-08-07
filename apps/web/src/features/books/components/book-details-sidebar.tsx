"use client";

import type { BookView } from "@app/shared";

import { shouldShowReadingQueue } from "../model/reading-queue-visibility";
import { QuickInfoCard, StatusesCard } from "./book-details-key-facts";
import { BookListsBlock } from "./book-lists-block";
import { DeliveryBlock } from "./delivery-block";
import { OwnershipBlock } from "./ownership-block";
import { ReadingQueueBlock } from "./reading-queue-block";

type BookDetailsSidebarProps = {
  book: BookView;
};

export function BookDetailsSidebar({ book }: BookDetailsSidebarProps) {
  return (
    <aside className="details-sidebar-leaf flex flex-col gap-6">
      <QuickInfoCard book={book} className="hidden lg:flex" />

      <OwnershipBlock book={book} />

      <StatusesCard book={book} className="hidden lg:flex" />

      {shouldShowReadingQueue(book.readingStatus) ? <ReadingQueueBlock book={book} /> : null}

      <BookListsBlock book={book} />

      <DeliveryBlock book={book} />
    </aside>
  );
}
