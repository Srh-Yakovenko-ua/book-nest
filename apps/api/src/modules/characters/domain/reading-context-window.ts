import type { ContextBookReader } from "./context-books.js";

import { resolveReadingContext } from "./context-books.js";

export type CharacterScopedAppearance = { bookId: string; characterId: string };

export type ReadingContextWindow = ContextBooksWindow | { kind: "unrestricted" };

export type RosterVisibility = { kind: "outside_context_window" } | { kind: "ungated" };

export const UNRESTRICTED_READING_CONTEXT_WINDOW: ReadingContextWindow = { kind: "unrestricted" };

export const UNGATED_ROSTER_VISIBILITY: RosterVisibility = { kind: "ungated" };

type ContextBooksWindow = {
  allowedBookIds: ReadonlySet<string>;
  kind: "context_books";
};

export function collectUnreachableCharacterIds({
  appearances,
  characterIds,
  window,
}: {
  appearances: CharacterScopedAppearance[];
  characterIds: string[];
  window: ReadingContextWindow;
}): Set<string> {
  const unreachable = new Set(characterIds);
  for (const appearance of appearances) {
    if (isBookWithinReadingContextWindow({ bookId: appearance.bookId, window })) {
      unreachable.delete(appearance.characterId);
    }
  }
  return unreachable;
}

export function isBookWithinReadingContextWindow({
  bookId,
  window,
}: {
  bookId: string;
  window: ReadingContextWindow;
}): boolean {
  return window.kind === "unrestricted" || window.allowedBookIds.has(bookId);
}

export async function resolveReadingContextWindow({
  bookReader,
  contextBookId,
  notFoundCode,
  userId,
}: {
  bookReader: ContextBookReader;
  contextBookId: string;
  notFoundCode: string;
  userId: string;
}): Promise<ContextBooksWindow> {
  const context = await resolveReadingContext({
    contextBookId,
    notFoundCode,
    reader: bookReader,
    userId,
  });
  return { allowedBookIds: new Set(context.allowedBookIds), kind: "context_books" };
}
