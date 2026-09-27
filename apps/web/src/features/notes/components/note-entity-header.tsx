"use client";

import { assertNever } from "@/lib/assert-never";

import type { NoteEntityRef } from "../model/note-entity";
import type { NoteEntityPlacement } from "./note-entity-placement";

import { BookNoteEntityHeader } from "./book-note-entity-header";
import { SeriesNoteEntityHeader } from "./series-note-entity-header";

type NoteEntityHeaderProps = {
  entity: NoteEntityRef;
  placement: NoteEntityPlacement;
};

export function NoteEntityHeader({ entity, placement }: NoteEntityHeaderProps) {
  switch (entity.type) {
    case "book":
      return <BookNoteEntityHeader book={entity.book} placement={placement} />;
    case "series":
      return <SeriesNoteEntityHeader placement={placement} series={entity.series} />;
    default:
      return assertNever(entity);
  }
}
