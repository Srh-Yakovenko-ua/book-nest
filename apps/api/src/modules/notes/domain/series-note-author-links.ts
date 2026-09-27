import type { NoteAuthorLink } from "./note-facets.js";

import { resolveSeriesCanonicalAuthors } from "../../series/index.js";

type SeriesAuthorsSource = Parameters<typeof resolveSeriesCanonicalAuthors>[0] & { id: string };

export function toSeriesNoteAuthorLinks(sources: SeriesAuthorsSource[]): NoteAuthorLink[] {
  return sources.flatMap((series) =>
    resolveSeriesCanonicalAuthors(series).map((author) => ({ author, entityId: series.id })),
  );
}
