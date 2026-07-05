import { LibraryOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerOverview } from "@/shared/api/generated/endpoints/books/books";

export type LibraryOverview = z.infer<typeof LibraryOverviewViewSchema>;

export function useLibraryOverview() {
  return useQuery({
    queryFn: async ({ signal }): Promise<LibraryOverview> => {
      const response = await booksControllerOverview({ signal });
      return LibraryOverviewViewSchema.parse(response);
    },
    queryKey: ["/api/books", "overview"],
  });
}
