import type { GenreView } from "@app/shared";

import { GenreGroupKeySchema, GenreKeySchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { z } from "zod";

import { genresKeys } from "@/features/genres/api/genres-keys";
import { genresControllerList } from "@/shared/api/generated/endpoints/genres/genres";

export const genreViewSchema = z.object({
  groupKey: GenreGroupKeySchema,
  groupName: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  key: GenreKeySchema,
  name: z.string(),
}) satisfies z.ZodType<GenreView>;

const genresSchema = z.array(genreViewSchema);

const GENRES_STALE_TIME = milliseconds({ minutes: 5 });

export function useGenres() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreView[]> =>
      genresSchema.parse(await genresControllerList({ signal })),
    queryKey: genresKeys.catalog,
    staleTime: GENRES_STALE_TIME,
  });
}
