import type { GenreView } from "@app/shared";

import { GenreViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { z } from "zod";

import { genresControllerList } from "@/shared/api/generated/endpoints/genres/genres";

import { genresKeys } from "./genres-keys";

const genresSchema = z.array(GenreViewSchema);

const GENRES_STALE_TIME = milliseconds({ minutes: 5 });

export function useGenres() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreView[]> =>
      genresSchema.parse(await genresControllerList({ signal })),
    queryKey: genresKeys.catalog,
    staleTime: GENRES_STALE_TIME,
  });
}
