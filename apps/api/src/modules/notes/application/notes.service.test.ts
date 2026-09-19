import type { CreateNoteInput, CreateSeriesNoteInput, Nullable } from "@app/shared";

import { NOTE_ERROR_CODES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookAccessService } from "../../books/index.js";
import type { MediaService } from "../../media/index.js";
import type { SeriesService } from "../../series/index.js";
import type { NotesRepository, NoteWithEntity } from "../infrastructure/notes.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { NotesService } from "./notes.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const BOOK_ID = "22222222-2222-2222-2222-222222222222";
const SERIES_ID = "33333333-3333-3333-3333-333333333333";
const NOTE_ID = "44444444-4444-4444-4444-444444444444";

type ServiceConfig = {
  bookExists?: boolean;
  createResult?: NoteWithEntity;
  deleteCount?: number;
  findResult?: Nullable<NoteWithEntity>;
  seriesExists?: boolean;
  updateResult?: NoteWithEntity;
};

function createService(config: ServiceConfig = {}): {
  assertOwned: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  existsSeries: ReturnType<typeof vi.fn>;
  service: NotesService;
  update: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue(config.createResult ?? makeBookNote());
  const deleteOwned = vi.fn().mockResolvedValue(config.deleteCount ?? 1);
  const findOwnedById = vi.fn().mockResolvedValue(config.findResult ?? null);
  const update = vi.fn().mockResolvedValue(config.updateResult ?? makeBookNote());
  const assertOwned = vi.fn(async ({ notFoundCode }: { notFoundCode?: string }): Promise<void> => {
    if (config.bookExists === false) {
      throw new NotFoundError("Book not found", { code: notFoundCode });
    }
  });
  const existsSeries = vi.fn().mockResolvedValue(config.seriesExists ?? true);

  const notesRepository = {
    create,
    deleteOwned,
    findOwnedById,
    update,
  } as unknown as NotesRepository;
  const bookAccess = { assertOwned } as unknown as BookAccessService;
  const seriesService = { existsOwned: existsSeries } as unknown as SeriesService;
  const mediaService = {
    buildViewOrNull: vi.fn().mockReturnValue(null),
  } as unknown as MediaService;

  const service = new NotesService(notesRepository, bookAccess, seriesService, mediaService);

  return { assertOwned, create, existsSeries, service, update };
}

function makeBookNote(overrides: Partial<NoteWithEntity> = {}): NoteWithEntity {
  return {
    book: { coverMedia: null, firstAuthorName: "Frank Herbert", id: BOOK_ID, title: "Dune" },
    bookId: BOOK_ID,
    category: null,
    chapter: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    customCategory: null,
    deletedAt: null,
    entityType: "book",
    id: NOTE_ID,
    isFavorite: false,
    isPinned: false,
    isSpoiler: false,
    page: null,
    purgeAt: null,
    series: null,
    seriesId: null,
    text: "A thought",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

const baseInput: CreateNoteInput = {
  category: null,
  chapter: null,
  customCategory: null,
  isFavorite: false,
  isPinned: false,
  isSpoiler: false,
  page: null,
  text: "A thought",
};

const baseSeriesInput: CreateSeriesNoteInput = {
  category: null,
  customCategory: null,
  isFavorite: false,
  isPinned: false,
  isSpoiler: false,
  text: "A thought",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotesService ownership", () => {
  it("rejects creating a book note when the book is not owned", async () => {
    const { assertOwned, create, service } = createService({ bookExists: false });

    await expect(service.createBookNote(USER_ID, BOOK_ID, baseInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(assertOwned).toHaveBeenCalledWith({
      bookId: BOOK_ID,
      notFoundCode: NOTE_ERROR_CODES.bookNotFound,
      userId: USER_ID,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects creating a series note when the series is not owned", async () => {
    const { create, existsSeries, service } = createService({ seriesExists: false });

    await expect(
      service.createSeriesNote(USER_ID, SERIES_ID, baseSeriesInput),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(existsSeries).toHaveBeenCalledWith({ seriesId: SERIES_ID, userId: USER_ID });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects editing a note the user does not own", async () => {
    const { service, update } = createService({ findResult: null });

    await expect(service.editNote(USER_ID, NOTE_ID, { isFavorite: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(update).not.toHaveBeenCalled();
  });
});

describe("NotesService create", () => {
  it("persists a book note with the book entity and no series", async () => {
    const { create, service } = createService();

    await service.createBookNote(USER_ID, BOOK_ID, baseInput);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: BOOK_ID,
        entityType: "book",
        seriesId: null,
        userId: USER_ID,
      }),
    );
  });

  it("never persists chapter or page for a new series note", async () => {
    const { create, service } = createService();

    await service.createSeriesNote(USER_ID, SERIES_ID, baseSeriesInput);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: null,
        chapter: null,
        entityType: "series",
        page: null,
        seriesId: SERIES_ID,
      }),
    );
  });

  it("drops the custom category when the category is not other", async () => {
    const { create, service } = createService();

    await service.createBookNote(USER_ID, BOOK_ID, {
      ...baseInput,
      category: "characters",
      customCategory: "should be dropped",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ category: "characters", customCategory: null }),
    );
  });

  it("keeps the custom category when the category is other", async () => {
    const { create, service } = createService();

    await service.createBookNote(USER_ID, BOOK_ID, {
      ...baseInput,
      category: "other",
      customCategory: "  love line  ",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ category: "other", customCategory: "love line" }),
    );
  });
});

describe("NotesService edit", () => {
  it("only updates the favorite flag without touching other fields", async () => {
    const current = makeBookNote({ category: "other", customCategory: "finale" });
    const { service, update } = createService({
      findResult: current,
      updateResult: { ...current, isFavorite: true },
    });

    await service.editNote(USER_ID, NOTE_ID, { isFavorite: true });

    expect(update).toHaveBeenCalledWith({
      fields: { isFavorite: true, updatedAt: current.updatedAt },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it.each([
    { input: { isPinned: true }, label: "a pin toggle" },
    { input: { isFavorite: true }, label: "a favorite toggle" },
    { input: { isFavorite: false, isPinned: true }, label: "both flags at once" },
  ])("keeps the stored updatedAt for $label", async ({ input }) => {
    const current = makeBookNote({ updatedAt: new Date("2026-03-04T05:06:07.000Z") });
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, input);

    expect(update).toHaveBeenCalledWith({
      fields: { ...input, updatedAt: current.updatedAt },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it.each([
    { input: { isPinned: true, text: "Revised" }, label: "a text edit alongside a flag" },
    { input: { isSpoiler: true }, label: "a spoiler change" },
    { input: { isFavorite: true, isSpoiler: false }, label: "a spoiler change alongside a flag" },
    { input: { page: 7 }, label: "a page change" },
    { input: { category: "plot" as const }, label: "a category change" },
  ])("lets updatedAt advance for $label", async ({ input }) => {
    const current = makeBookNote();
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, input);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.not.objectContaining({ updatedAt: expect.anything() }),
      }),
    );
  });

  it("leaves a saved chapter and page untouched when the patch omits them", async () => {
    const current = makeBookNote({ chapter: "Prologue", page: 12 });
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { text: "Revised thought" });

    expect(update).toHaveBeenCalledWith({
      fields: { text: "Revised thought" },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it("clears a saved chapter and page when the patch sets them to null", async () => {
    const current = makeBookNote({ chapter: "Prologue", page: 12 });
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { chapter: null, page: null });

    expect(update).toHaveBeenCalledWith({
      fields: { chapter: null, page: null },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it("clears the custom category when switching to a non-other category", async () => {
    const current = makeBookNote({ category: "other", customCategory: "finale" });
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { category: "plot" });

    expect(update).toHaveBeenCalledWith({
      fields: { category: "plot", customCategory: null },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it("sets the custom category when only the custom label changes on an other note", async () => {
    const current = makeBookNote({ category: "other", customCategory: "finale" });
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { customCategory: "romance arc" });

    expect(update).toHaveBeenCalledWith({
      fields: { customCategory: "romance arc" },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });
});

describe("NotesService edit on a series note", () => {
  function makeSeriesNote(): NoteWithEntity {
    return makeBookNote({ book: null, bookId: null, entityType: "series", seriesId: SERIES_ID });
  }

  it.each([
    { input: { page: 5 }, label: "a page" },
    { input: { chapter: "Prologue" }, label: "a chapter" },
  ])("rejects adding $label", async ({ input }) => {
    const current = makeSeriesNote();
    const { service, update } = createService({ findResult: current, updateResult: current });

    const rejection = service.editNote(USER_ID, NOTE_ID, input);

    await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
    await expect(rejection).rejects.toMatchObject({
      code: NOTE_ERROR_CODES.seriesNoteLocationUnsupported,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts an explicit null page and chapter as a removal", async () => {
    const current = makeSeriesNote();
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { chapter: null, page: null });

    expect(update).toHaveBeenCalledWith({
      fields: { chapter: null, page: null },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it("treats a blank chapter as a removal", async () => {
    const current = makeSeriesNote();
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { chapter: "   " });

    expect(update).toHaveBeenCalledWith({
      fields: { chapter: null },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });

  it("leaves page and chapter out of the update when the patch omits them", async () => {
    const current = makeSeriesNote();
    const { service, update } = createService({ findResult: current, updateResult: current });

    await service.editNote(USER_ID, NOTE_ID, { text: "Revised" });

    expect(update).toHaveBeenCalledWith({
      fields: { text: "Revised" },
      noteId: NOTE_ID,
      userId: USER_ID,
    });
  });
});
