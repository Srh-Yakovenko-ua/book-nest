import type { CustomListCard, UpdateListInput } from "@app/shared";

import { CustomListCardSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateListInputDto } from "@/shared/api/generated/model";

import { bookKeys } from "@/features/books/api/book-keys";
import { listsControllerUpdate } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useUpdateList(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateListInput): Promise<CustomListCard> => {
      const response = await listsControllerUpdate(id, input as UpdateListInputDto);
      return CustomListCardSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}
