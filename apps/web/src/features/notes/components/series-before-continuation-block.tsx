"use client";

import type {
  ReadingStatus,
  SeriesBeforeNextBookNote,
  SeriesBeforeNextBookView,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";

import type { OpenNoteFullView } from "../hooks/use-note-full-view";

import { assertNever } from "../model/assert-never";
import { noteCategoryLabel } from "../model/note-category-label";
import { noteEntityHref } from "../model/note-entity";
import { notesArchiveHref } from "../model/notes-archive-href";
import { NOTE_CARD_LAYOUT } from "./note-card-layout";
import { NoteEntityCover } from "./note-entity-cover";
import { NoteEntityLocation } from "./note-entity-location";
import { NotePreview } from "./note-preview";
import { SeriesBookSourceLabel } from "./note-source-label";
import { NoteSpoilerGate } from "./note-spoiler-gate";

type ContinuationState = keyof typeof CONTINUATION_STATES;

type SeriesBeforeContinuationBlockProps = {
  beforeNextBook: SeriesBeforeNextBookView;
  onOpenNote: OpenNoteFullView;
};

const CONTINUATION_STATES = {
  notStarted: { icon: "arrow-right" },
  paused: { icon: "clock" },
  reading: { icon: "book-open-text" },
  rereading: { icon: "refresh" },
} as const satisfies Record<string, { icon: UiIconName }>;

export function SeriesBeforeContinuationBlock({
  beforeNextBook,
  onOpenNote,
}: SeriesBeforeContinuationBlockProps) {
  const t = useTranslations("notes.overview.beforeContinuation");
  const tEntity = useTranslations("notes.entity");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const titleId = useId();
  const recapTitleId = useId();

  const { continuation, notes, series, totalCount } = beforeNextBook;
  const state = continuationState(continuation.readingStatus);
  const bookHref = noteEntityHref({
    book: {
      author: null,
      cover: continuation.cover,
      id: continuation.id,
      title: continuation.title,
    },
    type: "book",
  });
  const authors = continuation.authors.map(({ name }) => name).join(", ");
  const position =
    continuation.seriesPosition === null
      ? series.title
      : t("position", { position: continuation.seriesPosition, series: series.title });

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex flex-col gap-0.5">
        <h2
          className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink"
          id={titleId}
        >
          <UiIcon aria-hidden className="text-primary" name="layers" size={16} />
          {t("title")}
        </h2>
        <p className="text-xs wrap-anywhere text-muted-foreground">
          {t(`subtitle.${state}`, { title: continuation.title })}
        </p>
      </div>

      <div className="flex min-w-0 items-start gap-3">
        <NoteEntityCover
          alt={tEntity("bookCoverAlt", { title: continuation.title })}
          cover={continuation.cover}
          href={bookHref}
          icon="book"
          placement="card"
        />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Badge variant="secondary">
            <UiIcon aria-hidden name={CONTINUATION_STATES[state].icon} size={12} />
            {t(`status.${state}`)}
          </Badge>
          <p className="line-clamp-2 font-heading text-sm leading-snug font-semibold wrap-anywhere text-ink">
            {continuation.title}
          </p>
          <p className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
            {authors.length === 0 ? tEntity("authorsUnknown") : authors}
          </p>
          <p className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">{position}</p>
          {continuation.progress === null ? null : (
            <p className="text-xs text-muted-foreground tabular-nums">
              {progressLabel(continuation.progress, t)}
            </p>
          )}
          {continuation.ownershipStatus === "none" ? null : (
            <p className="text-xs text-muted-foreground">
              {tOwnership(continuation.ownershipStatus)}
            </p>
          )}
        </div>
      </div>

      <Button asChild className="justify-between" variant="secondary">
        <MobilePageOverviewLink href={bookHref}>
          {t(`cta.${state}`)}
          <UiIcon aria-hidden name="chevron-right" size={16} />
        </MobilePageOverviewLink>
      </Button>

      <div aria-labelledby={recapTitleId} className="flex flex-col gap-2" role="group">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-sm font-semibold text-ink" id={recapTitleId}>
            {t("recapTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("recapSubtitle")}</p>
        </div>

        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <BeforeContinuationNote key={note.id} note={note} onOpenNote={onOpenNote} />
          ))}
        </ul>
      </div>

      {totalCount > notes.length ? (
        <Button asChild className="justify-between" variant="ghost">
          <MobilePageOverviewLink href={notesArchiveHref("series", series.id)}>
            {t("viewAll")}
            <UiIcon aria-hidden name="arrow-right" size={16} />
          </MobilePageOverviewLink>
        </Button>
      ) : null}
    </section>
  );
}

function BeforeContinuationNote({
  note,
  onOpenNote,
}: {
  note: SeriesBeforeNextBookNote;
  onOpenNote: OpenNoteFullView;
}) {
  const tCategories = useTranslations("notes.categories");
  const category = noteCategoryLabel(note, (value) => tCategories(value));
  const openNote = (trigger: HTMLButtonElement) => onOpenNote(note, trigger);

  return (
    <li className={NOTE_CARD_LAYOUT.compact.shell}>
      <SeriesBookSourceLabel book={note.sourceBook} />

      {category === null ? null : (
        <Badge
          className="block max-w-full min-w-0 self-start truncate"
          title={category}
          variant="secondary"
        >
          {category}
        </Badge>
      )}

      {note.isSpoiler ? (
        <NoteSpoilerGate entityType={note.entityType} layout="compact" onOpen={openNote} />
      ) : (
        <NotePreview card={null} layout="compact" onExpand={openNote} text={note.text} />
      )}

      <NoteEntityLocation note={note} placement="card" />
    </li>
  );
}

function continuationState(readingStatus: ReadingStatus): ContinuationState {
  switch (readingStatus) {
    case "dnf":
    case "finished":
    case "not_started":
    case "want_to_read":
      return "notStarted";
    case "paused":
      return "paused";
    case "reading":
      return "reading";
    case "rereading":
      return "rereading";
    default:
      return assertNever(readingStatus);
  }
}

function progressLabel(
  progress: NonNullable<SeriesBeforeNextBookView["continuation"]["progress"]>,
  t: ReturnType<typeof useTranslations<"notes.overview.beforeContinuation">>,
): string {
  if (progress.percentage !== null) {
    return t("progress.percent", { percentage: progress.percentage });
  }
  if (progress.totalPages !== null) {
    return t("progress.pagesOf", { current: progress.currentPage, total: progress.totalPages });
  }
  return t("progress.page", { current: progress.currentPage });
}
