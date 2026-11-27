import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";

type BookThumbBook = {
  cover?: Nullable<MediaView>;
  id: string;
  title: string;
};

export function BookThumb({ book }: { book: BookThumbBook }) {
  if (book.cover === null || book.cover === undefined) {
    return (
      <BookCoverFallback
        className="h-12 w-9 rounded-sm"
        data-slot="book-thumb"
        seed={book.id}
        sizes="2.25rem"
      />
    );
  }

  return (
    <Image
      alt=""
      className="h-12 w-9 shrink-0 rounded-sm object-cover"
      data-slot="book-thumb"
      height={48}
      src={book.cover.urls.thumb}
      unoptimized
      width={36}
    />
  );
}
