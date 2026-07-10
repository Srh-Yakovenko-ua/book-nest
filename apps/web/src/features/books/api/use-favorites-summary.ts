import { FavoritesSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerFavoritesSummary } from "@/shared/api/generated/endpoints/books/books";

export type FavoritesSummary = z.infer<typeof FavoritesSummaryViewSchema>;

export function useFavoritesSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<FavoritesSummary> => {
      const response = await booksControllerFavoritesSummary({ signal });
      return FavoritesSummaryViewSchema.parse(response);
    },
    queryKey: ["/api/books", "favorites-summary"],
  });
}
