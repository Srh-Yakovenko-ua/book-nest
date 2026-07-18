import type { GenreView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { genresControllerList } from "@/shared/api/generated/endpoints/genres/genres";

import { genresTagsKeys } from "./genres-tags-keys";

const GenreViewSchema = z.object({
  groupKey: z.string(),
  groupName: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  key: z.string(),
  name: z.string(),
}) satisfies z.ZodType<GenreView>;

const GenreCatalogSchema = z.array(GenreViewSchema);

export function useGenreCatalog() {
  return useQuery({
    queryFn: async (): Promise<GenreView[]> => {
      const response = await genresControllerList();
      return GenreCatalogSchema.parse(response);
    },
    queryKey: genresTagsKeys.genreCatalog,
  });
}
