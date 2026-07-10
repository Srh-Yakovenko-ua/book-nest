import type { CreateBookInput, Nullable, UpdateBookInput } from "@app/shared";

import { BOOK_SERIES_PART_NUMBER_TAKEN_CODE } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthorsService } from "../../authors/application/authors.service.js";
import type { GenresService } from "../../genres/application/genres.service.js";
import type { ListsService } from "../../lists/application/lists.service.js";
import type { MediaService } from "../../media/application/media.service.js";
import type { PublishersService } from "../../publishers/application/publishers.service.js";
import type { SeriesService } from "../../series/application/series.service.js";
import type { TagsService } from "../../tags/application/tags.service.js";
import type { BooksRepository, BookWithRelations } from "../infrastructure/books.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { BookRelationsResolver, type ResolvedAuthors } from "./book-relations-resolver.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID_B = "33333333-3333-4333-8333-333333333334";
const AUTHOR_ID_C = "33333333-3333-4333-8333-333333333335";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";
const TAG_ID = "55555555-5555-4555-8555-555555555555";
const SERIES_ID = "66666666-6666-4666-8666-666666666666";
const LIST_ID = "77777777-7777-4777-8777-777777777777";
const MEDIA_ID = "88888888-8888-4888-8888-888888888801";

const DEFAULT_RESOLVED_AUTHORS: ResolvedAuthors = {
  authorIds: [AUTHOR_ID],
  firstAuthorName: "Frank Herbert",
};

type Repository = {
  findSeriesPartNumberConflict: ReturnType<typeof vi.fn>;
  maxQueuePosition: ReturnType<typeof vi.fn>;
};

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    authors: [
      {
        author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
        authorId: AUTHOR_ID,
        bookId: BOOK_ID,
        position: 0,
      },
    ] as BookWithRelations["authors"],
    coverMediaId: null,
    partNumber: null,
    queuePosition: null,
    queuePriority: null,
    series: null,
    seriesId: null,
    ...overrides,
  } as BookWithRelations;
}

function buildResolver(
  overrides: {
    authorId?: string;
    findSeriesPartNumberConflict?: Nullable<{ id: string; title: string }>;
    listIds?: string[];
    maxQueuePosition?: number;
    publisherId?: Nullable<string>;
    seriesId?: string;
    seriesTotalBooks?: Nullable<number>;
    tagIds?: string[];
  } = {},
): {
  authorsService: { resolveReferences: ReturnType<typeof vi.fn> };
  genresService: { assertGenresSelectable: ReturnType<typeof vi.fn> };
  listsService: { resolveListsForBook: ReturnType<typeof vi.fn> };
  mediaService: { assertOwned: ReturnType<typeof vi.fn> };
  publishersService: { resolveOrCreate: ReturnType<typeof vi.fn> };
  repository: Repository;
  resolver: BookRelationsResolver;
  seriesService: { resolveForBook: ReturnType<typeof vi.fn> };
  tagsService: { resolveOrCreateMany: ReturnType<typeof vi.fn> };
} {
  const repository: Repository = {
    findSeriesPartNumberConflict: vi
      .fn()
      .mockResolvedValue(overrides.findSeriesPartNumberConflict ?? null),
    maxQueuePosition: vi.fn().mockResolvedValue(overrides.maxQueuePosition ?? 0),
  };
  const authorsService = {
    resolveReferences: vi
      .fn()
      .mockResolvedValue([{ id: overrides.authorId ?? AUTHOR_ID, name: "Frank Herbert" }]),
  };
  const publishersService = {
    resolveOrCreate: vi.fn().mockResolvedValue(overrides.publisherId ?? PUBLISHER_ID),
  };
  const tagsService = {
    resolveOrCreateMany: vi.fn().mockResolvedValue(overrides.tagIds ?? []),
  };
  const seriesService = {
    resolveForBook: vi.fn().mockResolvedValue({
      id: overrides.seriesId ?? SERIES_ID,
      totalBooks: overrides.seriesTotalBooks ?? null,
    }),
  };
  const listsService = {
    resolveListsForBook: vi.fn().mockResolvedValue(overrides.listIds ?? []),
  };
  const genresService = {
    assertGenresSelectable: vi.fn().mockResolvedValue(undefined),
  };
  const mediaService = {
    assertOwned: vi.fn().mockResolvedValue(undefined),
  };

  const resolver = new BookRelationsResolver(
    repository as unknown as BooksRepository,
    authorsService as unknown as AuthorsService,
    publishersService as unknown as PublishersService,
    tagsService as unknown as TagsService,
    seriesService as unknown as SeriesService,
    listsService as unknown as ListsService,
    genresService as unknown as GenresService,
    mediaService as unknown as MediaService,
  );

  return {
    authorsService,
    genresService,
    listsService,
    mediaService,
    publishersService,
    repository,
    resolver,
    seriesService,
    tagsService,
  };
}

function createInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
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

function uniqueConstraintError(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
    meta: { target },
  });
}

describe("BookRelationsResolver.resolveAuthors", () => {
  it("resolves references into ordered ids and firstAuthorName", async () => {
    const { authorsService, resolver } = buildResolver();

    const resolved = await resolver.resolveAuthors({
      references: [{ name: "Frank Herbert" }],
      userId: USER_ID,
    });

    expect(authorsService.resolveReferences).toHaveBeenCalledWith({
      references: [{ name: "Frank Herbert" }],
      userId: USER_ID,
    });
    expect(resolved).toEqual({ authorIds: [AUTHOR_ID], firstAuthorName: "Frank Herbert" });
  });

  it("orders resolved author ids and derives firstAuthorName from the first author", async () => {
    const { authorsService, resolver } = buildResolver();
    authorsService.resolveReferences.mockResolvedValue([
      { id: AUTHOR_ID, name: "Terry Pratchett" },
      { id: AUTHOR_ID_B, name: "Neil Gaiman" },
    ]);

    const resolved = await resolver.resolveAuthors({
      references: [{ name: "Terry Pratchett" }, { name: "Neil Gaiman" }],
      userId: USER_ID,
    });

    expect(resolved.authorIds).toEqual([AUTHOR_ID, AUTHOR_ID_B]);
    expect(resolved.firstAuthorName).toBe("Terry Pratchett");
  });
});

describe("BookRelationsResolver.resolveForCreate references", () => {
  it("resolves the publisher, tags and lists with the pre-resolved authors", async () => {
    const { listsService, publishersService, resolver, tagsService } = buildResolver({
      listIds: [LIST_ID],
      tagIds: [TAG_ID],
    });

    const resolved = await resolver.resolveForCreate({
      input: createInput({
        listIds: [LIST_ID],
        newLists: [{ name: "Autumn reads" }],
        publisherName: "Penguin",
        tags: ["dark academia"],
      }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(publishersService.resolveOrCreate).toHaveBeenCalledWith(
      USER_ID,
      { id: undefined, name: "Penguin" },
      undefined,
    );
    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(
      USER_ID,
      ["dark academia"],
      undefined,
    );
    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(
      {
        input: { listIds: [LIST_ID], newLists: [{ name: "Autumn reads" }] },
        userId: USER_ID,
      },
      undefined,
    );
    expect(resolved).toMatchObject({
      authorIds: [AUTHOR_ID],
      firstAuthorName: "Frank Herbert",
      listIds: [LIST_ID],
      publisherId: PUBLISHER_ID,
      tagIds: [TAG_ID],
    });
  });

  it("passes the pre-resolved authors through to the result", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForCreate({
      input: createInput({ authors: [{ name: "Terry Pratchett" }, { name: "Neil Gaiman" }] }),
      resolvedAuthors: { authorIds: [AUTHOR_ID, AUTHOR_ID_B], firstAuthorName: "Terry Pratchett" },
      userId: USER_ID,
    });

    expect(resolved.authorIds).toEqual([AUTHOR_ID, AUTHOR_ID_B]);
    expect(resolved.firstAuthorName).toBe("Terry Pratchett");
  });

  it("validates ownership of the cover media when provided", async () => {
    const { mediaService, resolver } = buildResolver();

    await resolver.resolveForCreate({
      input: createInput({ coverMediaId: MEDIA_ID }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(mediaService.assertOwned).toHaveBeenCalledWith({ id: MEDIA_ID, userId: USER_ID });
  });

  it("asserts the genres are selectable for the caller", async () => {
    const { genresService, resolver } = buildResolver();

    await resolver.resolveForCreate({
      input: createInput({ genres: ["fentezi", "romantyka"] }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(genresService.assertGenresSelectable).toHaveBeenCalledWith(USER_ID, [
      "fentezi",
      "romantyka",
    ]);
  });

  it("propagates a genres validation rejection", async () => {
    const { genresService, resolver } = buildResolver();
    genresService.assertGenresSelectable.mockRejectedValue(new BadRequestError("Invalid genres"));

    await expect(
      resolver.resolveForCreate({
        input: createInput({ genres: ["nope"] }),
        resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("BookRelationsResolver.resolveForCreate queue placement", () => {
  it("stores null queue fields when the book is not added to the queue", async () => {
    const { repository, resolver } = buildResolver();

    const resolved = await resolver.resolveForCreate({
      input: createInput({ addToReadingQueue: false }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(repository.maxQueuePosition).not.toHaveBeenCalled();
    expect(resolved).toMatchObject({ queuePosition: null, queuePriority: null });
  });

  it("defaults the queue priority to normal and appends to the end of an empty queue", async () => {
    const { resolver } = buildResolver({ maxQueuePosition: 0 });

    const resolved = await resolver.resolveForCreate({
      input: createInput({ addToReadingQueue: true }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(resolved).toMatchObject({ queuePosition: 1, queuePriority: "normal" });
  });

  it("appends after the last queued book and keeps the provided priority", async () => {
    const { resolver } = buildResolver({ maxQueuePosition: 4 });

    const resolved = await resolver.resolveForCreate({
      input: createInput({ addToReadingQueue: true, queuePriority: "high" }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(resolved).toMatchObject({ queuePosition: 5, queuePriority: "high" });
  });
});

describe("BookRelationsResolver.resolveForCreate series handling", () => {
  function seriesPartInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
    return createInput({
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      title: "Throne of Glass",
      ...overrides,
    });
  }

  it("does not resolve a series and stores null series fields for a solo book", async () => {
    const { resolver, seriesService } = buildResolver();

    const resolved = await resolver.resolveForCreate({
      input: seriesPartInput({ bookType: "solo", partNumber: 5 }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(seriesService.resolveForBook).not.toHaveBeenCalled();
    expect(resolved).toMatchObject({ partNumber: null, seriesId: null });
  });

  it("resolves a new series and stores the resolved id and part number", async () => {
    const { resolver, seriesService } = buildResolver({ seriesId: SERIES_ID });

    const resolved = await resolver.resolveForCreate({
      input: seriesPartInput({
        newSeries: { genres: [], name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
        partNumber: 1,
      }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(seriesService.resolveForBook).toHaveBeenCalledWith(
      {
        fallbackAuthorIds: [AUTHOR_ID],
        newSeries: { genres: [], name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
        seriesId: undefined,
        userId: USER_ID,
      },
      undefined,
    );
    expect(resolved).toMatchObject({ partNumber: 1, seriesId: SERIES_ID });
  });

  it("resolves an existing series by id", async () => {
    const { resolver, seriesService } = buildResolver({ seriesId: SERIES_ID });

    const resolved = await resolver.resolveForCreate({
      input: seriesPartInput({ partNumber: 2, seriesId: SERIES_ID }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(seriesService.resolveForBook).toHaveBeenCalledWith(
      {
        fallbackAuthorIds: [AUTHOR_ID],
        newSeries: undefined,
        seriesId: SERIES_ID,
        userId: USER_ID,
      },
      undefined,
    );
    expect(resolved).toMatchObject({ partNumber: 2, seriesId: SERIES_ID });
  });

  it("checks the series for a duplicate part number excluding nothing", async () => {
    const { repository, resolver } = buildResolver({ seriesId: SERIES_ID });

    await resolver.resolveForCreate({
      input: seriesPartInput({ partNumber: 2, seriesId: SERIES_ID }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(repository.findSeriesPartNumberConflict).toHaveBeenCalledWith(
      USER_ID,
      {
        excludeBookId: null,
        partNumber: 2,
        seriesId: SERIES_ID,
      },
      undefined,
    );
  });

  it("rejects a book whose part number is already used in the series", async () => {
    const { resolver } = buildResolver({
      findSeriesPartNumberConflict: { id: BOOK_ID, title: "Iron Flame" },
      seriesId: SERIES_ID,
    });

    await expect(
      resolver.resolveForCreate({
        input: seriesPartInput({ partNumber: 2, seriesId: SERIES_ID }),
        resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("does not check the series for a solo book", async () => {
    const { repository, resolver } = buildResolver();

    await resolver.resolveForCreate({
      input: seriesPartInput({ bookType: "solo", partNumber: 1 }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(repository.findSeriesPartNumberConflict).not.toHaveBeenCalled();
  });

  it("rejects a part number that exceeds the existing series total books", async () => {
    const { resolver } = buildResolver({ seriesId: SERIES_ID, seriesTotalBooks: 2 });

    await expect(
      resolver.resolveForCreate({
        input: seriesPartInput({ partNumber: 3, seriesId: SERIES_ID }),
        resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("accepts a part number equal to the existing series total books", async () => {
    const { resolver } = buildResolver({ seriesId: SERIES_ID, seriesTotalBooks: 2 });

    const resolved = await resolver.resolveForCreate({
      input: seriesPartInput({ partNumber: 2, seriesId: SERIES_ID }),
      resolvedAuthors: DEFAULT_RESOLVED_AUTHORS,
      userId: USER_ID,
    });

    expect(resolved).toMatchObject({ partNumber: 2, seriesId: SERIES_ID });
  });
});

describe("BookRelationsResolver.resolveForUpdate", () => {
  it("replaces the author set and recomputes firstAuthorName from the new first author", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { authors: [{ name: "Ursula K. Le Guin" }, { name: "Octavia E. Butler" }] },
      resolvedAuthors: {
        authorIds: [AUTHOR_ID_B, AUTHOR_ID_C],
        firstAuthorName: "Ursula K. Le Guin",
      },
      userId: USER_ID,
    });

    expect(resolved.authorIds).toEqual([AUTHOR_ID_B, AUTHOR_ID_C]);
    expect(resolved.fields.firstAuthorName).toBe("Ursula K. Le Guin");
  });

  it("leaves authorIds undefined when authors are absent", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { title: "Renamed" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.authorIds).toBeUndefined();
    expect(resolved.fields.firstAuthorName).toBeUndefined();
  });

  it("disconnects the publisher when the resolver returns null", async () => {
    const { publishersService, resolver } = buildResolver();
    publishersService.resolveOrCreate.mockResolvedValue(null);

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { publisherName: "Vivat" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.publisherId).toBeNull();
  });

  it("connects the publisher when the resolver returns an id", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { publisherName: "Vivat" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.publisherId).toBe(PUBLISHER_ID);
  });

  it("validates ownership of a replacement cover and sets the field", async () => {
    const { mediaService, resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { coverMediaId: MEDIA_ID },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(mediaService.assertOwned).toHaveBeenCalledWith({ id: MEDIA_ID, userId: USER_ID });
    expect(resolved.fields.coverMediaId).toBe(MEDIA_ID);
  });

  it("passes the resolved tag ids when tags are provided", async () => {
    const { resolver, tagsService } = buildResolver({ tagIds: [TAG_ID] });

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { tags: ["dark academia"] },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(
      USER_ID,
      ["dark academia"],
      undefined,
    );
    expect(resolved.tagIds).toEqual([TAG_ID]);
  });

  it("leaves tagIds undefined when tags are absent", async () => {
    const { resolver, tagsService } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { title: "Renamed" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(tagsService.resolveOrCreateMany).not.toHaveBeenCalled();
    expect(resolved.tagIds).toBeUndefined();
  });

  it("resolves the lists and passes the ids when listIds are provided", async () => {
    const { listsService, resolver } = buildResolver({ listIds: [LIST_ID] });

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { listIds: [LIST_ID] },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(
      {
        input: { listIds: [LIST_ID], newLists: undefined },
        userId: USER_ID,
      },
      undefined,
    );
    expect(resolved.listIds).toEqual([LIST_ID]);
  });

  it("disconnects the series and clears the part number when the book becomes solo", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { bookType: "solo" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.seriesId).toBeNull();
    expect(resolved.fields.partNumber).toBeNull();
  });

  it("checks the series for a duplicate part number excluding the current book", async () => {
    const { repository, resolver } = buildResolver();

    await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow({ partNumber: 4, seriesId: SERIES_ID }),
      input: { partNumber: 4 } as UpdateBookInput,
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(repository.findSeriesPartNumberConflict).toHaveBeenCalledWith(
      USER_ID,
      {
        excludeBookId: BOOK_ID,
        partNumber: 4,
        seriesId: SERIES_ID,
      },
      undefined,
    );
  });

  it("rejects an update whose part number collides with another book in the series", async () => {
    const { resolver } = buildResolver({
      findSeriesPartNumberConflict: { id: BOOK_ID, title: "Iron Flame" },
    });

    await expect(
      resolver.resolveForUpdate({
        bookId: BOOK_ID,
        current: bookRow({ partNumber: 2, seriesId: SERIES_ID }),
        input: { partNumber: 3 } as UpdateBookInput,
        resolvedAuthors: undefined,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("does not run the part-number check when the book is not in a series", async () => {
    const { repository, resolver } = buildResolver();

    await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { title: "Solo" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(repository.findSeriesPartNumberConflict).not.toHaveBeenCalled();
  });

  it("rejects an update when a newSeries name resolves to a series whose total books is exceeded", async () => {
    const { resolver, seriesService } = buildResolver({
      seriesId: SERIES_ID,
      seriesTotalBooks: 2,
    });

    await expect(
      resolver.resolveForUpdate({
        bookId: BOOK_ID,
        current: bookRow(),
        input: {
          bookType: "series_part",
          newSeries: { name: "Throne of Glass", status: "ongoing" },
          partNumber: 99,
        } as UpdateBookInput,
        resolvedAuthors: undefined,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(seriesService.resolveForBook).toHaveBeenCalled();
  });

  it("accepts an update when a newSeries name resolves to a series with room for the part number", async () => {
    const { resolver } = buildResolver({ seriesId: SERIES_ID, seriesTotalBooks: 3 });

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: {
        bookType: "series_part",
        newSeries: { name: "Throne of Glass", status: "ongoing" },
        partNumber: 2,
      } as UpdateBookInput,
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.seriesId).toBe(SERIES_ID);
    expect(resolved.fields.partNumber).toBe(2);
  });

  it("enqueues a book that was not in the queue and appends to the end with the chosen priority", async () => {
    const { resolver } = buildResolver({ maxQueuePosition: 4 });

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow({ queuePosition: null, queuePriority: null }),
      input: { addToReadingQueue: true, queuePriority: "high" } as UpdateBookInput,
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.queuePosition).toBe(5);
    expect(resolved.fields.queuePriority).toBe("high");
  });

  it("removes a book from the queue when addToReadingQueue is false", async () => {
    const { resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow({ queuePosition: 2, queuePriority: "normal" }),
      input: { addToReadingQueue: false } as UpdateBookInput,
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.queuePosition).toBeNull();
    expect(resolved.fields.queuePriority).toBeNull();
  });

  it("updates only the priority of an already-queued book and keeps its position", async () => {
    const { repository, resolver } = buildResolver();

    const resolved = await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow({ queuePosition: 3, queuePriority: "low" }),
      input: { queuePriority: "high" } as UpdateBookInput,
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(resolved.fields.queuePosition).toBeUndefined();
    expect(resolved.fields.queuePriority).toBe("high");
    expect(repository.maxQueuePosition).not.toHaveBeenCalled();
  });

  it("asserts the genres are selectable when genres are provided", async () => {
    const { genresService, resolver } = buildResolver();

    await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { genres: ["fentezi", "romantyka"] },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(genresService.assertGenresSelectable).toHaveBeenCalledWith(USER_ID, [
      "fentezi",
      "romantyka",
    ]);
  });

  it("does not assert genres when the genres field is absent", async () => {
    const { genresService, resolver } = buildResolver();

    await resolver.resolveForUpdate({
      bookId: BOOK_ID,
      current: bookRow(),
      input: { title: "Renamed" },
      resolvedAuthors: undefined,
      userId: USER_ID,
    });

    expect(genresService.assertGenresSelectable).not.toHaveBeenCalled();
  });
});

describe("BookRelationsResolver.mapSeriesPartNumberWriteError", () => {
  it("maps a part-number unique violation to a field error with re-run meta", async () => {
    const { repository, resolver } = buildResolver();
    repository.findSeriesPartNumberConflict.mockResolvedValue({ id: BOOK_ID, title: "Iron Flame" });

    const mapped = await resolver.mapSeriesPartNumberWriteError({
      error: uniqueConstraintError("books_series_id_part_number_key"),
      excludeBookId: null,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });

    expect(mapped).toBeInstanceOf(BadRequestError);
    if (!(mapped instanceof BadRequestError)) {
      throw new Error("expected BadRequestError");
    }
    expect(mapped.fields?.[0]?.code).toBe(BOOK_SERIES_PART_NUMBER_TAKEN_CODE);
    expect(mapped.fields?.[0]?.meta).toEqual({
      bookId: BOOK_ID,
      bookTitle: "Iron Flame",
      partNumber: "2",
    });
  });

  it("falls back to a metaless field error when the conflicting book cannot be re-read", async () => {
    const { resolver } = buildResolver();

    const mapped = await resolver.mapSeriesPartNumberWriteError({
      error: uniqueConstraintError("books_series_id_part_number_key"),
      excludeBookId: null,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });

    expect(mapped).toBeInstanceOf(BadRequestError);
    if (!(mapped instanceof BadRequestError)) {
      throw new Error("expected BadRequestError");
    }
    expect(mapped.fields?.[0]?.code).toBe(BOOK_SERIES_PART_NUMBER_TAKEN_CODE);
    expect(mapped.fields?.[0]?.meta).toBeUndefined();
  });

  it("returns the original error when the unique violation targets a different constraint", async () => {
    const { resolver } = buildResolver();
    const original = uniqueConstraintError("books_isbn_key");

    const mapped = await resolver.mapSeriesPartNumberWriteError({
      error: original,
      excludeBookId: null,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });

    expect(mapped).toBe(original);
  });

  it("returns the original error when there is no series placement", async () => {
    const { resolver } = buildResolver();
    const original = uniqueConstraintError("books_series_id_part_number_key");

    const mapped = await resolver.mapSeriesPartNumberWriteError({
      error: original,
      excludeBookId: null,
      placement: { partNumber: null, seriesId: null },
      userId: USER_ID,
    });

    expect(mapped).toBe(original);
  });
});
