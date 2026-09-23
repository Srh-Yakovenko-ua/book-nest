import type { Nullable } from "@app/shared";

import { createSerializer, type inferParserType, parseAsString } from "nuqs/server";

import { libraryQueryParsers } from "@/features/books";
import { BooksControllerListOwnerItem } from "@/shared/api/generated/model";

const PUBLISHER_DETAIL_TABS = ["overview", "books"] as const;

export type PublisherDetailTab = (typeof PUBLISHER_DETAIL_TABS)[number];

export const publisherDetailUrlParsers = {
  ...libraryQueryParsers,
  tab: parseAsString,
};

type PublisherDetailUrlPatch = {
  [Key in keyof PublisherDetailUrlState]?: Nullable<PublisherDetailUrlState[Key]>;
};

type PublisherDetailUrlState = inferParserType<typeof publisherDetailUrlParsers>;

const PUBLISHER_DETAIL_URL = {
  booksTab: "books",
  legacyWishlistTab: "toBuy",
} as const;

const serializeBooksParams = createSerializer(libraryQueryParsers);

export function isPublisherDetailTab(value: string): value is PublisherDetailTab {
  return PUBLISHER_DETAIL_TABS.some((tab) => tab === value);
}

export function publisherBooksUrl(): PublisherDetailUrlPatch {
  return { ...publisherOverviewUrl(), tab: PUBLISHER_DETAIL_URL.booksTab };
}

export function publisherDetailUrlNormalization(
  state: PublisherDetailUrlState,
): Nullable<PublisherDetailUrlPatch> {
  if (state.tab === PUBLISHER_DETAIL_URL.legacyWishlistTab) {
    return {
      owner: [BooksControllerListOwnerItem.want_to_buy],
      publisher: null,
      tab: PUBLISHER_DETAIL_URL.booksTab,
    };
  }

  if (state.tab === PUBLISHER_DETAIL_URL.booksTab) {
    return state.publisher.length === 0 ? null : { publisher: null };
  }

  const hasBooksParams = serializeBooksParams(state) !== "";
  if (state.tab === null && !hasBooksParams) return null;

  return publisherOverviewUrl();
}

export function publisherOverviewUrl(): PublisherDetailUrlPatch {
  return Object.fromEntries(Object.keys(publisherDetailUrlParsers).map((key) => [key, null]));
}

export function resolvePublisherDetailTab(tab: Nullable<string>): PublisherDetailTab {
  if (tab === PUBLISHER_DETAIL_URL.booksTab || tab === PUBLISHER_DETAIL_URL.legacyWishlistTab) {
    return "books";
  }
  return "overview";
}
