import type { WishlistView } from "@app/shared";

import { WishlistViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { BooksControllerWishlistParams } from "@/shared/api/generated/model";

import { booksControllerWishlist } from "@/shared/api/generated/endpoints/books/books";

import { wishlistKeys } from "./wishlist-keys";

export function useWishlist(params?: BooksControllerWishlistParams) {
  return useQuery({
    queryFn: async (): Promise<WishlistView> => {
      const response = await booksControllerWishlist(params);
      return WishlistViewSchema.parse(response);
    },
    queryKey: [...wishlistKeys.root, params],
  });
}
