import { useMutation, useQueryClient } from "@tanstack/react-query";

import { booksControllerDelete } from "@/shared/api/generated/endpoints/books/books";

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
  });
}
