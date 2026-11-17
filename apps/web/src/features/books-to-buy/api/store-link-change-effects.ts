import type { QueryClient } from "@tanstack/react-query";

import { matchesPublisherCatalogKey } from "@/features/publishers/api/publisher-keys";

import { storeLinkKeys } from "./store-link-keys";
import { wishlistKeys } from "./wishlist-keys";

function storeLinksChanged(
  queryClient: QueryClient,
  { bookId }: { bookId: string },
): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
  void queryClient.invalidateQueries({ predicate: matchesPublisherCatalogKey });
  return queryClient.invalidateQueries({ queryKey: storeLinkKeys.forBook(bookId) });
}

export const storeLinkChangeEffects = { storeLinksChanged };
