import type { CreateBookStoreLinkInput, UpdateBookStoreLinkInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";
import type { BookStoreLinkRepository } from "../infrastructure/book-store-link.repository.js";
import type { BooksRepository } from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { BookStoreLinkService } from "./book-store-link.service.js";

const TX = {} as unknown as Prisma.TransactionClient;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_BOOK_ID = "44444444-4444-4444-8444-444444444444";

const CREATED_AT = new Date("2026-02-01T10:00:00.000Z");

type StoreLinkRepositoryMock = {
  acquireBookStoreLinkLock: ReturnType<typeof vi.fn>;
  countByBook: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  deleteById: ReturnType<typeof vi.fn>;
  findByBookAndUrl: ReturnType<typeof vi.fn>;
  findOwnedById: ReturnType<typeof vi.fn>;
  listByBook: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function makeLink(overrides: Partial<BookStoreLinkModel> = {}): BookStoreLinkModel {
  return {
    bookId: BOOK_ID,
    createdAt: CREATED_AT,
    currency: "UAH",
    id: LINK_ID,
    price: new PrismaNamespace.Decimal("199.50"),
    storeName: "Yakaboo",
    updatedAt: CREATED_AT,
    url: "https://yakaboo.ua/book",
    userId: USER_ID,
    ...overrides,
  };
}

function setup(overrides: Partial<StoreLinkRepositoryMock> = {}) {
  const repository: StoreLinkRepositoryMock = {
    acquireBookStoreLinkLock: vi.fn().mockResolvedValue(undefined),
    countByBook: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(makeLink()),
    deleteById: vi.fn().mockResolvedValue(1),
    findByBookAndUrl: vi.fn().mockResolvedValue(null),
    findOwnedById: vi.fn().mockResolvedValue(makeLink()),
    listByBook: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(makeLink()),
    ...overrides,
  };
  const existsOwned = vi.fn().mockResolvedValue(true);
  const booksRepository = { existsOwned } as unknown as BooksRepository;
  const transactionRunner = {
    run: vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(TX)),
  } as unknown as TransactionRunner;

  const service = new BookStoreLinkService(
    repository as unknown as BookStoreLinkRepository,
    booksRepository,
    transactionRunner,
  );

  return { existsOwned, repository, service };
}

function uniqueConstraintError(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

const CREATE_INPUT: CreateBookStoreLinkInput = {
  currency: "UAH",
  price: 199.5,
  storeName: "Yakaboo",
  url: "https://yakaboo.ua/book",
};

describe("BookStoreLinkService.addLink", () => {
  it("creates a store link and returns its view", async () => {
    const { repository, service } = setup();

    const result = await service.addLink({ bookId: BOOK_ID, input: CREATE_INPUT, userId: USER_ID });

    expect(result).toEqual({
      bookId: BOOK_ID,
      createdAt: CREATED_AT.toISOString(),
      currency: "UAH",
      id: LINK_ID,
      price: 199.5,
      storeName: "Yakaboo",
      updatedAt: CREATED_AT.toISOString(),
      url: "https://yakaboo.ua/book",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: BOOK_ID,
        data: {
          currency: "UAH",
          price: 199.5,
          storeName: "Yakaboo",
          url: "https://yakaboo.ua/book",
        },
        userId: USER_ID,
      }),
    );
  });

  it("throws MAX_LINKS_REACHED when the cap is reached", async () => {
    const { repository, service } = setup({ countByBook: vi.fn().mockResolvedValue(20) });

    await expect(
      service.addLink({ bookId: BOOK_ID, input: CREATE_INPUT, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "MAX_LINKS_REACHED" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("throws DUPLICATE_URL when a link with the same URL already exists", async () => {
    const { repository, service } = setup({
      findByBookAndUrl: vi.fn().mockResolvedValue(makeLink({ id: "other" })),
    });

    await expect(
      service.addLink({ bookId: BOOK_ID, input: CREATE_INPUT, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "DUPLICATE_URL" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to DUPLICATE_URL", async () => {
    const { service } = setup({ create: vi.fn().mockRejectedValue(uniqueConstraintError()) });

    await expect(
      service.addLink({ bookId: BOOK_ID, input: CREATE_INPUT, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "DUPLICATE_URL" });
  });

  it("throws BOOK_NOT_FOUND when the book is not owned", async () => {
    const { existsOwned, repository, service } = setup();
    existsOwned.mockResolvedValue(false);

    await expect(
      service.addLink({ bookId: BOOK_ID, input: CREATE_INPUT, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    expect(repository.countByBook).not.toHaveBeenCalled();
  });
});

describe("BookStoreLinkService.editLink", () => {
  const input: UpdateBookStoreLinkInput = { currency: undefined, storeName: "Book Depository" };

  it("updates the link and returns its view", async () => {
    const { repository, service } = setup({
      update: vi.fn().mockResolvedValue(makeLink({ storeName: "Book Depository" })),
    });

    const result = await service.editLink({
      bookId: BOOK_ID,
      input,
      linkId: LINK_ID,
      userId: USER_ID,
    });

    expect(result.storeName).toBe("Book Depository");
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { storeName: "Book Depository" },
        id: LINK_ID,
        userId: USER_ID,
      }),
    );
  });

  it("throws LINK_NOT_FOUND when the link does not exist", async () => {
    const { service } = setup({ findOwnedById: vi.fn().mockResolvedValue(null) });

    await expect(
      service.editLink({ bookId: BOOK_ID, input, linkId: LINK_ID, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "LINK_NOT_FOUND" });
  });

  it("throws LINK_NOT_FOUND when the link belongs to another book", async () => {
    const { service } = setup({
      findOwnedById: vi.fn().mockResolvedValue(makeLink({ bookId: OTHER_BOOK_ID })),
    });

    await expect(
      service.editLink({ bookId: BOOK_ID, input, linkId: LINK_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws DUPLICATE_URL when the new URL collides with another link", async () => {
    const { service } = setup({
      findByBookAndUrl: vi
        .fn()
        .mockResolvedValue(makeLink({ id: "other", url: "https://other.ua" })),
    });

    await expect(
      service.editLink({
        bookId: BOOK_ID,
        input: { currency: undefined, url: "https://other.ua" },
        linkId: LINK_ID,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_URL" });
  });
});

describe("BookStoreLinkService.deleteLink", () => {
  it("removes the link when it is owned", async () => {
    const { repository, service } = setup();

    await expect(
      service.deleteLink({ bookId: BOOK_ID, linkId: LINK_ID, userId: USER_ID }),
    ).resolves.toBeUndefined();
    expect(repository.deleteById).toHaveBeenCalledWith(
      expect.objectContaining({ id: LINK_ID, userId: USER_ID }),
    );
  });

  it("throws LINK_NOT_FOUND when the delete affects no rows", async () => {
    const { service } = setup({ deleteById: vi.fn().mockResolvedValue(0) });

    await expect(
      service.deleteLink({ bookId: BOOK_ID, linkId: LINK_ID, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "LINK_NOT_FOUND" });
  });

  it("throws LINK_NOT_FOUND when the link is not owned", async () => {
    const { service } = setup({ findOwnedById: vi.fn().mockResolvedValue(null) });

    await expect(
      service.deleteLink({ bookId: BOOK_ID, linkId: LINK_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("BookStoreLinkService.getBookStoreLinks", () => {
  it("returns the store links with the derived best offer", async () => {
    const links = [
      makeLink({ currency: "UAH", id: "l-1", price: new PrismaNamespace.Decimal("349.00") }),
      makeLink({ currency: "UAH", id: "l-2", price: new PrismaNamespace.Decimal("199.50") }),
    ];
    const { service } = setup({ listByBook: vi.fn().mockResolvedValue(links) });

    const result = await service.getBookStoreLinks({ bookId: BOOK_ID, userId: USER_ID });

    expect(result.storeLinks).toHaveLength(2);
    expect(result.bestOffer).toEqual({ currency: "UAH", price: 199.5 });
  });

  it("throws BOOK_NOT_FOUND when the book is not owned", async () => {
    const { existsOwned, service } = setup();
    existsOwned.mockResolvedValue(false);

    await expect(
      service.getBookStoreLinks({ bookId: BOOK_ID, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
  });
});
