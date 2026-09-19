import type { Nullable, ValueOf } from "@app/shared";

import { z } from "zod";

import type { RediscoveryCandidate } from "../../../core/rediscovery.js";

import { engagementScoreOf, selectRediscoveryCandidateId } from "../../../core/rediscovery.js";

export const NOTE_REDISCOVERY_SURFACE = { books: "books", series: "series" } as const;

export type NoteRediscoveryScope = {
  contextKey: string;
  surface: NoteRediscoverySurface;
};

export type NoteRediscoverySurface = ValueOf<typeof NOTE_REDISCOVERY_SURFACE>;

export const BOOKS_REDISCOVERY_SCOPE: NoteRediscoveryScope = {
  contextKey: "all",
  surface: NOTE_REDISCOVERY_SURFACE.books,
};

export type NoteImpressionTarget = NoteRediscoveryScope & {
  noteId: string;
};

export type NoteRediscoveryCandidate = {
  createdOn: string;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
  lastShownOn: Nullable<string>;
  sourceKey: string;
};

export type NoteSourceRef = {
  id: string;
  type: "book" | "series";
};

export function parseSeriesContextKey(contextKey: string): Nullable<string> {
  const parsed = z.uuid().safeParse(contextKey);
  return parsed.success ? parsed.data : null;
}

export function seriesRediscoveryScope(seriesId: string): NoteRediscoveryScope {
  return { contextKey: seriesId, surface: NOTE_REDISCOVERY_SURFACE.series };
}

const NoteImpressionTargetSchema = z.object({
  contextKey: z.string().min(1),
  noteId: z.uuid(),
  surface: z.enum(NOTE_REDISCOVERY_SURFACE),
});

export function decodeNoteImpressionKey(key: string): Nullable<NoteImpressionTarget> {
  const parsed = NoteImpressionTargetSchema.safeParse(readImpressionKeyPayload(key));
  return parsed.success ? parsed.data : null;
}

export function encodeNoteImpressionKey(target: NoteImpressionTarget): string {
  const payload = {
    contextKey: target.contextKey,
    noteId: target.noteId,
    surface: target.surface,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function noteSourceKeyOf(source: NoteSourceRef): string {
  return `${source.type}:${source.id}`;
}

export function selectMemoryNoteId({
  candidates,
  lastSourceKey,
  localDate,
  scope,
  userId,
}: {
  candidates: NoteRediscoveryCandidate[];
  lastSourceKey: Nullable<string>;
  localDate: string;
  scope: NoteRediscoveryScope;
  userId: string;
}): Nullable<string> {
  const sourceKeyById = new Map(
    candidates.map((candidate) => [candidate.id, candidate.sourceKey] as const),
  );

  return selectRediscoveryCandidateId({
    candidates: candidates.map(toRediscoveryCandidate),
    diversity: lastSourceKey === null ? null : { lastSourceKey, sourceKeyById },
    localDate,
    seedParts: [userId, scope.surface, scope.contextKey, localDate],
  });
}

function readImpressionKeyPayload(key: string): unknown {
  try {
    return JSON.parse(Buffer.from(key, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function toRediscoveryCandidate(candidate: NoteRediscoveryCandidate): RediscoveryCandidate {
  return {
    createdOn: candidate.createdOn,
    engagementScore: engagementScoreOf({
      hasSecondarySignal: candidate.isPinned,
      isFavorite: candidate.isFavorite,
    }),
    id: candidate.id,
    lastShownOn: candidate.lastShownOn,
  };
}
