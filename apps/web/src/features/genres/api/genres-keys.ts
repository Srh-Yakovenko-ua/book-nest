import type { QueryKey } from "@tanstack/react-query";

import { partialMatchKey } from "@tanstack/react-query";

import type { GenresDatasetParams, GenresListParams } from "../model/genres-query";

type GenreDerivedPart = "facets" | "overview" | "stats" | "summary";

const GENRES_ROOT = "/api/genres";

const GENRE_DERIVED_PARTS = [
  "stats",
  "facets",
  "summary",
  "overview",
] as const satisfies readonly GenreDerivedPart[];

function derivedPart<TPart extends GenreDerivedPart>(part: TPart) {
  return [GENRES_ROOT, part] as const;
}

export const genresKeys = {
  catalog: [GENRES_ROOT, "catalog"] as const,
  facets: (params: GenresDatasetParams) => [...derivedPart("facets"), params] as const,
  overview: derivedPart("overview"),
  recent: [GENRES_ROOT, "recent"] as const,
  stats: (params: GenresListParams) => [...derivedPart("stats"), params] as const,
  summary: derivedPart("summary"),
};

export function matchesGenreDerivedKey({ queryKey }: { queryKey: QueryKey }): boolean {
  return GENRE_DERIVED_PARTS.some((part) => partialMatchKey(queryKey, derivedPart(part)));
}
