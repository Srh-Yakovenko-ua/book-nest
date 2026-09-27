import type { GenreSummaryView } from "@app/shared";

import { GenreSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { genresControllerSummary } from "@/shared/api/generated/endpoints/genres/genres";

import { genresKeys } from "./genres-keys";

export function useGenreSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<GenreSummaryView> =>
      GenreSummaryViewSchema.parse(await genresControllerSummary({ signal })),
    queryKey: genresKeys.summary,
    retry: false,
  });
}
