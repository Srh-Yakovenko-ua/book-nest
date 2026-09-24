import type { CreateTagInput, TagCatalogView } from "@app/shared";

import { TagCatalogViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerCreate } from "@/shared/api/generated/endpoints/tags/tags";

import { invalidateTagCollectionQueries } from "./tags-keys";

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput): Promise<TagCatalogView> =>
      TagCatalogViewSchema.parse(await tagsControllerCreate(input)),
    onSuccess: () => {
      void invalidateTagCollectionQueries(queryClient);
    },
  });
}
