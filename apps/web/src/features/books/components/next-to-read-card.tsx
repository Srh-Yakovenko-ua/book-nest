"use client";

import type { ReadingQueueItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";

import type { LibraryBook, LibraryBookLabels } from "../model/library-book";

import { toLibraryBook } from "../model/library-book";

type NextToReadCardProps = {
  item: null | ReadingQueueItemView;
  labels: LibraryBookLabels;
  onStartReading: () => void;
};

export function NextToReadCard({ item, labels, onStartReading }: NextToReadCardProps) {
  const t = useTranslations("readingQueue.nextToRead");

  return (
    <Card className="gap-3 p-4">
      <h2 className="font-heading text-sm font-semibold text-ink">{t("title")}</h2>
      {item === null ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <NextBook
          book={toLibraryBook(item.book, labels)}
          onStartReading={onStartReading}
          startLabel={t("startReading")}
        />
      )}
    </Card>
  );
}

function NextBook({
  book,
  onStartReading,
  startLabel,
}: {
  book: LibraryBook;
  onStartReading: () => void;
  startLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <NextBookCover alt={book.cover?.alt ?? book.title} src={book.cover?.src} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
            <Link
              className="text-ink no-underline transition-colors hover:text-primary"
              href={book.href}
            >
              {book.title}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge entry={book.status} />
          </div>
          {book.pagesText === undefined ? null : (
            <p className="text-xs text-muted-foreground tabular-nums">{book.pagesText}</p>
          )}
        </div>
      </div>
      <Button className="w-full" onClick={onStartReading}>
        {startLabel}
      </Button>
    </div>
  );
}

function NextBookCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-16 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={22} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="64px" src={src} unoptimized />
    </div>
  );
}
