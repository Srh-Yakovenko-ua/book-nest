import type { SaveCharacterGraphLayout } from "@app/shared";

import { CHARACTER_GRAPH_LAYOUT_ERROR_CODES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type {
  CharacterGraphLayoutsRepository,
  SaveLayoutData,
} from "../infrastructure/character-graph-layouts.repository.js";
import type { CharacterAccessAsserter } from "./character-access.asserter.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { CharacterGraphLayoutsService } from "./character-graph-layouts.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const SERIES_ID = "33333333-3333-4333-8333-333333333333";
const CHARACTER_ID = "44444444-4444-4444-8444-444444444444";
const LAYOUT_ID = "55555555-5555-4555-8555-555555555555";

type ServiceConfig = {
  bookExists?: boolean;
  deleteCount?: number;
  existing?: null | { id: string };
  seriesExists?: boolean;
};

function createService(config: ServiceConfig = {}) {
  const acquireLayoutLock = vi.fn().mockResolvedValue(undefined);
  const createLayout = vi.fn().mockImplementation((data: SaveLayoutData) => makeRow(data));
  const updateLayout = vi
    .fn()
    .mockImplementation(({ data }: { data: SaveLayoutData }) => makeRow(data));
  const deleteByKey = vi.fn().mockResolvedValue(config.deleteCount ?? 1);
  const findByKey = vi.fn().mockResolvedValue(config.existing ?? null);

  const assertOwned = vi.fn(async ({ notFoundCode }: { notFoundCode?: string }): Promise<void> => {
    if (config.bookExists === false) {
      throw new NotFoundError("Book not found", { code: notFoundCode });
    }
  });
  const existsOwnedSeries = vi.fn().mockResolvedValue(config.seriesExists ?? true);

  const layoutsRepository = {
    acquireLayoutLock,
    createLayout,
    deleteByKey,
    findByKey,
    updateLayout,
  } as unknown as CharacterGraphLayoutsRepository;
  const accessAsserter = {
    assertBookOwned: assertOwned,
    assertSeriesOwned: async ({
      notFoundCode,
      seriesId,
      userId,
    }: {
      notFoundCode: string;
      seriesId: string;
      userId: string;
    }) => {
      if (!(await existsOwnedSeries({ seriesId, userId }))) {
        throw new NotFoundError("Series not found", { code: notFoundCode });
      }
    },
  } as unknown as CharacterAccessAsserter;
  const transactionRunner = {
    run: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as TransactionRunner;

  const service = new CharacterGraphLayoutsService(
    layoutsRepository,
    accessAsserter,
    transactionRunner,
  );

  return {
    acquireLayoutLock,
    assertOwned,
    createLayout,
    deleteByKey,
    existsOwnedSeries,
    findByKey,
    service,
    updateLayout,
  };
}

function makeInput(overrides: Partial<SaveCharacterGraphLayout> = {}): SaveCharacterGraphLayout {
  return {
    contextBookId: undefined,
    layoutVersion: "v1",
    mode: "all",
    positions: { [CHARACTER_ID]: { x: 10, y: 20 } },
    scopeType: "global",
    viewport: null,
    ...overrides,
  };
}

function makeRow(data: SaveLayoutData) {
  return {
    contextBookId: data.contextBookId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: LAYOUT_ID,
    layoutVersion: data.layoutVersion,
    mode: data.mode,
    positions: data.positions,
    scopeId: data.scopeId,
    scopeType: data.scopeType,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    viewport: data.viewport,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CharacterGraphLayoutsService save uniqueness", () => {
  it("creates a new layout under an advisory lock when none exists", async () => {
    const { acquireLayoutLock, createLayout, findByKey, service, updateLayout } = createService({
      existing: null,
    });

    const view = await service.save({ input: makeInput(), userId: USER_ID });

    expect(acquireLayoutLock).toHaveBeenCalledTimes(1);
    expect(findByKey).toHaveBeenCalledTimes(1);
    expect(createLayout).toHaveBeenCalledTimes(1);
    expect(updateLayout).not.toHaveBeenCalled();
    expect(view.id).toBe(LAYOUT_ID);
    expect(view.positions).toEqual({ [CHARACTER_ID]: { x: 10, y: 20 } });
  });

  it("replaces the existing layout instead of inserting a duplicate", async () => {
    const { createLayout, service, updateLayout } = createService({ existing: { id: LAYOUT_ID } });

    await service.save({ input: makeInput({ layoutVersion: "v2" }), userId: USER_ID });

    expect(createLayout).not.toHaveBeenCalled();
    expect(updateLayout).toHaveBeenCalledTimes(1);
    expect(updateLayout.mock.calls[0]?.[0].data.layoutVersion).toBe("v2");
  });

  it("acquires the lock before reading the existing row", async () => {
    const order: string[] = [];
    const { acquireLayoutLock, findByKey, service } = createService({ existing: null });
    acquireLayoutLock.mockImplementation(() => {
      order.push("lock");
      return Promise.resolve(undefined);
    });
    findByKey.mockImplementation(() => {
      order.push("find");
      return Promise.resolve(null);
    });

    await service.save({ input: makeInput(), userId: USER_ID });

    expect(order).toEqual(["lock", "find"]);
  });
});

describe("CharacterGraphLayoutsService save ownership", () => {
  it("validates book scope ownership", async () => {
    const { createLayout, service } = createService({ bookExists: false });

    await expect(
      service.save({ input: makeInput({ scopeId: BOOK_ID, scopeType: "book" }), userId: USER_ID }),
    ).rejects.toMatchObject({ code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.bookNotFound });
    expect(createLayout).not.toHaveBeenCalled();
  });

  it("validates series scope ownership", async () => {
    const { createLayout, service } = createService({ seriesExists: false });

    await expect(
      service.save({
        input: makeInput({ scopeId: SERIES_ID, scopeType: "series" }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.seriesNotFound });
    expect(createLayout).not.toHaveBeenCalled();
  });

  it("validates context book ownership", async () => {
    const { createLayout, service } = createService({ bookExists: false });

    await expect(
      service.save({ input: makeInput({ contextBookId: BOOK_ID }), userId: USER_ID }),
    ).rejects.toMatchObject({ code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.bookNotFound });
    expect(createLayout).not.toHaveBeenCalled();
  });
});

describe("CharacterGraphLayoutsService get and remove", () => {
  it("throws when no layout matches the key", async () => {
    const { service } = createService({ existing: null });

    await expect(
      service.get({
        query: { contextBookId: undefined, mode: "all", scopeId: undefined, scopeType: "global" },
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws when nothing is deleted", async () => {
    const { service } = createService({ deleteCount: 0 });

    await expect(
      service.remove({
        query: { contextBookId: undefined, mode: "all", scopeId: undefined, scopeType: "global" },
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.notFound });
  });
});
