"use client";

import type { BookView } from "@app/shared";

import { BookDetailsAbout } from "./book-details-about";
import { BookDetailsEdition } from "./book-details-edition";
import { BookDetailsHero } from "./book-details-hero";
import { BookDetailsSidebar } from "./book-details-sidebar";

type BookDetailsViewProps = {
  book: BookView;
};

export function BookDetailsView({ book }: BookDetailsViewProps) {
  return (
    <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <BookDetailsHero book={book} />
        <BookDetailsAbout book={book} />
        <BookDetailsEdition book={book} />
      </div>

      <BookDetailsSidebar book={book} />
    </div>
  );
}
