import type { UpdateBookInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { seriesKeys } from "@/features/series/api/series-keys";
import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

export function useUpdateBook(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBookInput) => booksControllerUpdate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    },
  });
}
