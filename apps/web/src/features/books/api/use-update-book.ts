import type { UpdateBookInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateBookInputDto } from "@/shared/api/generated/model";

import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

export function useUpdateBook(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBookInput) => booksControllerUpdate(id, input as UpdateBookInputDto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}
