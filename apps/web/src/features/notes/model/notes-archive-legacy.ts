import type { Nullable } from "@app/shared";
import type { ParserMap } from "nuqs/server";

import { createLoader, createSerializer } from "nuqs/server";

import type { NotesArchiveScope } from "./notes-archive-config";

import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";
import { NOTES_ARCHIVE_PARSERS } from "./notes-archive-query";

type NotesArchiveHref = {
  pathname: string;
  query: Record<string, string>;
};

type SearchParamsRecord = Record<string, string | string[] | undefined>;

const LEGACY_NOTES_PARAMS = {
  bookId: "book",
  entityType: null,
  search: "q",
  seriesId: "series",
} as const satisfies Record<string, null | string>;

type LegacyNotesParam = keyof typeof LEGACY_NOTES_PARAMS;

export function canonicalNotesArchiveHref(
  source: SearchParamsRecord,
  requestedScope?: NotesArchiveScope,
): NotesArchiveHref {
  const scope = legacyScope(source) ?? requestedScope ?? "books";

  return {
    pathname: NOTES_ARCHIVE_CONFIG[scope].route,
    query: canonicalQuery(NOTES_ARCHIVE_PARSERS[scope], renamedLegacyParams(source)),
  };
}

export function hasLegacyNotesArchiveParams(source: SearchParamsRecord): boolean {
  return Object.keys(source).some(isLegacyNotesParam);
}

function canonicalQuery<Parsers extends ParserMap>(
  parsers: Parsers,
  params: Record<string, string>,
): Record<string, string> {
  const load = createLoader(parsers);
  const serialize = createSerializer(parsers);
  return Object.fromEntries(new URLSearchParams(serialize(load(params))));
}

function isLegacyNotesParam(key: string): key is LegacyNotesParam {
  return Object.hasOwn(LEGACY_NOTES_PARAMS, key);
}

function legacyScope(source: SearchParamsRecord): Nullable<NotesArchiveScope> {
  if (typeof source.bookId === "string" || source.entityType === "book") return "books";
  if (typeof source.seriesId === "string" || source.entityType === "series") return "series";
  return null;
}

function renamedLegacyParams(source: SearchParamsRecord): Record<string, string> {
  const params: Record<string, string> = {};
  const entries = Object.entries(source);
  const canonicalFirst = [
    ...entries.filter(([key]) => !isLegacyNotesParam(key)),
    ...entries.filter(([key]) => isLegacyNotesParam(key)),
  ];

  for (const [key, value] of canonicalFirst) {
    if (typeof value !== "string" || value === "") continue;
    const canonicalKey = isLegacyNotesParam(key) ? LEGACY_NOTES_PARAMS[key] : key;
    if (canonicalKey === null || params[canonicalKey] !== undefined) continue;
    params[canonicalKey] = value;
  }

  return params;
}
