import type { CreateTagInput, TagCatalogView } from "@app/shared";

import { TagCatalogViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateTagDto } from "@/shared/api/generated/model";

import { tagsControllerCreate } from "@/shared/api/generated/endpoints/tags/tags";

import { genresTagsKeys } from "./genres-tags-keys";

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput): Promise<TagCatalogView> => {
      const response = await tagsControllerCreate(input as CreateTagDto);
      return TagCatalogViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: genresTagsKeys.tagStats });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
