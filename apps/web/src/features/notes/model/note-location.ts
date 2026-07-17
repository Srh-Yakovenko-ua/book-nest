import type { NoteView, Nullable } from "@app/shared";

const LOCATION_SEPARATOR = " · ";

export type NoteLocation = Pick<NoteView, "chapter" | "page">;

export function noteLocationLine(
  { chapter, page }: NoteLocation,
  formatPage: (page: number) => string,
): Nullable<string> {
  const chapterLabel = chapter === null ? "" : chapter.trim();
  const pageLabel = page === null ? "" : formatPage(page);

  const parts = [chapterLabel, pageLabel].filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  return parts.join(LOCATION_SEPARATOR);
}
