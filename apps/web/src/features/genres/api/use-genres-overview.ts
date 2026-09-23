import type { GenresOverviewView } from "@app/shared";

import { GenresOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { genresControllerOverview } from "@/shared/api/generated/endpoints/genres/genres";

import { genresKeys } from "./genres-keys";

export function useGenresOverview() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenresOverviewView> =>
      GenresOverviewViewSchema.parse(await genresControllerOverview({ signal })),
    queryKey: genresKeys.overview,
    retry: false,
  });
}
