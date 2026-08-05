import type { CharacterTheoriesQuery, CreateCharacterTheoryInput, Nullable } from "@app/shared";

import { CHARACTER_THEORY_ERROR_CODES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookAccessService } from "../../books/index.js";
import type {
  CharacterTheoriesRepository,
  CharacterTheoryRow,
  TheoryListFilter,
} from "../infrastructure/character-theories.repository.js";
import type { CharactersRepository } from "../infrastructure/characters.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { CharacterTheoriesService } from "./character-theories.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const CHARACTER_ID = "22222222-2222-2222-2222-222222222222";
const BOOK_ID = "33333333-3333-3333-3333-333333333333";
const SERIES_ID = "44444444-4444-4444-4444-444444444444";
const THEORY_ID = "55555555-5555-5555-5555-555555555555";
const LATER_BOOK_ID = "66666666-6666-6666-6666-666666666666";

type ServiceConfig = {
  bookContext?: null | { id: string; partNumber: null | number; seriesId: null | string };
  bookExists?: boolean;
  characterOwned?: boolean;
  deleteCount?: number;
  findResult?: Nullable<CharacterTheoryRow>;
  seriesBooks?: { createdAt: Date; id: string; partNumber: null | number }[];
  seriesExists?: boolean;
};

function createService(config: ServiceConfig = {}): {
  countTheories: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  listTheories: ReturnType<typeof vi.fn>;
  service: CharacterTheoriesService;
  update: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue(makeRow());
  const deleteOwned = vi.fn().mockResolvedValue(config.deleteCount ?? 1);
  const findOwnedById = vi.fn().mockResolvedValue(config.findResult ?? null);
  const update = vi.fn().mockResolvedValue(makeRow());
  const listTheories = vi.fn().mockResolvedValue([]);
  const countTheories = vi.fn().mockResolvedValue(0);

  const findOwnedCharacterBare = vi
    .fn()
    .mockResolvedValue(config.characterOwned === false ? null : { id: CHARACTER_ID });
  const existsOwnedSeries = vi.fn().mockResolvedValue(config.seriesExists ?? true);
  const findOwnedBookContext = vi
    .fn()
    .mockResolvedValue(config.bookContext === undefined ? null : config.bookContext);
  const listSeriesBooks = vi.fn().mockResolvedValue(config.seriesBooks ?? []);
  const assertOwned = vi.fn(async ({ notFoundCode }: { notFoundCode?: string }): Promise<void> => {
    if (config.bookExists === false) {
      throw new NotFoundError("Book not found", { code: notFoundCode });
    }
  });

  const theoriesRepository = {
    countTheories,
    create,
    deleteOwned,
    findOwnedById,
    listTheories,
    update,
  } as unknown as CharacterTheoriesRepository;
  const charactersRepository = {
    existsOwnedSeries,
    findOwnedBookContext,
    findOwnedCharacterBare,
    listSeriesBooks,
  } as unknown as CharactersRepository;
  const bookAccess = { assertOwned } as unknown as BookAccessService;

  const service = new CharacterTheoriesService(
    theoriesRepository,
    charactersRepository,
    bookAccess,
  );

  return { countTheories, create, listTheories, service, update };
}

function makeRow(overrides: Partial<CharacterTheoryRow> = {}): CharacterTheoryRow {
  return {
    book: null,
    bookId: null,
    character: { deletedAt: null, hideProfileAsSpoiler: false, id: CHARACTER_ID, name: "Snape" },
    characterId: CHARACTER_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: THEORY_ID,
    isSpoiler: false,
    series: null,
    seriesId: null,
    status: "unverified",
    text: "He is a double agent",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

const baseInput: CreateCharacterTheoryInput = {
  bookId: undefined,
  characterId: CHARACTER_ID,
  isSpoiler: false,
  seriesId: undefined,
  status: "unverified",
  text: "He is a double agent",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CharacterTheoriesService create ownership", () => {
  it("rejects when the target character is not owned", async () => {
    const { create, service } = createService({ characterOwned: false });

    await expect(service.create({ input: baseInput, userId: USER_ID })).rejects.toMatchObject({
      code: CHARACTER_THEORY_ERROR_CODES.characterNotFound,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects when the target book is not owned", async () => {
    const { create, service } = createService({ bookExists: false });

    await expect(
      service.create({
        input: { ...baseInput, bookId: BOOK_ID, characterId: undefined },
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_THEORY_ERROR_CODES.bookNotFound });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects when the target series is not owned", async () => {
    const { create, service } = createService({ seriesExists: false });

    await expect(
      service.create({
        input: { ...baseInput, characterId: undefined, seriesId: SERIES_ID },
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_THEORY_ERROR_CODES.seriesNotFound });
    expect(create).not.toHaveBeenCalled();
  });

  it("persists a theory with normalized null targets", async () => {
    const { create, service } = createService();

    await service.create({ input: baseInput, userId: USER_ID });

    expect(create).toHaveBeenCalledWith({
      bookId: null,
      characterId: CHARACTER_ID,
      isSpoiler: false,
      seriesId: null,
      status: "unverified",
      text: "He is a double agent",
      userId: USER_ID,
    });
  });
});

describe("CharacterTheoriesService update and delete", () => {
  it("rejects updating a theory the user does not own", async () => {
    const { service, update } = createService({ findResult: null });

    await expect(
      service.update({ input: { status: "confirmed" }, theoryId: THEORY_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it("changes only the provided fields", async () => {
    const { service, update } = createService({ findResult: makeRow() });

    await service.update({ input: { status: "confirmed" }, theoryId: THEORY_ID, userId: USER_ID });

    expect(update).toHaveBeenCalledWith({
      data: { status: "confirmed" },
      theoryId: THEORY_ID,
      userId: USER_ID,
    });
  });

  it("rejects deleting a theory that was not removed", async () => {
    const { service } = createService({ deleteCount: 0 });

    await expect(service.remove({ theoryId: THEORY_ID, userId: USER_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("CharacterTheoriesService context masking", () => {
  it("passes no context gate when contextBookId is absent", async () => {
    const { listTheories, service } = createService();

    await service.list({ query: makeQuery(), userId: USER_ID });

    const filter = listTheories.mock.calls[0]?.[0].filter as TheoryListFilter;
    expect(filter.contextAllowedBookIds).toBeUndefined();
  });

  it("gates a standalone book context to only that book", async () => {
    const { listTheories, service } = createService({
      bookContext: { id: BOOK_ID, partNumber: null, seriesId: null },
    });

    await service.list({ query: makeQuery({ contextBookId: BOOK_ID }), userId: USER_ID });

    const filter = listTheories.mock.calls[0]?.[0].filter as TheoryListFilter;
    expect(filter.contextAllowedBookIds).toEqual([BOOK_ID]);
  });

  it("gates a series context to books up to the context part number", async () => {
    const { listTheories, service } = createService({
      bookContext: { id: BOOK_ID, partNumber: 1, seriesId: SERIES_ID },
      seriesBooks: [
        { createdAt: new Date("2026-01-01T00:00:00.000Z"), id: BOOK_ID, partNumber: 1 },
        { createdAt: new Date("2026-02-01T00:00:00.000Z"), id: LATER_BOOK_ID, partNumber: 2 },
      ],
    });

    await service.list({ query: makeQuery({ contextBookId: BOOK_ID }), userId: USER_ID });

    const filter = listTheories.mock.calls[0]?.[0].filter as TheoryListFilter;
    expect(filter.contextAllowedBookIds).toEqual([BOOK_ID]);
  });

  it("rejects an unowned context book", async () => {
    const { service } = createService({ bookContext: null });

    await expect(
      service.list({ query: makeQuery({ contextBookId: BOOK_ID }), userId: USER_ID }),
    ).rejects.toMatchObject({ code: CHARACTER_THEORY_ERROR_CODES.bookNotFound });
  });
});

function makeQuery(overrides: Partial<CharacterTheoriesQuery> = {}): CharacterTheoriesQuery {
  return {
    bookId: undefined,
    characterId: undefined,
    contextBookId: undefined,
    pageNumber: 1,
    pageSize: 20,
    search: undefined,
    seriesId: undefined,
    sort: "newest",
    status: undefined,
    ...overrides,
  };
}
