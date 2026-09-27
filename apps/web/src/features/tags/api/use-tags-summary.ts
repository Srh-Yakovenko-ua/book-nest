import type { TagsSummaryView } from "@app/shared";

import { TagsSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { tagsControllerSummary } from "@/shared/api/generated/endpoints/tags/tags";

import { tagsKeys } from "./tags-keys";

export function useTagsSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<TagsSummaryView> =>
      TagsSummaryViewSchema.parse(await tagsControllerSummary({ signal })),
    queryKey: tagsKeys.summary,
    retry: false,
  });
}
