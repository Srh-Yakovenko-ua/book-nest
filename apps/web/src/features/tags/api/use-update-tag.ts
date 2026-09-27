import type { TagCatalogView, UpdateTagInput } from "@app/shared";

import { TagCatalogViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerUpdate } from "@/shared/api/generated/endpoints/tags/tags";

import { invalidateTagMetadataQueries } from "./tags-keys";

export type UpdateTagVariables = {
  id: string;
  input: UpdateTagInput;
};

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: UpdateTagVariables): Promise<TagCatalogView> =>
      TagCatalogViewSchema.parse(await tagsControllerUpdate(id, input)),
    onSuccess: () => {
      void invalidateTagMetadataQueries(queryClient);
    },
  });
}
