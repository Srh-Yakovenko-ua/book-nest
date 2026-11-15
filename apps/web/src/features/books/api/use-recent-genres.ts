import type { GenreView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { genresKeys } from "@/features/genres/api/genres-keys";
import { genresControllerRecent } from "@/shared/api/generated/endpoints/genres/genres";

import { genreViewSchema } from "./use-genres";

const RECENT_GENRES_PARAMS = { limit: 8 } as const;

const recentGenresSchema = z.array(genreViewSchema);

export function useRecentGenres() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreView[]> =>
      recentGenresSchema.parse(await genresControllerRecent(RECENT_GENRES_PARAMS, { signal })),
    queryKey: genresKeys.recent,
  });
}
