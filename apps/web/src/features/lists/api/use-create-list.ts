import type { CustomListCard, NewListInput } from "@app/shared";

import { CustomListCardSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { NewListInputDto } from "@/shared/api/generated/model";

import { listsControllerCreate } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewListInput): Promise<CustomListCard> => {
      const response = await listsControllerCreate(input as NewListInputDto);
      return CustomListCardSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
    },
  });
}
