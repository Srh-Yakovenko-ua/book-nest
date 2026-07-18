import type {
  NoteBookPreview,
  NoteEntityType,
  NoteSeriesPreview,
  NoteView,
  Nullable,
} from "@app/shared";

export type NoteEntityRef =
  | NoteEntityRefOf<"book", { book: NoteBookPreview }>
  | NoteEntityRefOf<"series", { series: NoteSeriesPreview }>;

type NoteEntityRefOf<TType extends NoteEntityType, TPayload> = TPayload & { type: TType };

const NOTE_ENTITY_SECTIONS = {
  book: "/books",
  series: "/series",
} as const satisfies Record<NoteEntityType, string>;

export function noteEntityHref(entity: NoteEntityRef): string {
  return `${NOTE_ENTITY_SECTIONS[entity.type]}/${noteEntityId(entity)}`;
}

export function noteEntityId(entity: NoteEntityRef): string {
  switch (entity.type) {
    case "book":
      return entity.book.id;
    case "series":
      return entity.series.id;
    default:
      return assertNever(entity);
  }
}

export function noteEntityRefFromNote(note: NoteView): Nullable<NoteEntityRef> {
  switch (note.entityType) {
    case "book":
      return note.book === null ? null : { book: note.book, type: "book" };
    case "series":
      return note.series === null ? null : { series: note.series, type: "series" };
    default:
      return assertNever(note.entityType);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled note entity: ${String(value)}`);
}
