import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsControllerDelete } from "@/shared/api/generated/endpoints/tags/tags";

import { tagChangeEffects } from "./tag-change-effects";

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsControllerDelete(id),
    onSuccess: () => {
      void tagChangeEffects.tagsChanged(queryClient, { change: "deleted" });
    },
  });
}
