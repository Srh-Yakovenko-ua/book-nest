import type { GenreView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { request } from "@/lib/http-client";

import { genreViewSchema } from "./use-genres";

const RECENT_GENRES_LIMIT = 8;

export const RECENT_GENRES_KEY = ["genres", "recent"] as const;
const recentGenresSchema = z.array(genreViewSchema);

export function useRecentGenres() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreView[]> => {
      const body = await request<unknown>(`/api/genres/recent?limit=${RECENT_GENRES_LIMIT}`, {
        method: "GET",
        signal,
      });
      return recentGenresSchema.parse(body);
    },
    queryKey: RECENT_GENRES_KEY,
  });
}
