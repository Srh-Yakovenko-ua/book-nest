"use client";

import type { NoteMemoryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";

import type { OpenNoteFullView } from "../hooks/use-note-full-view";
import type { RecordNoteImpression } from "../hooks/use-note-rediscovery-impression";

import { useRecordImpressionWhenVisible } from "../hooks/use-note-rediscovery-impression";
import { noteCategoryLabel } from "../model/note-category-label";
import { NoteEntityLocation } from "./note-entity-location";

type NoteMemoryCardProps = {
  ctaLabel: string;
  memory: NoteMemoryView;
  onOpenNote: OpenNoteFullView;
  recordImpression: RecordNoteImpression;
  source: ReactNode;
};

const MEMORY_SIGNAL_ICONS = {
  favorite: "heart-fill",
  pinned: "bookmark",
} as const satisfies Record<string, UiIconName>;

export function NoteMemoryCard({
  ctaLabel,
  memory,
  onOpenNote,
  recordImpression,
  source,
}: NoteMemoryCardProps) {
  const t = useTranslations("notes.overview.memory");
  const tCategories = useTranslations("notes.categories");
  const locale = useLocale();
  const titleId = useId();
  const cardRef = useRecordImpressionWhenVisible<HTMLElement>({
    impressionKey: memory.impressionKey,
    recordImpression,
  });

  const { note } = memory;
  const category = noteCategoryLabel(note, (value) => tCategories(value));
  const signals = [
    note.isFavorite ? { icon: MEMORY_SIGNAL_ICONS.favorite, label: t("favorite") } : null,
    note.isPinned ? { icon: MEMORY_SIGNAL_ICONS.pinned, label: t("pinned") } : null,
  ].filter((signal) => signal !== null);

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
      ref={cardRef}
    >
      <h2
        className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink"
        id={titleId}
      >
        <UiIcon aria-hidden className="text-primary" name="sparkles" size={16} />
        {t("title")}
      </h2>

      {source}

      <p className="line-clamp-4 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
        {note.text}
      </p>

      {category === null ? null : (
        <Badge
          className="block max-w-full min-w-0 self-start truncate"
          title={category}
          variant="secondary"
        >
          {category}
        </Badge>
      )}

      <NoteEntityLocation note={note} placement="card" />

      {signals.length === 0 ? null : (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {signals.map((signal, index) => (
            <Fragment key={signal.label}>
              {index === 0 ? null : <span aria-hidden="true">·</span>}
              <span className="flex items-center gap-1">
                <UiIcon aria-hidden className="text-icon" name={signal.icon} size={13} />
                {signal.label}
              </span>
            </Fragment>
          ))}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t("savedAge", { age: formatRelativeTime(note.createdAt, locale) })}
      </p>

      <Button
        className="justify-between"
        onClick={(event) => onOpenNote(note, event.currentTarget)}
        variant="secondary"
      >
        {ctaLabel}
        <UiIcon aria-hidden name="chevron-right" size={16} />
      </Button>
    </section>
  );
}
