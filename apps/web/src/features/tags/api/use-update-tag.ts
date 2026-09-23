import type { TagCatalogView, UpdateTagInput } from "@app/shared";

import { TagCatalogViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateTagDto } from "@/shared/api/generated/model";

import { tagsControllerUpdate } from "@/shared/api/generated/endpoints/tags/tags";

import { genresTagsKeys } from "./genres-tags-keys";

export type UpdateTagVariables = {
  id: string;
  input: UpdateTagInput;
};

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: UpdateTagVariables): Promise<TagCatalogView> => {
      const response = await tagsControllerUpdate(id, input as UpdateTagDto);
      return TagCatalogViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: genresTagsKeys.tagStats });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
