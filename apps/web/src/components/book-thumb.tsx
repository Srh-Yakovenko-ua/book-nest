import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";

type BookThumbBook = {
  cover?: Nullable<MediaView>;
  title: string;
};

export function BookThumb({ book }: { book: BookThumbBook }) {
  if (book.cover === null || book.cover === undefined) {
    return (
      <span
        className="grid h-12 w-9 shrink-0 place-items-center rounded-sm bg-accent text-icon"
        data-slot="book-thumb"
      >
        <UiIcon name="book" size={16} />
      </span>
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
