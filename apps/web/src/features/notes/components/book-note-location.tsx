"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import type { NoteLocation } from "../model/note-location";
import type { NoteEntityPlacement } from "./note-entity-placement";

type BookNoteLocationProps = {
  location: NoteLocation;
  placement: NoteEntityPlacement;
};

export function BookNoteLocation({ location, placement }: BookNoteLocationProps) {
  const t = useTranslations("notes");
  const chapter = location.chapter?.trim() ?? "";
  const { page } = location;

  if (chapter.length === 0 && page === null) return null;

  if (placement === "fullView") {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {chapter.length === 0 ? null : (
          <>
            <dt className="text-muted-foreground">{t("fullView.chapter")}</dt>
            <dd className="wrap-anywhere whitespace-pre-line text-foreground">{chapter}</dd>
          </>
        )}
        {page === null ? null : (
          <>
            <dt className="text-muted-foreground">{t("fullView.page")}</dt>
            <dd className="text-foreground tabular-nums">{page}</dd>
          </>
        )}
      </dl>
    );
  }

  return (
    <p className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <UiIcon className="text-icon" name="book" size={13} />
      {chapter.length === 0 ? null : (
        <span className="min-w-0 truncate" title={chapter}>
          {chapter}
        </span>
      )}
      {chapter.length === 0 || page === null ? null : <span aria-hidden>·</span>}
      {page === null ? null : (
        <span className="shrink-0 whitespace-nowrap tabular-nums">{t("card.page", { page })}</span>
      )}
    </p>
  );
}
