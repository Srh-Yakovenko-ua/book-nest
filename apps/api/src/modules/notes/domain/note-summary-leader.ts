import type { NotesSummaryAuthor, Nullable } from "@app/shared";

import type { NoteAuthorLink, NoteEntityCount } from "./note-facets.js";

import { toAuthorFacets } from "./note-facets.js";

export const NOTES_SUMMARY_RULES = {
  bookBusyMinNotes: 5,
  recentWindowDays: 30,
  seriesBusyMinNotes: 3,
} as const;

export type NoteSummaryLeader = {
  label: Nullable<string>;
  leadersCount: number;
  notesCount: number;
};

type LeaderCandidate = { count: number; label: string };

export function countEntitiesWithAtLeast({
  entityCounts,
  minNotes,
}: {
  entityCounts: NoteEntityCount[];
  minNotes: number;
}): number {
  return entityCounts.filter((entry) => entry.count >= minNotes).length;
}

export function resolveNoteSummaryLeader(
  candidates: LeaderCandidate[],
): Nullable<NoteSummaryLeader> {
  const notesCount = candidates.reduce((best, candidate) => Math.max(best, candidate.count), 0);
  if (notesCount === 0) {
    return null;
  }

  const leaders = candidates.filter((candidate) => candidate.count === notesCount);
  const [soleLeader] = leaders;
  const label = leaders.length === 1 && soleLeader !== undefined ? soleLeader.label : null;

  return { label, leadersCount: leaders.length, notesCount };
}

export function resolveTopAuthor({
  entityCounts,
  links,
}: {
  entityCounts: NoteEntityCount[];
  links: NoteAuthorLink[];
}): Nullable<NotesSummaryAuthor> {
  const leader = resolveNoteSummaryLeader(
    toAuthorFacets({ entityCounts, links }).map((facet) => ({
      count: facet.count,
      label: facet.name,
    })),
  );
  if (leader === null) {
    return null;
  }
  return { leadersCount: leader.leadersCount, name: leader.label, notesCount: leader.notesCount };
}

export function sumNoteCounts(entityCounts: NoteEntityCount[]): number {
  return entityCounts.reduce((total, entry) => total + entry.count, 0);
}
