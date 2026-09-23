import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerDelete } from "@/shared/api/generated/endpoints/tags/tags";

import { tagsKeys } from "./tags-keys";

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagsKeys.tagStats });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
