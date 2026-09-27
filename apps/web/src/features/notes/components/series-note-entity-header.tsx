"use client";

import type { NoteSeriesPreview } from "@app/shared";

import { useTranslations } from "next-intl";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { noteEntityHref } from "../model/note-entity";
import { NoteEntityHeaderShell } from "./note-entity-header-shell";
import { NOTE_ENTITY_PLACEMENT } from "./note-entity-placement";

type SeriesNoteEntityHeaderProps = {
  placement: NoteEntityPlacement;
  series: NoteSeriesPreview;
};

export function SeriesNoteEntityHeader({ placement, series }: SeriesNoteEntityHeaderProps) {
  const t = useTranslations("notes.entity");
  const authors = series.authors.length > 0 ? series.authors.join(", ") : t("authorsUnknown");

  return (
    <NoteEntityHeaderShell
      cover={series.cover}
      coverAlt={t("seriesCoverAlt", { name: series.name })}
      href={noteEntityHref({ series, type: "series" })}
      icon="layers"
      meta={
        <>
          <span className={NOTE_ENTITY_PLACEMENT[placement].metaLine}>{authors}</span>
          <span>{t("books", { count: series.booksCount })}</span>
        </>
      }
      placement={placement}
      title={series.name}
    />
  );
}
