import type { WishlistFacetsView } from "@app/shared";

import { WishlistFacetsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { booksControllerWishlistFacets } from "@/shared/api/generated/endpoints/books/books";

import { wishlistKeys } from "./wishlist-keys";

export function useWishlistFacets() {
  return useQuery({
    queryFn: async (): Promise<WishlistFacetsView> => {
      const response = await booksControllerWishlistFacets();
      return WishlistFacetsViewSchema.parse(response);
    },
    queryKey: wishlistKeys.facets,
  });
}
