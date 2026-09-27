import type {
  LibraryPublishersGeography,
  LibraryPublishersQuickCountsQuery,
  LibraryPublishersSource,
} from "@app/shared";

export type LibraryPublisherCriteria = {
  geography: LibraryPublishersGeography;
  hasBooksToBuy: boolean;
  hasQueue: boolean;
  hasRatedBooks: boolean;
  hasSeries: boolean;
  hasWantToRead: boolean;
  search?: string;
  source: LibraryPublishersSource;
  userId: string;
};

export function toLibraryPublisherCriteria({
  query,
  userId,
}: {
  query: LibraryPublishersQuickCountsQuery;
  userId: string;
}): LibraryPublisherCriteria {
  return {
    geography: query.geography,
    hasBooksToBuy: query.hasBooksToBuy === true,
    hasQueue: query.hasQueue === true,
    hasRatedBooks: query.hasRatedBooks === true,
    hasSeries: query.hasSeries === true,
    hasWantToRead: query.hasWantToRead === true,
    search: query.search,
    source: query.source,
    userId,
  };
}
