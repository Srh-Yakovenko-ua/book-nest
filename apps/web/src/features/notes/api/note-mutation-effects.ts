import type { EntityNotesView, NoteEntityType, NoteView, Nullable, Paginator } from "@app/shared";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

import { assertNever } from "@/lib/assert-never";

import type { NotesArchiveScope } from "../model/notes-archive-config";
import type { NotesArchivePart } from "./notes-keys";

import { noteEntityRefFromNote } from "../model/note-entity";
import { NOTES_ARCHIVE_SCOPE_BY_ENTITY } from "../model/notes-archive-config";
import { notesKeys } from "./notes-keys";

export type NoteRefreshTiming = "awaited" | "background";

type NoteMutationKind = "create" | "delete" | "update";

const NOTE_MUTATION_EFFECTS = {
  archiveParts: {
    create: ["list", "facets", "summary"],
    delete: ["list", "facets", "summary"],
    update: ["list", "facets"],
  },
  overviewScopes: {
    create: { book: ["books", "series"], series: ["series"] },
    delete: { book: ["books", "series"], series: ["books", "series"] },
    update: { book: ["books", "series"], series: ["series"] },
  },
} as const satisfies {
  archiveParts: Record<NoteMutationKind, readonly NotesArchivePart[]>;
  overviewScopes: Record<NoteMutationKind, Record<NoteEntityType, readonly NotesArchiveScope[]>>;
};

export async function refreshAfterNoteMutation(
  queryClient: QueryClient,
  { kind, note }: { kind: NoteMutationKind; note: NoteView },
): Promise<void> {
  const scope = NOTES_ARCHIVE_SCOPE_BY_ENTITY[note.entityType];
  const detailsKey = noteDetailsKey(note);
  const keys: QueryKey[] = [
    ...NOTE_MUTATION_EFFECTS.archiveParts[kind].map((part) => notesKeys.archivePart(scope, part)),
    ...NOTE_MUTATION_EFFECTS.overviewScopes[kind][note.entityType].map((overviewScope) =>
      notesKeys.archivePart(overviewScope, "overview"),
    ),
    ...(detailsKey === null ? [] : [detailsKey]),
  ];

  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function writeUpdatedNote(queryClient: QueryClient, note: NoteView): void {
  const replace = (item: NoteView) => (item.id === note.id ? note : item);
  const scope = NOTES_ARCHIVE_SCOPE_BY_ENTITY[note.entityType];

  queryClient.setQueriesData<InfiniteData<Paginator<NoteView>>>(
    { queryKey: notesKeys.archivePart(scope, "list") },
    (data) =>
      data === undefined
        ? data
        : {
            ...data,
            pages: data.pages.map((page) => ({ ...page, items: page.items.map(replace) })),
          },
  );

  const detailsKey = noteDetailsKey(note);
  if (detailsKey === null) return;

  queryClient.setQueryData<EntityNotesView>(detailsKey, (data) =>
    data === undefined ? data : { ...data, notes: data.notes.map(replace) },
  );
}

function noteDetailsKey(note: NoteView): Nullable<QueryKey> {
  const entity = noteEntityRefFromNote(note);
  if (entity === null) return null;

  switch (entity.type) {
    case "book":
      return notesKeys.byBook(entity.book.id);
    case "series":
      return notesKeys.bySeries(entity.series.id);
    default:
      return assertNever(entity);
  }
}
