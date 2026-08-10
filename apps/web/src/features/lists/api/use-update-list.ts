import type { CustomListCard, UpdateListInput } from "@app/shared";

import { CustomListCardSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import type { UpdateListInputDto } from "@/shared/api/generated/model";

import { listsControllerUpdate } from "@/shared/api/generated/endpoints/lists/lists";

import { useListCacheInvalidation } from "./use-list-cache";

export function useUpdateList(id: string) {
  const cache = useListCacheInvalidation(id);

  return useMutation({
    mutationFn: async (input: UpdateListInput): Promise<CustomListCard> => {
      const response = await listsControllerUpdate(id, input as UpdateListInputDto);
      return CustomListCardSchema.parse(response);
    },
    onSuccess: cache.listEdited,
  });
}
