"use client";

import type { NoteMemorySource, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { assertNever } from "@/lib/assert-never";

type SourceBook = { seriesPosition: Nullable<number>; title: string };

export function NoteMemorySourceLabel({ source }: { source: NoteMemorySource }) {
  const t = useTranslations("notes.overview.source");

  switch (source.type) {
    case "book":
      return <SeriesBookSourceLabel book={source} />;
    case "series":
      return <SourceLine icon="layers" label={t("series")} />;
    default:
      return assertNever(source);
  }
}

export function SeriesBookSourceLabel({ book }: { book: SourceBook }) {
  const t = useTranslations("notes.overview.source");
  const label =
    book.seriesPosition === null
      ? book.title
      : t("seriesBook", { position: book.seriesPosition, title: book.title });

  return <SourceLine icon="book" label={label} />;
}

function SourceLine({ icon, label }: { icon: UiIconName; label: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <UiIcon aria-hidden className="shrink-0 text-icon" name={icon} size={13} />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </p>
  );
}
