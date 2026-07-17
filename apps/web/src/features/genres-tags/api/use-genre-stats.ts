import type { GenreStatsView } from "@app/shared";

import { GenreStatsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { genresControllerStats } from "@/shared/api/generated/endpoints/genres/genres";

import { genresTagsKeys } from "./genres-tags-keys";

const GenreStatsListSchema = z.array(GenreStatsViewSchema);

export function useGenreStats() {
  return useQuery({
    queryFn: async (): Promise<GenreStatsView[]> => {
      const response = await genresControllerStats();
      return GenreStatsListSchema.parse(response);
    },
    queryKey: genresTagsKeys.genreStats,
  });
}
