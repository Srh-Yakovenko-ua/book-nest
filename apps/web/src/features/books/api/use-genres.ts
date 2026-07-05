import type { GenreView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { request } from "@/lib/http-client";

export const genreViewSchema = z.object({
  groupKey: z.string(),
  groupName: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  key: z.string(),
  name: z.string(),
}) satisfies z.ZodType<GenreView>;

const genresSchema = z.array(genreViewSchema);

const GENRES_STALE_TIME = 5 * 60 * 1000;

export function useGenres() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreView[]> => {
      const body = await request<unknown>("/api/genres", { method: "GET", signal });
      return genresSchema.parse(body);
    },
    queryKey: ["genres"],
    staleTime: GENRES_STALE_TIME,
  });
}
