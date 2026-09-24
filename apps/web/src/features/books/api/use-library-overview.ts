import { LibraryOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerOverview } from "@/shared/api/generated/endpoints/books/books";

import {
  LIBRARY_OWNERSHIP_SCOPE,
  type LibraryPublisherContext,
  type LibraryScope,
} from "../model/library-query";

export type LibraryOverview = z.infer<typeof LibraryOverviewViewSchema>;

export function useLibraryOverview(scope: LibraryScope = "all", context?: LibraryPublisherContext) {
  const owner = scope === "my" ? [...LIBRARY_OWNERSHIP_SCOPE] : undefined;
  const params = {
    ...(owner === undefined ? {} : { owner }),
    ...(context === undefined ? {} : { publisher: context.publisherId }),
  };
  const hasParams = owner !== undefined || context !== undefined;

  return useQuery({
    queryFn: async ({ signal }): Promise<LibraryOverview> => {
      const response = await booksControllerOverview(hasParams ? params : undefined, { signal });
      return LibraryOverviewViewSchema.parse(response);
    },
    queryKey:
      context === undefined
        ? ["/api/books", "overview", scope]
        : ["/api/books", "overview", scope, context],
  });
}
