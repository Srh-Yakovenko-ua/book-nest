import type { Nullable, ReadingPosition } from "@app/shared";

import type { ContextBookReader } from "./context-books.js";
import type { ReadingPositionGate } from "./reading-position.js";

import { resolveReadingContext } from "./context-books.js";
import { buildReadingPositionGate, isHiddenByReadingPosition } from "./reading-position.js";

export type CharacterScopedAppearance = ContextualAppearance & { characterId: string };

export type ContextualAppearance = {
  bookId: string;
  firstAppearanceAudioSeconds: Nullable<number>;
  firstAppearanceChapter: Nullable<string>;
  firstAppearancePage: Nullable<number>;
  hidePresenceAsSpoiler: boolean;
};

export type ReadingContextWindow = PositionedReadingContextWindow | { kind: "unrestricted" };

export type RosterVisibility =
  | { kind: "beyond_reading_position" }
  | { kind: "within_reading_position"; positionHiddenIds: string[] };

export const UNRESTRICTED_READING_CONTEXT_WINDOW: ReadingContextWindow = { kind: "unrestricted" };

export const UNGATED_ROSTER_VISIBILITY: RosterVisibility = {
  kind: "within_reading_position",
  positionHiddenIds: [],
};

type PositionedReadingContextWindow = {
  allowedBookIds: ReadonlySet<string>;
  kind: "reading_position";
  positionGate: Nullable<ReadingPositionGate>;
};

export function buildReadingContextWindow({
  allowedBookIds,
  contextBookId,
  readingPosition,
}: {
  allowedBookIds: string[];
  contextBookId: Nullable<string>;
  readingPosition: ReadingPosition | undefined;
}): PositionedReadingContextWindow {
  return {
    allowedBookIds: new Set(allowedBookIds),
    kind: "reading_position",
    positionGate:
      contextBookId === null
        ? null
        : buildReadingPositionGate({ contextBookId, reader: readingPosition }),
  };
}

export function collectPositionHiddenAppearanceIds<Appearance extends ContextualAppearance>({
  appearances,
  window,
}: {
  appearances: (Appearance & { id: string })[];
  window: ReadingContextWindow;
}): string[] {
  return appearances
    .filter((appearance) => !isAppearanceRevealable({ appearance, window }))
    .map((appearance) => appearance.id);
}

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
    if (isAppearanceRevealable({ appearance, window })) {
      unreachable.delete(appearance.characterId);
    }
  }
  return unreachable;
}

export function isAppearanceRevealable({
  appearance,
  window,
}: {
  appearance: ContextualAppearance;
  window: ReadingContextWindow;
}): boolean {
  if (appearance.hidePresenceAsSpoiler) {
    return false;
  }
  if (window.kind === "unrestricted") {
    return true;
  }
  if (!window.allowedBookIds.has(appearance.bookId)) {
    return false;
  }
  return !isHiddenByReadingPosition({
    content: {
      audioSeconds: appearance.firstAppearanceAudioSeconds,
      chapter: appearance.firstAppearanceChapter,
      page: appearance.firstAppearancePage,
    },
    contentBookId: appearance.bookId,
    gate: window.positionGate,
  });
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
  readingPosition,
  userId,
}: {
  bookReader: ContextBookReader;
  contextBookId: string;
  notFoundCode: string;
  readingPosition: ReadingPosition | undefined;
  userId: string;
}): Promise<PositionedReadingContextWindow> {
  const context = await resolveReadingContext({
    contextBookId,
    notFoundCode,
    reader: bookReader,
    userId,
  });
  return buildReadingContextWindow({
    allowedBookIds: context.allowedBookIds,
    contextBookId,
    readingPosition,
  });
}
