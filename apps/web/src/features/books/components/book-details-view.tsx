"use client";

import type { BookView } from "@app/shared";

import { BookDetailsAbout } from "./book-details-about";
import { BookDetailsClassification } from "./book-details-classification";
import { BookDetailsEdition } from "./book-details-edition";
import { BookDetailsHero } from "./book-details-hero";
import { BookDetailsSidebar } from "./book-details-sidebar";

type BookDetailsViewProps = {
  book: BookView;
};

export function BookDetailsView({ book }: BookDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <BookDetailsHero book={book} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <BookDetailsAbout book={book} />
          <BookDetailsClassification book={book} />
          <BookDetailsEdition book={book} />
        </div>

        <BookDetailsSidebar book={book} />
      </div>
    </div>
  );
}
