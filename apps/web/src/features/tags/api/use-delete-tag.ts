import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerDelete } from "@/shared/api/generated/endpoints/tags/tags";

import { genresTagsKeys } from "./genres-tags-keys";

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: genresTagsKeys.tagStats });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
