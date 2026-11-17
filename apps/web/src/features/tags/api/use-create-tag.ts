import type { CreateTagInput, TagCatalogView } from "@app/shared";

import { TagCatalogViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerCreate } from "@/shared/api/generated/endpoints/tags/tags";

import { tagChangeEffects } from "./tag-change-effects";

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput): Promise<TagCatalogView> =>
      TagCatalogViewSchema.parse(await tagsControllerCreate(input)),
    onSuccess: () => {
      void tagChangeEffects.tagsChanged(queryClient, { change: "created" });
    },
  });
}
