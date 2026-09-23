import type { TagStatsView } from "@app/shared";

import { TagStatsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { tagsControllerStats } from "@/shared/api/generated/endpoints/tags/tags";

import { genresTagsKeys } from "./genres-tags-keys";

const TagStatsListSchema = z.array(TagStatsViewSchema);

export function useTagStats() {
  return useQuery({
    queryFn: async (): Promise<TagStatsView[]> => {
      const response = await tagsControllerStats();
      return TagStatsListSchema.parse(response);
    },
    queryKey: genresTagsKeys.tagStats,
  });
}
