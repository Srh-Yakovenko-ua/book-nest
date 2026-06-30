import type { LibraryOverviewView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerOverview } from "@/shared/api/generated/endpoints/books/books";

import { bookViewSchema } from "../model/book-view-schema";

const libraryOverviewSchema = z.object({
  recentlyAdded: z.array(bookViewSchema),
  summary: z.object({
    favorites: z.number(),
    finished: z.number(),
    reading: z.number(),
    total: z.number(),
  }),
  topGenres: z.array(z.object({ count: z.number(), key: z.string(), name: z.string() })),
  topTags: z.array(z.object({ count: z.number(), id: z.string(), name: z.string() })),
}) satisfies z.ZodType<LibraryOverviewView>;

export type LibraryOverview = z.infer<typeof libraryOverviewSchema>;

export function useLibraryOverview() {
  return useQuery({
    queryFn: async ({ signal }): Promise<LibraryOverview> => {
      const response = await booksControllerOverview({ signal });
      return libraryOverviewSchema.parse(response);
    },
    queryKey: ["/api/books", "overview"],
  });
}
