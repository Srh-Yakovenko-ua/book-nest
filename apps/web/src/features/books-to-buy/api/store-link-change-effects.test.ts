import type { QueryKey } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { publisherKeys } from "@/features/publishers/api/publisher-keys";

import { storeLinkChangeEffects } from "./store-link-change-effects";
import { storeLinkKeys } from "./store-link-keys";
import { wishlistKeys } from "./wishlist-keys";

const KEYS = {
  otherStoreLinks: storeLinkKeys.forBook("book-2"),
  publisherPicker: publisherKeys.picker.search("", "uk"),
  publisherSummary: publisherKeys.summary("uk"),
  storeLinks: storeLinkKeys.forBook("book-1"),
  wishlist: wishlistKeys.root,
} as const satisfies Record<string, QueryKey>;

function seededClient(keys: readonly QueryKey[]): QueryClient {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, {});
  return client;
}

function staleFlags(client: QueryClient, keys: readonly QueryKey[]): boolean[] {
  return keys.map((key) => client.getQueryState(key)?.isInvalidated ?? false);
}

describe("storeLinkChangeEffects", () => {
  it("refreshes the book's store links, the wishlist and the publisher catalog", async () => {
    const keys = [KEYS.storeLinks, KEYS.wishlist, KEYS.publisherSummary];
    const client = seededClient(keys);

    await storeLinkChangeEffects.storeLinksChanged(client, { bookId: "book-1" });

    expect(staleFlags(client, keys)).toEqual([true, true, true]);
  });

  it("leaves other books' store links and the publisher picker fresh", async () => {
    const keys = [KEYS.storeLinks, KEYS.otherStoreLinks, KEYS.publisherPicker];
    const client = seededClient(keys);

    await storeLinkChangeEffects.storeLinksChanged(client, { bookId: "book-1" });

    expect(staleFlags(client, keys)).toEqual([true, false, false]);
  });
});
