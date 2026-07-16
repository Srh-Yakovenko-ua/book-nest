"use client";

import type { SeriesOrderBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

type SeriesOrderBookRowProps = {
  book: SeriesOrderBookView;
  label: string;
};

export function SeriesOrderBookRow({ book, label }: SeriesOrderBookRowProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");

  return (
    <div className="flex gap-2.5">
      <BookCover book={book} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Link
          className="line-clamp-2 text-sm leading-tight font-medium text-ink no-underline transition-colors hover:text-primary"
          href={`/books/${book.id}`}
        >
          {book.title}
        </Link>
        <p className="text-xs text-muted-foreground">{metaText(book, t)}</p>
      </div>
    </div>
  );
}

function BookCover({ book }: { book: SeriesOrderBookView }) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");

  if (book.cover === null) {
    return (
      <div className="grid aspect-[3/4] w-9 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={14} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image
        alt={t("coverAlt", { title: book.title })}
        className="object-cover"
        fill
        sizes="36px"
        src={book.cover.urls.thumb}
        unoptimized
      />
    </div>
  );
}

function metaText(
  book: SeriesOrderBookView,
  t: ReturnType<typeof useTranslations<"readingQueue.seriesOrderCheck.card">>,
): string {
  const parts = [
    book.seriesPosition === null
      ? t("seriesPositionUnknown")
      : t("seriesPosition", { position: book.seriesPosition }),
  ];

  if (book.isCurrentReading) parts.push(t("currentReading"));
  else if (book.queuePosition === null) parts.push(t("notInQueue"));
  else parts.push(t("queuePosition", { position: book.queuePosition }));

  return parts.join(" · ");
}
