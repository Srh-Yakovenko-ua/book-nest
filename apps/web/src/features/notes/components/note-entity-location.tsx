"use client";

import type { NoteView } from "@app/shared";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { assertNever } from "../model/assert-never";
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
