import type { CreateBookInput, FavoritesSummaryView, UpdateBookInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { GenresService } from "../../genres/application/genres.service.js";
import type { MediaService } from "../../media/application/media.service.js";
import type {
  BooksRepository,
  BookWithRelations,
  UpdateBookData,
} from "../infrastructure/books.repository.js";
import type {
  BookRelationsResolver,
  ResolvedBookCreate,
  ResolvedBookUpdate,
} from "./book-relations-resolver.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { BooksService } from "./books.service.js";

const TX = {} as unknown as Prisma.TransactionClient;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID_B = "33333333-3333-4333-8333-333333333334";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";
const TAG_ID = "55555555-5555-4555-8555-555555555555";
const SERIES_ID = "66666666-6666-4666-8666-666666666666";
const LIST_ID = "77777777-7777-4777-8777-777777777777";
const MEDIA_ID = "88888888-8888-4888-8888-888888888801";

type Repository = {
  countForLibrary: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  deleteOwned: ReturnType<typeof vi.fn>;
  favoritesSummary: ReturnType<typeof vi.fn>;
  findOwnedById: ReturnType<typeof vi.fn>;
  listForLibrary: ReturnType<typeof vi.fn>;
  recentPurchaseStores: ReturnType<typeof vi.fn>;
  updateOwned: ReturnType<typeof vi.fn>;
};

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    ageCategory: "not_specified",
    authors: [
      {
        author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
        authorId: AUTHOR_ID,
        bookId: BOOK_ID,
        position: 0,
      },
    ] as BookWithRelations["authors"],
    coverMedia: null,
    coverMediaId: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dedication: null,
    deliveries: [],
    description: null,
    favoriteAddedAt: null,
    firstAuthorName: "Frank Herbert",
    formats: [],
    genres: [],
    id: BOOK_ID,
    illustrator: null,
    isbn: null,
    isFavorite: false,
    language: "ukrainian",
    lists: [],
    loans: [],
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
    countForLibrary?: number;
    create?: BookWithRelations;
    deleteOwned?: number;
    favoritesSummary?: FavoritesSummaryView;
    findOwnedById?: BookWithRelations | null;
    listForLibrary?: BookWithRelations[];
    recentPurchaseStores?: string[];
    updateOwned?: BookWithRelations;
  } = {},
): {
  coverCleanup: { deleteIfOrphaned: ReturnType<typeof vi.fn> };
  genresService: {
    findNamesByKeys: ReturnType<typeof vi.fn>;
    searchKeys: ReturnType<typeof vi.fn>;
  };
  relationsResolver: {
    mapSeriesPartNumberWriteError: ReturnType<typeof vi.fn>;
    resolveForCreate: ReturnType<typeof vi.fn>;
    resolveForUpdate: ReturnType<typeof vi.fn>;
  };
  repository: Repository;
  service: BooksService;
} {
  const repository: Repository = {
    countForLibrary: vi.fn().mockResolvedValue(overrides.countForLibrary ?? 0),
    create: vi.fn().mockResolvedValue(overrides.create ?? bookRow()),
    deleteOwned: vi.fn().mockResolvedValue(overrides.deleteOwned ?? 0),
    favoritesSummary: vi
      .fn()
      .mockResolvedValue(
        overrides.favoritesSummary ?? { averageRating: null, finished: 0, reading: 0, total: 0 },
      ),
    findOwnedById: vi.fn().mockResolvedValue(overrides.findOwnedById ?? null),
    listForLibrary: vi.fn().mockResolvedValue(overrides.listForLibrary ?? []),
    recentPurchaseStores: vi.fn().mockResolvedValue(overrides.recentPurchaseStores ?? []),
    updateOwned: vi.fn().mockResolvedValue(overrides.updateOwned ?? bookRow()),
  };

  const relationsResolver = {
    mapSeriesPartNumberWriteError: vi
      .fn()
      .mockImplementation(({ error }: { error: unknown }) => Promise.resolve(error)),
    resolveForCreate: vi.fn().mockResolvedValue(resolvedCreate()),
    resolveForUpdate: vi.fn().mockResolvedValue(resolvedUpdate()),
  };

  const mediaService = { buildView: vi.fn() };
  const viewAssembler = new BookViewAssembler(
    repository as unknown as BooksRepository,
    mediaService as unknown as MediaService,
  );
  const coverCleanup = { deleteIfOrphaned: vi.fn().mockResolvedValue(undefined) };
  const genresService = {
    findNamesByKeys: vi.fn().mockResolvedValue([]),
    searchKeys: vi.fn().mockResolvedValue([]),
  };
  const transactionRunner = {
    run: vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(TX)),
  };

  const service = new BooksService(
    repository as unknown as BooksRepository,
    relationsResolver as unknown as BookRelationsResolver,
    viewAssembler,
    coverCleanup as unknown as BookCoverCleanup,
    genresService as unknown as GenresService,
    transactionRunner as unknown as TransactionRunner,
  );

  return { coverCleanup, genresService, relationsResolver, repository, service };
}

function loanRow(
  overrides: Partial<BookWithRelations["loans"][number]> = {},
): BookWithRelations["loans"][number] {
  return {
    bookId: BOOK_ID,
    contact: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    expectedReturnDate: null,
    id: "88888888-8888-4888-8888-888888888881",
    loanDate: null,
    note: null,
    personName: "Olha",
    remindToReturn: false,
    returnedAt: null,
    status: "active",
    type: "borrowed_from_someone",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  } as BookWithRelations["loans"][number];
}

function minimalCreateInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
  return {
    addToReadingQueue: false,
    ageCategory: "not_specified",
    authors: [{ name: "Frank Herbert" }],
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
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  } as BookWithRelations["readingProgress"];
}

function resolvedCreate(overrides: Partial<ResolvedBookCreate> = {}): ResolvedBookCreate {
  return {
    authorIds: [AUTHOR_ID],
    firstAuthorName: "Frank Herbert",
    listIds: [],
    partNumber: null,
    publisherId: PUBLISHER_ID,
    queuePosition: null,
    queuePriority: null,
    seriesId: null,
    tagIds: [],
    ...overrides,
  };
}

function resolvedUpdate(overrides: Partial<ResolvedBookUpdate> = {}): ResolvedBookUpdate {
  return {
    authorIds: undefined,
    fields: {},
    listIds: undefined,
    queueRemoval: null,
    seriesPlacement: { partNumber: null, seriesId: null },
    tagIds: undefined,
    ...overrides,
  };
}

function updateDataFromFirstCall(repository: Repository): UpdateBookData {
  const call = repository.updateOwned.mock.calls.at(0);
  if (call === undefined) {
    throw new Error("updateOwned was not called");
  }
  return call[2] as UpdateBookData;
}

describe("BooksService.create", () => {
  it("delegates reference resolution to the resolver and creates the book", async () => {
    const { relationsResolver, repository, service } = buildService();
    const input = minimalCreateInput();

    await service.create(USER_ID, input);

    expect(relationsResolver.resolveForCreate).toHaveBeenCalledWith({ input, userId: USER_ID }, TX);
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("threads the resolved references into the repository create payload", async () => {
    const { relationsResolver, repository, service } = buildService();
    relationsResolver.resolveForCreate.mockResolvedValue(
      resolvedCreate({
        authorIds: [AUTHOR_ID, AUTHOR_ID_B],
        firstAuthorName: "Terry Pratchett",
        listIds: [LIST_ID],
        partNumber: 2,
        publisherId: PUBLISHER_ID,
        queuePosition: 5,
        queuePriority: "high",
        seriesId: SERIES_ID,
        tagIds: [TAG_ID],
      }),
    );

    await service.create(USER_ID, minimalCreateInput({ coverMediaId: MEDIA_ID }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        authorIds: [AUTHOR_ID, AUTHOR_ID_B],
        coverMediaId: MEDIA_ID,
        firstAuthorName: "Terry Pratchett",
        listIds: [LIST_ID],
        partNumber: 2,
        publisherId: PUBLISHER_ID,
        queuePosition: 5,
        queuePriority: "high",
        seriesId: SERIES_ID,
        tagIds: [TAG_ID],
      }),
      TX,
    );
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
    });

    const view = await service.create(USER_ID, minimalCreateInput({ tags: ["dark academia"] }));

    expect(view).toEqual({
      ageCategory: "not_specified",
      authors: [{ id: AUTHOR_ID, name: "Frank Herbert" }],
      bookType: "solo",
      cover: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      dedication: null,
      delivery: { active: null, latest: null, totalCount: 0 },
      description: null,
      favoriteAddedAt: null,
      formats: [],
      genres: [],
      hasUnreadEarlierSeriesParts: null,
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

  it("builds a reading-progress payload for a reading book and passes it to the repository", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        readingProgress: { currentPage: 42, note: "great so far", startedAt: "2026-02-01" },
        readingStatus: "reading",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        readingProgress: {
          abandonedAt: null,
          currentPage: 42,
          finishedAt: null,
          impression: null,
          lastProgressUpdateAt: null,
          note: "great so far",
          pausedAt: null,
          rating: null,
          startedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      }),
      TX,
    );
  });

  it("does not build a reading-progress payload when the status does not use one", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        readingProgress: { currentPage: 42, startedAt: "2026-02-01" },
        readingStatus: "not_started",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ readingProgress: null }),
      TX,
    );
  });

  it("builds purchase info for a want_to_buy book and ignores delivery and loan blocks", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        deliveryInfo: { storeName: "Should be ignored" },
        ownershipStatus: "want_to_buy",
        purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      }),
    );

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
      TX,
    );
  });

  it("defaults the delivery status to ordered for an in_transit book without one", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        deliveryInfo: { orderNumber: "TTN-1", storeName: "Yakaboo" },
        ownershipStatus: "in_transit",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        deliveryInfo: {
          currency: null,
          deliveryService: null,
          expectedDeliveryDate: null,
          note: null,
          orderDate: null,
          orderNumber: "TTN-1",
          price: null,
          status: "ordered",
          storeName: "Yakaboo",
          trackingNumber: null,
          trackingUrl: null,
        },
        purchaseInfo: null,
      }),
      TX,
    );
  });

  it("builds loan info for a lent_to_someone book", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
        ownershipStatus: "lent_to_someone",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        deliveryInfo: null,
        loanInfo: {
          contact: null,
          expectedReturnDate: null,
          loanDate: new Date("2026-02-01T00:00:00.000Z"),
          note: null,
          personName: "Olha",
          remindToReturn: false,
        },
        purchaseInfo: null,
      }),
      TX,
    );
  });

  it("passes the input cover media id to the repository create", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ coverMediaId: MEDIA_ID }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ coverMediaId: MEDIA_ID }),
      TX,
    );
  });

  it("stamps favoriteAddedAt when the book is created as a favorite", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ isFavorite: true }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ favoriteAddedAt: expect.any(Date), isFavorite: true }),
      TX,
    );
  });

  it("leaves favoriteAddedAt null when the book is created as a non-favorite", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ isFavorite: false }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ favoriteAddedAt: null, isFavorite: false }),
      TX,
    );
  });

  it("propagates a resolver rejection and does not create the book", async () => {
    const { relationsResolver, repository, service } = buildService();
    relationsResolver.resolveForCreate.mockRejectedValue(new BadRequestError("Invalid genres"));

    await expect(service.create(USER_ID, minimalCreateInput())).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("throws the error mapped by the resolver when the repository create raises", async () => {
    const { relationsResolver, repository, service } = buildService();
    const original = new Error("write failed");
    const mapped = new BadRequestError("Duplicate part number");
    relationsResolver.resolveForCreate.mockResolvedValue(
      resolvedCreate({ partNumber: 2, seriesId: SERIES_ID }),
    );
    relationsResolver.mapSeriesPartNumberWriteError.mockResolvedValue(mapped);
    repository.create.mockRejectedValue(original);

    await expect(service.create(USER_ID, minimalCreateInput())).rejects.toBe(mapped);
    expect(relationsResolver.mapSeriesPartNumberWriteError).toHaveBeenCalledWith({
      error: original,
      excludeBookId: null,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
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
    const { service } = buildService({ findOwnedById: null });

    await expect(service.delete(OTHER_USER_ID, BOOK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes the book scoped to the caller when it is owned", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.delete(USER_ID, BOOK_ID);

    expect(repository.deleteOwned).toHaveBeenCalledWith(USER_ID, BOOK_ID);
  });

  it("delegates cover cleanup for the deleted book cover", async () => {
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: MEDIA_ID }),
    });

    await service.delete(USER_ID, BOOK_ID);

    expect(coverCleanup.deleteIfOrphaned).toHaveBeenCalledWith({
      mediaId: MEDIA_ID,
      userId: USER_ID,
    });
  });

  it("does not run cover cleanup when the deleted book had no cover", async () => {
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: null }),
    });

    await service.delete(USER_ID, BOOK_ID);

    expect(coverCleanup.deleteIfOrphaned).not.toHaveBeenCalled();
  });
});

describe("BooksService cover replacement on update", () => {
  it("delegates cover cleanup for the previous cover when it is replaced", async () => {
    const previousCoverMediaId = "88888888-8888-4888-8888-888888888802";
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: previousCoverMediaId }),
      updateOwned: bookRow({ coverMediaId: MEDIA_ID }),
    });

    await service.update(USER_ID, BOOK_ID, { coverMediaId: MEDIA_ID });

    expect(coverCleanup.deleteIfOrphaned).toHaveBeenCalledWith({
      mediaId: previousCoverMediaId,
      userId: USER_ID,
    });
  });

  it("does not run cover cleanup when the cover is unchanged", async () => {
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: null }),
      updateOwned: bookRow(),
    });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    expect(coverCleanup.deleteIfOrphaned).not.toHaveBeenCalled();
  });
});

describe("BooksService.list", () => {
  it("maps the page to a Paginator of BookView with the correct counts", async () => {
    const { service } = buildService({
      countForLibrary: 3,
      listForLibrary: [bookRow({ id: BOOK_ID })],
    });

    const page = await service.list(USER_ID, {
      pageNumber: 1,
      pageSize: 2,
      sort: "created_desc",
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

  it("ignores a single-character query and runs no search", async () => {
    const { genresService, repository, service } = buildService({ listForLibrary: [bookRow()] });

    await service.list(USER_ID, { pageNumber: 1, pageSize: 20, q: "a", sort: "created_desc" });

    expect(genresService.searchKeys).not.toHaveBeenCalled();
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: undefined }) }),
    );
  });

  it("keeps a single-digit query so the ISBN search still applies", async () => {
    const { genresService, repository, service } = buildService({ listForLibrary: [bookRow()] });

    await service.list(USER_ID, { pageNumber: 1, pageSize: 20, q: "9", sort: "created_desc" });

    expect(genresService.searchKeys).toHaveBeenCalledWith({ query: "9", userId: USER_ID });
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: "9" }) }),
    );
  });

  it("applies the search for a query of at least two characters", async () => {
    const { genresService, repository, service } = buildService({ listForLibrary: [bookRow()] });

    await service.list(USER_ID, { pageNumber: 1, pageSize: 20, q: "ab", sort: "created_desc" });

    expect(genresService.searchKeys).toHaveBeenCalledWith({ query: "ab", userId: USER_ID });
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: "ab" }) }),
    );
  });
});

describe("BooksService.update", () => {
  it("throws NotFoundError when the book does not belong to the caller", async () => {
    const { repository, service } = buildService({ findOwnedById: null });

    await expect(service.update(OTHER_USER_ID, BOOK_ID, { title: "New" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("assigns only the provided scalar fields on top of the resolver field patch", async () => {
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

  it("stamps favoriteAddedAt when the book becomes a favorite", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ favoriteAddedAt: null, isFavorite: false }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ favoriteAddedAt: expect.any(Date), isFavorite: true });
  });

  it("clears favoriteAddedAt when the book stops being a favorite", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: false });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ favoriteAddedAt: null, isFavorite: false });
  });

  it("leaves favoriteAddedAt untouched when an already-favorite book is edited", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true, title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("does not touch favorite fields when isFavorite is omitted", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("threads the resolver output into the repository update payload", async () => {
    const { relationsResolver, repository, service } = buildService({ findOwnedById: bookRow() });
    relationsResolver.resolveForUpdate.mockResolvedValue(
      resolvedUpdate({
        authorIds: [AUTHOR_ID_B],
        fields: { firstAuthorName: "Ursula K. Le Guin", publisherId: PUBLISHER_ID },
        listIds: [LIST_ID],
        tagIds: [TAG_ID],
      }),
    );

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.authorIds).toEqual([AUTHOR_ID_B]);
    expect(data.tagIds).toEqual([TAG_ID]);
    expect(data.listIds).toEqual([LIST_ID]);
    expect(data.fields).toMatchObject({
      firstAuthorName: "Ursula K. Le Guin",
      publisherId: PUBLISHER_ID,
      title: "Renamed",
    });
  });

  it("marks the loan block returned when ownership moves away from a loan status", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ ownershipStatus: "borrowed_from_someone" }),
    });

    await service.update(USER_ID, BOOK_ID, { ownershipStatus: "owned" });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toMatchObject({ kind: "return" });
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
        readingProgress: progressRow({ currentPage: 150 }),
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
        loans: [loanRow({ note: null, personName: "Olha" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { loanInfo: { note: "return next week" } });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toEqual({
      create: {
        contact: null,
        expectedReturnDate: null,
        loanDate: null,
        note: "return next week",
        personName: "",
        remindToReturn: false,
      },
      kind: "upsertActive",
      type: "borrowed_from_someone",
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
        loans: [loanRow({ note: "old note", personName: "Olha" })],
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
        loans: [loanRow({ personName: "Olha" })],
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

  it("propagates a resolver rejection and does not update the book", async () => {
    const { relationsResolver, repository, service } = buildService({ findOwnedById: bookRow() });
    relationsResolver.resolveForUpdate.mockRejectedValue(new BadRequestError("Invalid genres"));

    await expect(
      service.update(USER_ID, BOOK_ID, { genres: ["not-a-real-genre"] }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("throws the error mapped by the resolver when the repository update raises", async () => {
    const { relationsResolver, repository, service } = buildService({
      findOwnedById: bookRow({ partNumber: 3, seriesId: SERIES_ID }),
    });
    const original = new Error("write failed");
    const mapped = new BadRequestError("Duplicate part number");
    relationsResolver.resolveForUpdate.mockResolvedValue(
      resolvedUpdate({ seriesPlacement: { partNumber: 2, seriesId: SERIES_ID } }),
    );
    relationsResolver.mapSeriesPartNumberWriteError.mockResolvedValue(mapped);
    repository.updateOwned.mockRejectedValue(original);

    await expect(
      service.update(USER_ID, BOOK_ID, { partNumber: 2 } as UpdateBookInput),
    ).rejects.toBe(mapped);
    expect(relationsResolver.mapSeriesPartNumberWriteError).toHaveBeenCalledWith({
      error: original,
      excludeBookId: BOOK_ID,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });
  });
});

describe("BooksService.recentPurchaseStores", () => {
  it("returns the store names produced by the repository", async () => {
    const { service } = buildService({ recentPurchaseStores: ["Yakaboo", "Knyharnya Ye"] });

    const result = await service.recentPurchaseStores({ limit: 8, userId: USER_ID });

    expect(result).toEqual(["Yakaboo", "Knyharnya Ye"]);
  });

  it("returns an empty array when the user has no purchase stores", async () => {
    const { service } = buildService({ recentPurchaseStores: [] });

    const result = await service.recentPurchaseStores({ limit: 8, userId: USER_ID });

    expect(result).toEqual([]);
  });

  it("forwards the limit and user id to the repository", async () => {
    const { repository, service } = buildService({});

    await service.recentPurchaseStores({ limit: 5, userId: USER_ID });

    expect(repository.recentPurchaseStores).toHaveBeenCalledWith({ limit: 5, userId: USER_ID });
  });
});

describe("BooksService.favoritesSummary", () => {
  it("delegates to the repository with the finished and reading status sets scoped to the user", async () => {
    const { repository, service } = buildService();

    await service.favoritesSummary(USER_ID);

    expect(repository.favoritesSummary).toHaveBeenCalledWith({
      finishedStatuses: ["finished"],
      readingStatuses: ["reading", "rereading"],
      userId: USER_ID,
    });
  });

  it("returns the summary produced by the repository", async () => {
    const { service } = buildService({
      favoritesSummary: { averageRating: 8.5, finished: 3, reading: 2, total: 7 },
    });

    const result = await service.favoritesSummary(USER_ID);

    expect(result).toEqual({ averageRating: 8.5, finished: 3, reading: 2, total: 7 });
  });

  it("passes through a null average rating when no favorite has a rating", async () => {
    const { service } = buildService({
      favoritesSummary: { averageRating: null, finished: 0, reading: 0, total: 4 },
    });

    const result = await service.favoritesSummary(USER_ID);

    expect(result.averageRating).toBeNull();
  });
});
