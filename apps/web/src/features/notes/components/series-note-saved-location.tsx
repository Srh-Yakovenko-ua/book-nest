"use client";

import { useTranslations } from "next-intl";

import type { NoteLocation } from "../model/note-location";

import { noteLocationLine } from "../model/note-location";

export function SeriesNoteSavedLocation({ location }: { location: NoteLocation }) {
  const t = useTranslations("notes");
  const line = noteLocationLine(location, (page) => t("card.page", { page }));

  if (line === null) return null;

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="text-muted-foreground">{t("fullView.savedLocation")}</p>
      <p className="wrap-anywhere whitespace-pre-line text-foreground">{line}</p>
    </div>
  );
}
