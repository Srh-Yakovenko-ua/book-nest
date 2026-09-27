"use client";

import type { NoteBookPreview } from "@app/shared";

import { useTranslations } from "next-intl";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { noteEntityHref } from "../model/note-entity";
import { NoteEntityHeaderShell } from "./note-entity-header-shell";
import { NOTE_ENTITY_PLACEMENT } from "./note-entity-placement";

type BookNoteEntityHeaderProps = {
  book: NoteBookPreview;
  placement: NoteEntityPlacement;
};

export function BookNoteEntityHeader({ book, placement }: BookNoteEntityHeaderProps) {
  const t = useTranslations("notes.entity");
  const author = book.author ?? t("authorsUnknown");

  return (
    <NoteEntityHeaderShell
      cover={book.cover}
      coverAlt={t("bookCoverAlt", { title: book.title })}
      href={noteEntityHref({ book, type: "book" })}
      icon="book"
      meta={<span className={NOTE_ENTITY_PLACEMENT[placement].metaLine}>{author}</span>}
      placement={placement}
      title={book.title}
    />
  );
}
