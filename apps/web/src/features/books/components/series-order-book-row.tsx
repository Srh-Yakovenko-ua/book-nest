"use client";

import type { SeriesOrderBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";

type SeriesOrderBookRowProps = {
  book: SeriesOrderBookView;
  label?: string;
};

export function SeriesOrderBookRow({ book, label }: SeriesOrderBookRowProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");

  return (
    <div className="flex gap-2.5">
      <BookCover book={book} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {label === undefined ? null : <p className="text-xs text-muted-foreground">{label}</p>}
        <MobilePageOverviewLink
          className="line-clamp-2 text-sm leading-tight font-medium text-ink underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
          href={`/books/${book.id}`}
        >
          {book.title}
        </MobilePageOverviewLink>
        <p className="text-xs text-muted-foreground">{metaText(book, t)}</p>
      </div>
    </div>
  );
}

function BookCover({ book }: { book: SeriesOrderBookView }) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");
  const alt = t("coverAlt", { title: book.title });

  if (book.cover === null) {
    return (
      <BookCoverFallback
        alt={alt}
        className="aspect-3/4 w-9 rounded-sm"
        seed={book.id}
        sizes="36px"
      />
    );
  }

  return (
    <div className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image
        alt={alt}
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
