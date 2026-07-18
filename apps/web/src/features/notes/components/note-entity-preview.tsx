"use client";

import type { NoteBookPreview, NoteSeriesPreview, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";

import type { NoteEntityRef } from "../model/note-entity";

type NoteEntityPreviewProps = {
  entity: NoteEntityRef;
};

export function NoteEntityPreview({ entity }: NoteEntityPreviewProps) {
  switch (entity.type) {
    case "book":
      return <BookPreview book={entity.book} />;
    case "series":
      return <SeriesPreview series={entity.series} />;
    default:
      return assertNever(entity);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled note entity preview: ${String(value)}`);
}

function BookPreview({ book }: { book: NoteBookPreview }) {
  const t = useTranslations("notes.entity");

  return (
    <PreviewShell
      alt={t("bookCoverAlt", { title: book.title })}
      icon="book"
      src={book.cover?.urls.thumb ?? null}
      title={book.title}
    >
      <span className="truncate text-xs text-muted-foreground">
        {book.author ?? t("authorsUnknown")}
      </span>
    </PreviewShell>
  );
}

function PreviewShell({
  alt,
  children,
  icon,
  src,
  title,
}: {
  alt: string;
  children: React.ReactNode;
  icon: UiIconName;
  src: Nullable<string>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-2.5">
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-accent">
        {src === null ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/60">
            <UiIcon name={icon} size={18} />
          </span>
        ) : (
          <Image alt={alt} className="object-cover" fill sizes="40px" src={src} unoptimized />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        {children}
      </div>
    </div>
  );
}

function SeriesPreview({ series }: { series: NoteSeriesPreview }) {
  const t = useTranslations("notes.entity");
  const authors = series.authors.length > 0 ? series.authors.join(", ") : t("authorsUnknown");

  return (
    <PreviewShell
      alt={t("seriesCoverAlt", { name: series.name })}
      icon="layers"
      src={series.cover?.urls.thumb ?? null}
      title={series.name}
    >
      <span className="truncate text-xs text-muted-foreground">
        {t("typeSeries")} · {authors}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("books", { count: series.booksCount })}
      </span>
    </PreviewShell>
  );
}
