import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerPurchaseStores } from "@/shared/api/generated/endpoints/books/books";

const RECENT_STORES_LIMIT = 8;

export function useRecentStores() {
  return useQuery({
    queryFn: async (): Promise<string[]> => {
      const response = await booksControllerPurchaseStores({ limit: RECENT_STORES_LIMIT });
      return z.array(z.string()).parse(response);
    },
    queryKey: ["books", "purchase-stores"],
  });
}
