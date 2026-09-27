import type { QueryClient } from "@tanstack/react-query";

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
  facets: (params: GenresDatasetParams) => [...derivedPart("facets"), params] as const,
  overview: derivedPart("overview"),
  stats: (params: GenresListParams) => [...derivedPart("stats"), params] as const,
  summary: derivedPart("summary"),
};

export async function invalidateGenreDerivedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    GENRE_DERIVED_PARTS.map((part) =>
      queryClient.invalidateQueries({ queryKey: derivedPart(part) }),
    ),
  );
}
