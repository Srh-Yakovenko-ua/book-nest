import type { CustomListCard } from "@app/shared";

import { CustomListCardSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { listsControllerDuplicate } from "@/shared/api/generated/endpoints/lists/lists";

import { useListCacheInvalidation } from "./use-list-cache";

export function useDuplicateList(id: string) {
  const cache = useListCacheInvalidation(id);

  return useMutation({
    mutationFn: async (): Promise<CustomListCard> =>
      CustomListCardSchema.parse(await listsControllerDuplicate(id)),
    onSuccess: cache.listDuplicated,
  });
}
