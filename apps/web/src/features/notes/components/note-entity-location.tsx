"use client";

import type { NoteView } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { BookNoteLocation } from "./book-note-location";
import { SeriesNoteSavedLocation } from "./series-note-saved-location";

type NoteEntityLocationProps = {
  note: NoteView;
  placement: NoteEntityPlacement;
};

export function NoteEntityLocation({ note, placement }: NoteEntityLocationProps) {
  switch (note.entityType) {
    case "book":
      return <BookNoteLocation location={note} placement={placement} />;
    case "series":
      return placement === "fullView" ? <SeriesNoteSavedLocation location={note} /> : null;
    default:
      return assertNever(note.entityType);
  }
}
