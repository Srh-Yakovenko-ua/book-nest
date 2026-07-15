import { PaginatedBooksSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";
import {
  BooksControllerListSort,
  BooksControllerListStatusItem,
} from "@/shared/api/generated/model";

type UnratedFavoritesPage = z.infer<typeof PaginatedBooksSchema>;

const UNRATED_FAVORITES_PREVIEW_SIZE = 3;

const UNRATED_FAVORITES_PARAMS: BooksControllerListParams = {
  ageCategory: [],
  author: [],
  format: [],
  genre: [],
  hasRating: "false",
  isFavorite: "true",
  language: [],
  owner: [],
  pageSize: UNRATED_FAVORITES_PREVIEW_SIZE,
  publisher: [],
  sort: BooksControllerListSort.favorite_added_desc,
  status: [BooksControllerListStatusItem.finished],
  tag: [],
};

export function useUnratedFavorites() {
  return useQuery({
    queryFn: async ({ signal }): Promise<UnratedFavoritesPage> => {
      const response = await booksControllerList(UNRATED_FAVORITES_PARAMS, { signal });
      return PaginatedBooksSchema.parse(response);
    },
    queryKey: ["/api/books", "favorites-unrated-preview"],
  });
}
