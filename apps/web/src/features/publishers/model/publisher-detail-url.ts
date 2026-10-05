import type { Nullable } from "@app/shared";

import { type inferParserType, parseAsString } from "nuqs/server";

import { libraryQueryParsers } from "@/features/books";
import {
  BooksControllerListOwnerItem,
  BooksControllerListPublisherPresence,
} from "@/shared/api/generated/model";

export const publisherDetailUrlParsers = {
  ...libraryQueryParsers,
  tab: parseAsString,
};

type PublisherDetailUrlPatch = {
  [Key in keyof PublisherDetailUrlState]?: Nullable<PublisherDetailUrlState[Key]>;
};

type PublisherDetailUrlState = inferParserType<typeof publisherDetailUrlParsers>;

const PUBLISHER_DETAIL_URL = {
  legacyWishlistTab: "toBuy",
} as const;

export function publisherDetailUrlNormalization(
  state: PublisherDetailUrlState,
): Nullable<PublisherDetailUrlPatch> {
  const carriesFixedPublisher =
    state.publisher.length > 0 ||
    state.publisherPresence !== BooksControllerListPublisherPresence.all;

  if (state.tab === PUBLISHER_DETAIL_URL.legacyWishlistTab) {
    return {
      owner: [BooksControllerListOwnerItem.want_to_buy],
      publisher: null,
      publisherPresence: null,
      tab: null,
    };
  }

  if (state.tab !== null) {
    return carriesFixedPublisher
      ? { publisher: null, publisherPresence: null, tab: null }
      : { tab: null };
  }

  return carriesFixedPublisher ? { publisher: null, publisherPresence: null } : null;
}
