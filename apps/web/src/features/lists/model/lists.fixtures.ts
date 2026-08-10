import type {
  CustomListCard,
  CustomListDetail,
  ListBookView,
  ListOverviewView,
  MediaView,
  RelatedListView,
} from "@app/shared";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

type CustomListDetailOverrides = Partial<Omit<CustomListDetail, "books">> & {
  books?: Partial<CustomListDetail["books"]>;
};

export function makeCustomListCard(overrides: Partial<CustomListCard> = {}): CustomListCard {
  return {
    bookCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    id: "list-1",
    name: "Осіннє читання",
    previewCovers: [],
    updatedAt: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCustomListDetail(overrides: CustomListDetailOverrides = {}): CustomListDetail {
  const { books, ...rest } = overrides;
  const items = books?.items ?? [makeListBookView()];
  return {
    bookCount: items.length,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    id: "list-1",
    name: "Осіннє читання",
    previewCovers: [],
    statusCounts: {
      all: items.length,
      finished: 0,
      not_started: items.length,
      reading: 0,
    },
    updatedAt: "2026-01-05T00:00:00.000Z",
    ...rest,
    books: {
      items,
      page: books?.page ?? 1,
      pagesCount: books?.pagesCount ?? 1,
      pageSize: books?.pageSize ?? 24,
      totalCount: books?.totalCount ?? items.length,
    },
  };
}

export function makeListBookView(overrides: Partial<ListBookView> = {}): ListBookView {
  const { position, ...bookOverrides } = overrides;
  return { ...makeBookView(bookOverrides), position: position ?? 1 };
}

export function makeListOverviewView(overrides: Partial<ListOverviewView> = {}): ListOverviewView {
  return {
    currentlyReading: null,
    distinctAuthorsCount: 8,
    finishedCount: 4,
    genresCount: 6,
    inQueueCount: 3,
    ownedCount: 12,
    pagesKnownCount: 20,
    seriesCount: 2,
    soloCount: 18,
    topGenres: [{ count: 5, key: "fantasy", name: "Фентезі" }],
    totalBooks: 20,
    totalPages: 7840,
    ...overrides,
  };
}

export function makeMediaView(overrides: Partial<MediaView> = {}): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 800,
    id: "media-1",
    kind: "book_cover",
    name: null,
    sizeBytes: 12_345,
    urls: {
      card: "https://cdn.example.com/card.webp",
      full: "https://cdn.example.com/full.webp",
      thumb: "https://cdn.example.com/thumb.webp",
    },
    width: 600,
    ...overrides,
  };
}

export function makeRelatedListView(overrides: Partial<RelatedListView> = {}): RelatedListView {
  return {
    bookCount: 8,
    id: "33333333-3333-4333-8333-333333333333",
    name: "Улюблене фентезі",
    sharedCount: 6,
    ...overrides,
  };
}
