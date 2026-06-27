import type { BookView, MediaView, Nullable } from "@app/shared";

import type {
  AuthorSelection,
  CreateBookFormValues,
  PublisherSelection,
  SeriesSelection,
} from "./create-book-form";

import { createBookFormDefaults } from "./create-book-form";

export type BookFormInitialState = {
  authorSelection: AuthorSelection;
  cover: Nullable<MediaView>;
  publisherSelection: null | PublisherSelection;
  seriesSelection: null | SeriesSelection;
  values: CreateBookFormValues;
};

export function bookViewToFormState(book: BookView): BookFormInitialState {
  const authorSelection: AuthorSelection = {
    id: book.author.id,
    kind: "catalog",
    name: book.author.name,
  };

  const publisherSelection: null | PublisherSelection =
    book.publisher === null
      ? null
      : { id: book.publisher.id, kind: "catalog", name: book.publisher.name };

  const seriesSelection: null | SeriesSelection =
    book.series === null ? null : { id: book.series.id, kind: "existing", name: book.series.name };

  const values: CreateBookFormValues = {
    ...createBookFormDefaults,
    addToReadingQueue: book.isInReadingQueue,
    ageCategory: book.ageCategory,
    author: { id: book.author.id },
    bookType: book.bookType,
    dedication: book.dedication ?? undefined,
    deliveryInfo: deliveryToInput(book),
    description: book.description ?? undefined,
    formats: book.formats,
    genres: book.genres,
    illustrator: book.illustrator ?? undefined,
    isbn: book.isbn ?? undefined,
    isFavorite: book.isFavorite,
    language: book.language,
    listIds: book.lists.map((list) => list.id),
    loanInfo: loanToInput(book),
    originalTitle: book.originalTitle ?? undefined,
    ownershipStatus: book.ownershipStatus,
    pagesCount: book.pagesCount ?? undefined,
    partNumber: book.series === null ? undefined : (book.partNumber ?? undefined),
    publicationYear: book.publicationYear ?? undefined,
    purchaseInfo: purchaseToInput(book),
    queuePriority: book.queuePriority ?? undefined,
    readingProgress: readingProgressToInput(book),
    readingStatus: book.readingStatus,
    seriesId: book.series?.id,
    tags: book.tags.map((tag) => tag.name),
    title: book.title,
    translator: book.translator ?? undefined,
  };

  if (book.publisher !== null) values.publisherId = book.publisher.id;

  return {
    authorSelection,
    cover: book.cover ?? null,
    publisherSelection,
    seriesSelection,
    values,
  };
}

function deliveryToInput(book: BookView): CreateBookFormValues["deliveryInfo"] {
  const info = book.deliveryInfo;
  if (info === null) return {};
  return {
    deliveryStatus: info.deliveryStatus ?? undefined,
    expectedDeliveryDate: info.expectedDeliveryDate ?? undefined,
    note: info.note ?? undefined,
    orderDate: info.orderDate ?? undefined,
    orderNumber: info.orderNumber ?? undefined,
    storeName: info.storeName ?? undefined,
  };
}

function loanToInput(book: BookView): CreateBookFormValues["loanInfo"] {
  const info = book.loanInfo;
  if (info === null) return {};
  return {
    expectedReturnDate: info.expectedReturnDate ?? undefined,
    loanDate: info.loanDate ?? undefined,
    note: info.note ?? undefined,
    personName: info.personName,
  };
}

function purchaseToInput(book: BookView): CreateBookFormValues["purchaseInfo"] {
  const info = book.purchaseInfo;
  if (info === null) return {};
  return {
    currency: info.currency ?? undefined,
    expectedPrice: info.expectedPrice ?? undefined,
    note: info.note ?? undefined,
    storeName: info.storeName ?? undefined,
    storeUrl: info.storeUrl ?? undefined,
  };
}

function readingProgressToInput(book: BookView): CreateBookFormValues["readingProgress"] {
  const progress = book.readingProgress;
  if (progress === null) return {};
  return {
    abandonedAt: progress.abandonedAt ?? undefined,
    currentPage: progress.currentPage ?? undefined,
    finishedAt: progress.finishedAt ?? undefined,
    impression: progress.impression ?? undefined,
    note: progress.note ?? undefined,
    pausedAt: progress.pausedAt ?? undefined,
    rating: progress.rating ?? undefined,
    startedAt: progress.startedAt ?? undefined,
  };
}
