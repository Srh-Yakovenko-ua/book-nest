import { LibraryOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerOverview } from "@/shared/api/generated/endpoints/books/books";

import { LIBRARY_OWNERSHIP_SCOPE, type LibraryScope } from "../model/library-query";

export type LibraryOverview = z.infer<typeof LibraryOverviewViewSchema>;

export function useLibraryOverview(scope: LibraryScope = "all") {
  const owner = scope === "my" ? [...LIBRARY_OWNERSHIP_SCOPE] : undefined;

  return useQuery({
    queryFn: async ({ signal }): Promise<LibraryOverview> => {
      const response = await booksControllerOverview(owner ? { owner } : undefined, { signal });
      return LibraryOverviewViewSchema.parse(response);
    },
    queryKey: ["/api/books", "overview", scope],
  });
}
