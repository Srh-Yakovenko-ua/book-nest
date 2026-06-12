import type { CreateBookInput, UpdateBookInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { AuthorsService } from "../../authors/application/authors.service.js";
import type { ListsService } from "../../lists/application/lists.service.js";
import type { PublishersService } from "../../publishers/application/publishers.service.js";
import type { SeriesService } from "../../series/application/series.service.js";
import type { TagsService } from "../../tags/application/tags.service.js";
import type {
  BooksRepository,
  BookWithRelations,
  UpdateBookData,
} from "../infrastructure/books.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksService } from "./books.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";
const TAG_ID = "55555555-5555-4555-8555-555555555555";
const SERIES_ID = "66666666-6666-4666-8666-666666666666";
const LIST_ID = "77777777-7777-4777-8777-777777777777";

type Repository = {
  countByUser: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  deleteOwned: ReturnType<typeof vi.fn>;
  findOwnedById: ReturnType<typeof vi.fn>;
  listByUser: ReturnType<typeof vi.fn>;
  maxQueuePosition: ReturnType<typeof vi.fn>;
  updateOwned: ReturnType<typeof vi.fn>;
};

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    ageCategory: "not_specified",
    author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
    authorId: AUTHOR_ID,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dedication: null,
    deliveryInfo: null,
    description: null,
    formats: [],
    genres: [],
    id: BOOK_ID,
    illustrator: null,
    isbn: null,
    isFavorite: false,
    language: "ukrainian",
    lists: [],
    loanInfo: null,
    originalTitle: null,
    ownershipStatus: "none",
    pagesCount: null,
    partNumber: null,
    publicationYear: null,
    publisher: { id: PUBLISHER_ID, name: "Penguin", normalizedName: "penguin" },
    publisherId: PUBLISHER_ID,
    purchaseInfo: null,
    queuePosition: null,
    queuePriority: null,
    readingProgress: null,
    readingStatus: "not_started",
    series: null,
    seriesId: null,
    tags: [],
    title: "Dune",
    translator: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  } as BookWithRelations;
}

function buildService(
  overrides: {
    authorId?: string;
    countByUser?: number;
    create?: BookWithRelations;
    deleteOwned?: number;
    findOwnedById?: BookWithRelations | null;
    listByUser?: BookWithRelations[];
    listIds?: string[];
    maxQueuePosition?: number;
    publisherId?: null | string;
    seriesId?: string;
    tagIds?: string[];
    updateOwned?: BookWithRelations;
  } = {},
): {
  authorsService: {
    materializeFromOpenLibrary: ReturnType<typeof vi.fn>;
    resolveOrCreate: ReturnType<typeof vi.fn>;
  };
  listsService: { resolveListsForBook: ReturnType<typeof vi.fn> };
  publishersService: { resolveOrCreate: ReturnType<typeof vi.fn> };
  repository: Repository;
  seriesService: { resolveForBook: ReturnType<typeof vi.fn> };
  service: BooksService;
  tagsService: { resolveOrCreateMany: ReturnType<typeof vi.fn> };
} {
  const repository: Repository = {
    countByUser: vi.fn().mockResolvedValue(overrides.countByUser ?? 0),
    create: vi.fn().mockResolvedValue(overrides.create ?? bookRow()),
    deleteOwned: vi.fn().mockResolvedValue(overrides.deleteOwned ?? 0),
    findOwnedById: vi.fn().mockResolvedValue(overrides.findOwnedById ?? null),
    listByUser: vi.fn().mockResolvedValue(overrides.listByUser ?? []),
    maxQueuePosition: vi.fn().mockResolvedValue(overrides.maxQueuePosition ?? 0),
    updateOwned: vi.fn().mockResolvedValue(overrides.updateOwned ?? bookRow()),
  };

  const authorsService = {
    materializeFromOpenLibrary: vi.fn().mockResolvedValue({ id: overrides.authorId ?? AUTHOR_ID }),
    resolveOrCreate: vi.fn().mockResolvedValue(overrides.authorId ?? AUTHOR_ID),
  };
  const publishersService = {
    resolveOrCreate: vi.fn().mockResolvedValue(overrides.publisherId ?? PUBLISHER_ID),
  };
  const tagsService = {
    resolveOrCreateMany: vi.fn().mockResolvedValue(overrides.tagIds ?? []),
  };
  const seriesService = {
    resolveForBook: vi.fn().mockResolvedValue(overrides.seriesId ?? SERIES_ID),
  };
  const listsService = {
    resolveListsForBook: vi.fn().mockResolvedValue(overrides.listIds ?? []),
  };

  const service = new BooksService(
    repository as unknown as BooksRepository,
    authorsService as unknown as AuthorsService,
    publishersService as unknown as PublishersService,
    tagsService as unknown as TagsService,
    seriesService as unknown as SeriesService,
    listsService as unknown as ListsService,
  );

  return {
    authorsService,
    listsService,
    publishersService,
    repository,
    seriesService,
    service,
    tagsService,
  };
}

function loanRow(
  overrides: Partial<NonNullable<BookWithRelations["loanInfo"]>> = {},
): BookWithRelations["loanInfo"] {
  return {
    bookId: BOOK_ID,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    expectedReturnDate: null,
    id: "88888888-8888-4888-8888-888888888881",
    loanDate: null,
    note: null,
    personName: "Olha",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  } as BookWithRelations["loanInfo"];
}

function progressRow(
  overrides: Partial<NonNullable<BookWithRelations["readingProgress"]>> = {},
): BookWithRelations["readingProgress"] {
  return {
    abandonedAt: null,
    bookId: BOOK_ID,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    currentPage: null,
    finishedAt: null,
    id: "88888888-8888-4888-8888-888888888882",
    impression: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  } as BookWithRelations["readingProgress"];
}

describe("BooksService.create", () => {
  it("resolves the author, resolves the publisher, then creates the book", async () => {
    const { authorsService, publishersService, repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      publisherName: "Penguin",
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(authorsService.resolveOrCreate).toHaveBeenCalledWith(USER_ID, {
      name: "Frank Herbert",
    });
    expect(publishersService.resolveOrCreate).toHaveBeenCalledWith(USER_ID, {
      id: undefined,
      name: "Penguin",
    });
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("returns the BookView with nested author, publisher and tags", async () => {
    const { service } = buildService({
      create: bookRow({
        tags: [
          {
            tag: {
              createdAt: new Date("2026-02-01T10:00:00.000Z"),
              id: TAG_ID,
              name: "dark academia",
              normalizedName: "dark academia",
              updatedAt: new Date("2026-02-02T11:00:00.000Z"),
              userId: USER_ID,
            },
          },
        ] as BookWithRelations["tags"],
      }),
      tagIds: [TAG_ID],
    });
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      publisherName: "Penguin",
      readingStatus: "not_started",
      tags: ["dark academia"],
      title: "Dune",
    };

    const view = await service.create(USER_ID, input);

    expect(view).toEqual({
      ageCategory: "not_specified",
      author: { id: AUTHOR_ID, name: "Frank Herbert" },
      bookType: "solo",
      createdAt: "2026-02-01T10:00:00.000Z",
      dedication: null,
      deliveryInfo: null,
      description: null,
      formats: [],
      genres: [],
      id: BOOK_ID,
      illustrator: null,
      isbn: null,
      isFavorite: false,
      isInReadingQueue: false,
      language: "ukrainian",
      lists: [],
      loanInfo: null,
      originalTitle: null,
      ownershipStatus: "none",
      pagesCount: null,
      partNumber: null,
      publicationYear: null,
      publisher: { id: PUBLISHER_ID, name: "Penguin" },
      purchaseInfo: null,
      queuePriority: null,
      readingProgress: null,
      readingStatus: "not_started",
      series: null,
      tags: [{ id: TAG_ID, name: "dark academia" }],
      title: "Dune",
      translator: null,
      updatedAt: "2026-02-02T11:00:00.000Z",
      userId: USER_ID,
    });
  });

  it("passes the resolved author, publisher and tag ids to the repository create", async () => {
    const { repository, service, tagsService } = buildService({
      authorId: AUTHOR_ID,
      publisherId: PUBLISHER_ID,
      tagIds: [TAG_ID],
    });
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "16_plus",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: ["paper", "ebook"],
      genres: ["fantasy", "science_fiction"],
      isFavorite: true,
      language: "english",
      ownershipStatus: "owned",
      readingStatus: "reading",
      tags: ["dark academia", "slow burn"],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(USER_ID, [
      "dark academia",
      "slow burn",
    ]);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, {
      ageCategory: "16_plus",
      authorId: AUTHOR_ID,
      dedication: null,
      deliveryInfo: null,
      description: null,
      formats: ["paper", "ebook"],
      genres: ["fantasy", "science_fiction"],
      illustrator: null,
      isbn: null,
      isFavorite: true,
      language: "english",
      listIds: [],
      loanInfo: null,
      originalTitle: null,
      ownershipStatus: "owned",
      pagesCount: null,
      partNumber: null,
      publicationYear: null,
      publisherId: PUBLISHER_ID,
      purchaseInfo: null,
      queuePosition: null,
      queuePriority: null,
      readingProgress: null,
      readingStatus: "reading",
      seriesId: null,
      tagIds: [TAG_ID],
      title: "Dune",
      translator: null,
    });
  });

  it("builds a reading-progress payload for a reading book and passes it to the repository", async () => {
    const { repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      readingProgress: { currentPage: 42, note: "great so far", startedAt: "2026-02-01" },
      readingStatus: "reading",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        readingProgress: {
          abandonedAt: null,
          currentPage: 42,
          finishedAt: null,
          impression: null,
          note: "great so far",
          pausedAt: null,
          rating: null,
          startedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      }),
    );
  });

  it("does not build a reading-progress payload when the status does not use one", async () => {
    const { repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      readingProgress: { currentPage: 42, startedAt: "2026-02-01" },
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ readingProgress: null }),
    );
  });

  it("builds purchase info for a want_to_buy book and ignores delivery and loan blocks", async () => {
    const { repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      deliveryInfo: { storeName: "Should be ignored" },
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        deliveryInfo: null,
        loanInfo: null,
        purchaseInfo: {
          currency: "UAH",
          expectedPrice: 299.99,
          note: null,
          storeName: "Yakaboo",
          storeUrl: null,
        },
      }),
    );
  });

  it("defaults the delivery status to ordered for an in_transit book without one", async () => {
    const { repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      deliveryInfo: { orderNumber: "TTN-1", storeName: "Yakaboo" },
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "in_transit",
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        deliveryInfo: {
          deliveryStatus: "ordered",
          expectedDeliveryDate: null,
          note: null,
          orderDate: null,
          orderNumber: "TTN-1",
          storeName: "Yakaboo",
        },
        purchaseInfo: null,
      }),
    );
  });

  it("builds loan info for a lent_to_someone book", async () => {
    const { repository, service } = buildService();
    const input: CreateBookInput = {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
      ownershipStatus: "lent_to_someone",
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
    };

    await service.create(USER_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        deliveryInfo: null,
        loanInfo: {
          expectedReturnDate: null,
          loanDate: new Date("2026-02-01T00:00:00.000Z"),
          note: null,
          personName: "Olha",
        },
        purchaseInfo: null,
      }),
    );
  });
});

describe("BooksService.create organization", () => {
  function organizationInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
    return {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Frank Herbert" },
      bookType: "solo",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      readingStatus: "not_started",
      tags: [],
      title: "Dune",
      ...overrides,
    };
  }

  it("stores null queue fields when the book is not added to the queue", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, organizationInput({ addToReadingQueue: false }));

    expect(repository.maxQueuePosition).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ queuePosition: null, queuePriority: null }),
    );
  });

  it("defaults the queue priority to normal and appends to the end of an empty queue", async () => {
    const { repository, service } = buildService({ maxQueuePosition: 0 });

    await service.create(USER_ID, organizationInput({ addToReadingQueue: true }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ queuePosition: 1, queuePriority: "normal" }),
    );
  });

  it("appends after the last queued book and keeps the provided priority", async () => {
    const { repository, service } = buildService({ maxQueuePosition: 4 });

    await service.create(
      USER_ID,
      organizationInput({ addToReadingQueue: true, queuePriority: "high" }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ queuePosition: 5, queuePriority: "high" }),
    );
  });

  it("does not enqueue a want_to_read book when addToReadingQueue is false", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      organizationInput({ addToReadingQueue: false, readingStatus: "want_to_read" }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ queuePosition: null, queuePriority: null }),
    );
  });

  it("resolves the lists for the book and passes the ids to the repository", async () => {
    const { listsService, repository, service } = buildService({ listIds: [LIST_ID] });

    await service.create(
      USER_ID,
      organizationInput({ listIds: [LIST_ID], newLists: [{ name: "Autumn reads" }] }),
    );

    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(USER_ID, {
      listIds: [LIST_ID],
      newLists: [{ name: "Autumn reads" }],
    });
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ listIds: [LIST_ID] }),
    );
  });
});

describe("BooksService.create series handling", () => {
  function seriesPartInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
    return {
      addToReadingQueue: false,
      ageCategory: "not_specified",
      author: { name: "Sarah J. Maas" },
      bookType: "series_part",
      formats: [],
      genres: [],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "none",
      partNumber: 1,
      readingStatus: "not_started",
      tags: [],
      title: "Throne of Glass",
      ...overrides,
    };
  }

  it("does not resolve a series and stores null series fields for a solo book", async () => {
    const { repository, seriesService, service } = buildService();

    await service.create(
      USER_ID,
      seriesPartInput({
        bookType: "solo",
        newSeries: { name: "Ignored Series", status: "unknown" },
        partNumber: 5,
      }),
    );

    expect(seriesService.resolveForBook).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ partNumber: null, seriesId: null }),
    );
  });

  it("resolves a new series and stores the resolved id and part number", async () => {
    const { repository, seriesService, service } = buildService({ seriesId: SERIES_ID });

    await service.create(
      USER_ID,
      seriesPartInput({
        newSeries: { name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
        partNumber: 1,
      }),
    );

    expect(seriesService.resolveForBook).toHaveBeenCalledWith(USER_ID, {
      newSeries: { name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
      seriesId: undefined,
    });
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ partNumber: 1, seriesId: SERIES_ID }),
    );
  });

  it("resolves an existing series by id and stores it on the book", async () => {
    const { repository, seriesService, service } = buildService({ seriesId: SERIES_ID });

    await service.create(USER_ID, seriesPartInput({ partNumber: 2, seriesId: SERIES_ID }));

    expect(seriesService.resolveForBook).toHaveBeenCalledWith(USER_ID, {
      newSeries: undefined,
      seriesId: SERIES_ID,
    });
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ partNumber: 2, seriesId: SERIES_ID }),
    );
  });

  it("maps a series-linked book to a series_part view with the nested series", async () => {
    const { service } = buildService({
      create: bookRow({
        partNumber: 1,
        series: {
          createdAt: new Date("2026-02-01T10:00:00.000Z"),
          description: "YA fantasy saga",
          id: SERIES_ID,
          name: "Throne of Glass",
          normalizedName: "throne of glass",
          status: "ongoing",
          totalBooks: 3,
          updatedAt: new Date("2026-02-02T11:00:00.000Z"),
          userId: USER_ID,
        },
        seriesId: SERIES_ID,
      }),
      seriesId: SERIES_ID,
    });

    const view = await service.create(
      USER_ID,
      seriesPartInput({
        newSeries: { name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
      }),
    );

    expect(view.bookType).toBe("series_part");
    expect(view.partNumber).toBe(1);
    expect(view.series).toEqual({
      description: "YA fantasy saga",
      id: SERIES_ID,
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });
  });
});

describe("BooksService.getById", () => {
  it("returns the mapped view when the book is owned by the caller", async () => {
    const { service } = buildService({ findOwnedById: bookRow({ userId: USER_ID }) });

    await expect(service.getById(USER_ID, BOOK_ID)).resolves.toMatchObject({ id: BOOK_ID });
  });

  it("throws NotFoundError when the book does not belong to the caller", async () => {
    const { service } = buildService({ findOwnedById: null });

    await expect(service.getById(OTHER_USER_ID, BOOK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("BooksService.delete", () => {
  it("throws NotFoundError when no owned book matched the delete", async () => {
    const { service } = buildService({ deleteOwned: 0 });

    await expect(service.delete(OTHER_USER_ID, BOOK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes the book scoped to the caller when it is owned", async () => {
    const { repository, service } = buildService({ deleteOwned: 1 });

    await service.delete(USER_ID, BOOK_ID);

    expect(repository.deleteOwned).toHaveBeenCalledWith(USER_ID, BOOK_ID);
  });
});

describe("BooksService.list", () => {
  it("maps the page to a Paginator of BookView with the correct counts", async () => {
    const { service } = buildService({
      countByUser: 3,
      listByUser: [bookRow({ id: BOOK_ID })],
    });

    const page = await service.list(USER_ID, {
      pageNumber: 1,
      pageSize: 2,
      sortDirection: "desc",
    });

    expect(page).toMatchObject({
      page: 1,
      pagesCount: 2,
      pageSize: 2,
      totalCount: 3,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(BOOK_ID);
  });
});

function updateDataFromFirstCall(repository: Repository): UpdateBookData {
  const call = repository.updateOwned.mock.calls.at(0);
  if (call === undefined) {
    throw new Error("updateOwned was not called");
  }
  return call[2] as UpdateBookData;
}

describe("BooksService.update", () => {
  it("throws NotFoundError when the book does not belong to the caller", async () => {
    const { repository, service } = buildService({ findOwnedById: null });

    await expect(service.update(OTHER_USER_ID, BOOK_ID, { title: "New" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("assigns only the provided scalar fields and leaves the rest untouched", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("passes through an explicit null to clear a nullable scalar field", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { dedication: null });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ dedication: null });
  });

  it("resolves a custom author by name and connects it on the update fields", async () => {
    const { authorsService, repository, service } = buildService({
      authorId: AUTHOR_ID,
      findOwnedById: bookRow(),
    });

    await service.update(USER_ID, BOOK_ID, { author: { name: "Ursula K. Le Guin" } });

    expect(authorsService.resolveOrCreate).toHaveBeenCalledWith(USER_ID, {
      name: "Ursula K. Le Guin",
    });
    const data = updateDataFromFirstCall(repository);
    expect(data.fields.authorId).toBe(AUTHOR_ID);
  });

  it("materializes an open library author when the reference is a key", async () => {
    const { authorsService, repository, service } = buildService({
      authorId: AUTHOR_ID,
      findOwnedById: bookRow(),
    });

    await service.update(USER_ID, BOOK_ID, { author: { openLibraryKey: "OL23919A" } });

    expect(authorsService.materializeFromOpenLibrary).toHaveBeenCalledWith("OL23919A");
    const data = updateDataFromFirstCall(repository);
    expect(data.fields.authorId).toBe(AUTHOR_ID);
  });

  it("disconnects the publisher when the resolver returns null", async () => {
    const { publishersService, repository, service } = buildService({ findOwnedById: bookRow() });
    publishersService.resolveOrCreate.mockResolvedValue(null);

    await service.update(USER_ID, BOOK_ID, { publisherName: "Vivat" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields.publisherId).toBeNull();
  });

  it("connects the publisher when the resolver returns an id", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { publisherName: "Vivat" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields.publisherId).toBe(PUBLISHER_ID);
  });

  it("passes the resolved tag ids to the repository when tags are provided", async () => {
    const { repository, service, tagsService } = buildService({
      findOwnedById: bookRow(),
      tagIds: [TAG_ID],
    });

    await service.update(USER_ID, BOOK_ID, { tags: ["dark academia"] });

    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(USER_ID, ["dark academia"]);
    const data = updateDataFromFirstCall(repository);
    expect(data.tagIds).toEqual([TAG_ID]);
  });

  it("leaves tagIds undefined so the repository keeps the existing tags when tags are absent", async () => {
    const { repository, service, tagsService } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    expect(tagsService.resolveOrCreateMany).not.toHaveBeenCalled();
    const data = updateDataFromFirstCall(repository);
    expect(data.tagIds).toBeUndefined();
  });

  it("resolves the lists and passes the ids when listIds are provided", async () => {
    const { listsService, repository, service } = buildService({
      findOwnedById: bookRow(),
      listIds: [LIST_ID],
    });

    await service.update(USER_ID, BOOK_ID, { listIds: [LIST_ID] });

    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(USER_ID, {
      listIds: [LIST_ID],
      newLists: undefined,
    });
    const data = updateDataFromFirstCall(repository);
    expect(data.listIds).toEqual([LIST_ID]);
  });

  it("deletes the loan block when ownership moves away from a loan status", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ ownershipStatus: "borrowed_from_someone" }),
    });

    await service.update(USER_ID, BOOK_ID, { ownershipStatus: "owned" });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toEqual({ delete: true });
  });

  it("builds the purchase block when ownership becomes want_to_buy", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, {
      ownershipStatus: "want_to_buy",
      purchaseInfo: { storeName: "Yakaboo" },
    });

    const data = updateDataFromFirstCall(repository);
    expect(data.purchaseInfo).toEqual({
      create: {
        currency: null,
        expectedPrice: null,
        note: null,
        storeName: "Yakaboo",
        storeUrl: null,
      },
      update: {
        currency: undefined,
        expectedPrice: undefined,
        note: undefined,
        storeName: "Yakaboo",
        storeUrl: undefined,
      },
    });
  });

  it("builds the reading-progress block when the status becomes reading", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, {
      readingProgress: { currentPage: 30 },
      readingStatus: "reading",
    });

    const data = updateDataFromFirstCall(repository);
    expect(data.readingProgress).toMatchObject({
      create: { currentPage: 30 },
      update: { currentPage: 30 },
    });
  });

  it("uses the stored reading status when validating current page so a payload-only page is checked against the db pages", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({ pagesCount: 100, readingStatus: "reading" }),
    });

    const input: UpdateBookInput = { readingProgress: { currentPage: 150 } };

    await expect(service.update(USER_ID, BOOK_ID, input)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("merges the payload page against the stored pages count for the cross-field check", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 100,
        readingProgress: {
          abandonedAt: null,
          bookId: BOOK_ID,
          createdAt: new Date("2026-02-01T10:00:00.000Z"),
          currentPage: 150,
          finishedAt: null,
          id: "88888888-8888-4888-8888-888888888888",
          impression: null,
          note: null,
          pausedAt: null,
          rating: null,
          startedAt: null,
          updatedAt: new Date("2026-02-01T10:00:00.000Z"),
        } as BookWithRelations["readingProgress"],
        readingStatus: "reading",
      }),
    });

    await expect(service.update(USER_ID, BOOK_ID, { pagesCount: 120 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("does not run the page check when the merged status does not use reading progress", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ pagesCount: 100, readingStatus: "not_started" }),
    });

    await service.update(USER_ID, BOOK_ID, { pagesCount: 50 });

    expect(repository.updateOwned).toHaveBeenCalledTimes(1);
  });

  it("disconnects the series and clears the part number when the book becomes solo", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { bookType: "solo" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields.seriesId).toBeNull();
    expect(data.fields.partNumber).toBeNull();
  });

  it("returns the mapped view from the reread row", async () => {
    const { service } = buildService({
      findOwnedById: bookRow(),
      updateOwned: bookRow({ title: "Updated Title" }),
    });

    const view = await service.update(USER_ID, BOOK_ID, { title: "Updated Title" });

    expect(view).toMatchObject({ id: BOOK_ID, title: "Updated Title" });
  });

  it("emits a partial loan update that omits absent sub-fields and carries only the provided one", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loanInfo: loanRow({ note: null, personName: "Olha" }),
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { loanInfo: { note: "return next week" } });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toEqual({
      create: {
        expectedReturnDate: null,
        loanDate: null,
        note: "return next week",
        personName: "",
      },
      update: {
        expectedReturnDate: undefined,
        loanDate: undefined,
        note: "return next week",
        personName: undefined,
      },
    });
  });

  it("emits an explicit null in the partial loan update so a sub-field is cleared", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loanInfo: loanRow({ note: "old note", personName: "Olha" }),
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { loanInfo: { note: null } });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toMatchObject({ update: { note: null, personName: undefined } });
  });

  it("emits a partial reading-progress update that preserves untouched sub-fields", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 400,
        readingProgress: progressRow({ currentPage: 10, rating: 4 }),
        readingStatus: "reading",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { readingProgress: { currentPage: 50 } });

    const data = updateDataFromFirstCall(repository);
    expect(data.readingProgress).toMatchObject({
      update: { currentPage: 50, rating: undefined, startedAt: undefined },
    });
  });

  it("allows a status-only switch between loan statuses when a loan row already has a person name", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loanInfo: loanRow({ personName: "Olha" }),
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { ownershipStatus: "lent_to_someone" });

    expect(repository.updateOwned).toHaveBeenCalledTimes(1);
  });

  it("rejects a switch to a loan status when neither payload nor existing row has a person name", async () => {
    const { service } = buildService({ findOwnedById: bookRow() });

    await expect(
      service.update(USER_ID, BOOK_ID, { ownershipStatus: "borrowed_from_someone" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("rejects lowering the page count below a stored current page", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 300,
        readingProgress: progressRow({ currentPage: 250 }),
        readingStatus: "reading",
      }),
    });

    await expect(service.update(USER_ID, BOOK_ID, { pagesCount: 200 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
