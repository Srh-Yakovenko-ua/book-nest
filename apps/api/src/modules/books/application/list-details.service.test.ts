import type { CustomListBooksQuery } from "@app/shared";

import { CustomListBooksQuerySchema } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { GenresService } from "../../genres/index.js";
import type { ListsService } from "../../lists/index.js";
import type { ListBooksRepository } from "../infrastructure/list-books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { ListDetailsService } from "./list-details.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const BOOK_ID = "33333333-3333-4333-8333-333333333333";

function buildService(): {
  repository: {
    countBooks: ReturnType<typeof vi.fn>;
    countByTab: ReturnType<typeof vi.fn>;
    listBooks: ReturnType<typeof vi.fn>;
    listPositionRanks: ReturnType<typeof vi.fn>;
  };
  service: ListDetailsService;
} {
  const repository = {
    countBooks: vi.fn().mockResolvedValue(0),
    countByTab: vi.fn().mockResolvedValue({ all: 0, finished: 0, notStarted: 0, reading: 0 }),
    listBooks: vi.fn().mockResolvedValue([]),
    listPositionRanks: vi.fn().mockResolvedValue(new Map<string, number>()),
  };

  const listsService = {
    findDetailHeader: vi.fn().mockResolvedValue({
      bookCount: 0,
      createdAt: "2026-02-01T10:00:00.000Z",
      description: null,
      id: LIST_ID,
      name: "Autumn reads",
      previewCovers: [],
      updatedAt: "2026-02-02T11:00:00.000Z",
    }),
  };

  const genresService = { searchKeys: vi.fn().mockResolvedValue([]) };

  const viewAssembler = {
    viewOf: vi.fn(({ id }: { id: string }) => ({ id, title: "Dune" })),
  };

  const service = new ListDetailsService(
    listsService as unknown as ListsService,
    repository as unknown as ListBooksRepository,
    genresService as unknown as GenresService,
    viewAssembler as unknown as BookViewAssembler,
  );

  return { repository, service };
}

function listItem(position: number): { book: { id: string }; bookId: string; position: number } {
  return { book: { id: BOOK_ID }, bookId: BOOK_ID, position };
}

function query(overrides: Record<string, unknown> = {}): CustomListBooksQuery {
  return CustomListBooksQuerySchema.parse(overrides);
}

describe("ListDetailsService.detail position ranks", () => {
  it("does not issue the rank query when the books are not sorted by position", async () => {
    const { repository, service } = buildService();

    await service.detail({ listId: LIST_ID, query: query({ sort: "title_asc" }), userId: USER_ID });

    expect(repository.listPositionRanks).not.toHaveBeenCalled();
  });

  it("does not issue the rank query when the books are sorted by the date they were added", async () => {
    const { repository, service } = buildService();

    await service.detail({
      listId: LIST_ID,
      query: query({ sort: "added_desc" }),
      userId: USER_ID,
    });

    expect(repository.listPositionRanks).not.toHaveBeenCalled();
  });

  it("issues the rank query for the owner of the list when sorting by position", async () => {
    const { repository, service } = buildService();

    await service.detail({ listId: LIST_ID, query: query({ sort: "position" }), userId: USER_ID });

    expect(repository.listPositionRanks).toHaveBeenCalledWith({
      listId: LIST_ID,
      userId: USER_ID,
    });
  });

  it("reports the display rank instead of the sparse stored position when sorting by position", async () => {
    const { repository, service } = buildService();
    repository.listBooks.mockResolvedValue([listItem(7)]);
    repository.listPositionRanks.mockResolvedValue(new Map([[BOOK_ID, 3]]));

    const detail = await service.detail({
      listId: LIST_ID,
      query: query({ sort: "position" }),
      userId: USER_ID,
    });

    expect(detail.books.items[0]?.position).toBe(3);
  });

  it("falls back to the stored position for a book the rank query did not return", async () => {
    const { repository, service } = buildService();
    repository.listBooks.mockResolvedValue([listItem(7)]);

    const detail = await service.detail({
      listId: LIST_ID,
      query: query({ sort: "position" }),
      userId: USER_ID,
    });

    expect(detail.books.items[0]?.position).toBe(7);
  });

  it("reports the stored position when the books are not sorted by position", async () => {
    const { repository, service } = buildService();
    repository.listBooks.mockResolvedValue([listItem(7)]);

    const detail = await service.detail({
      listId: LIST_ID,
      query: query({ sort: "title_asc" }),
      userId: USER_ID,
    });

    expect(detail.books.items[0]?.position).toBe(7);
  });
});
