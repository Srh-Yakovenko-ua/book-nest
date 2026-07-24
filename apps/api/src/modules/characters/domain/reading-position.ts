import type { Nullable, ReadingPosition } from "@app/shared";

export type ContentPosition = {
  audioSeconds: Nullable<number>;
  chapter: Nullable<string>;
  page: Nullable<number>;
};

export type ReadingPositionGate = {
  contextBookId: string;
  reader: ReadingPosition;
};

export function buildReadingPositionGate({
  contextBookId,
  reader,
}: {
  contextBookId: string;
  reader: ReadingPosition | undefined;
}): Nullable<ReadingPositionGate> {
  if (reader === undefined || !hasAnyReaderUnit(reader)) {
    return null;
  }
  return { contextBookId, reader };
}

export function hasReaderReachedContent({
  content,
  reader,
}: {
  content: ContentPosition;
  reader: ReadingPosition;
}): boolean {
  if (!contentDeclaresPosition(content)) {
    return true;
  }
  if (!hasAnyReaderUnit(reader)) {
    return true;
  }
  if (content.page !== null && reader.page !== undefined) {
    return reader.page >= content.page;
  }
  const contentChapter = parseIntegerChapter(content.chapter);
  if (contentChapter !== undefined && reader.chapter !== undefined) {
    return reader.chapter >= contentChapter;
  }
  if (content.audioSeconds !== null && reader.audioSeconds !== undefined) {
    return reader.audioSeconds >= content.audioSeconds;
  }
  return false;
}

export function isHiddenByReadingPosition({
  content,
  contentBookId,
  gate,
}: {
  content: ContentPosition;
  contentBookId: string;
  gate: Nullable<ReadingPositionGate>;
}): boolean {
  if (gate === null || contentBookId !== gate.contextBookId) {
    return false;
  }
  return !hasReaderReachedContent({ content, reader: gate.reader });
}

function contentDeclaresPosition(content: ContentPosition): boolean {
  return content.page !== null || content.audioSeconds !== null || hasChapterText(content.chapter);
}

function hasAnyReaderUnit(reader: ReadingPosition): boolean {
  return (
    reader.page !== undefined || reader.chapter !== undefined || reader.audioSeconds !== undefined
  );
}

function hasChapterText(chapter: Nullable<string>): boolean {
  return chapter !== null && chapter.trim().length > 0;
}

function parseIntegerChapter(chapter: Nullable<string>): number | undefined {
  if (chapter === null) {
    return undefined;
  }
  const trimmed = chapter.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}
