import { describe, expect, it, vi } from "vitest";

import type { ChangelogEntryModel } from "../../../generated/prisma/models.js";
import type { ChangelogRepository } from "../infrastructure/changelog.repository.js";

import { ChangelogService } from "./changelog.service.js";

const PUBLISHED_AT = new Date("2026-03-01T00:00:00.000Z");
const LAST_SEEN_AT = new Date("2026-02-15T00:00:00.000Z");
const USER_ID = "22222222-2222-2222-2222-222222222222";

function makeEntry(overrides: Partial<ChangelogEntryModel>): ChangelogEntryModel {
  return {
    bodyEn: "Body text",
    bodyUk: "Body text",
    category: "feature",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "11111111-1111-1111-1111-111111111111",
    publishedAt: PUBLISHED_AT,
    slug: "entry",
    titleEn: "Title",
    titleUk: "Title",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    version: "1.0.0",
    ...overrides,
  };
}

function makeRepository(overrides: Partial<ChangelogRepository>): ChangelogRepository {
  return {
    countPublished: vi.fn().mockResolvedValue(0),
    countPublishedAfter: vi.fn().mockResolvedValue(0),
    findPublished: vi.fn().mockResolvedValue([]),
    getRead: vi.fn().mockResolvedValue(null),
    upsertRead: vi.fn(),
    ...overrides,
  } as unknown as ChangelogRepository;
}

describe("ChangelogService.list published filter", () => {
  it("drops rows without a published date from the mapped entries", async () => {
    const repository = makeRepository({
      findPublished: vi
        .fn()
        .mockResolvedValue([
          makeEntry({ publishedAt: PUBLISHED_AT, slug: "published" }),
          makeEntry({ publishedAt: null, slug: "draft" }),
        ]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.entries.map((entry) => entry.slug)).toEqual(["published"]);
  });
});

describe("ChangelogService.list mapping", () => {
  it("maps a published row onto the view model with an ISO published date", async () => {
    const repository = makeRepository({
      findPublished: vi.fn().mockResolvedValue([
        makeEntry({
          bodyUk: "What changed",
          category: "improvement",
          id: "33333333-3333-3333-3333-333333333333",
          publishedAt: PUBLISHED_AT,
          slug: "faster-search",
          titleUk: "Faster search",
          version: "2.1.0",
        }),
      ]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.entries[0]).toEqual({
      body: "What changed",
      category: "improvement",
      id: "33333333-3333-3333-3333-333333333333",
      publishedAt: PUBLISHED_AT.toISOString(),
      slug: "faster-search",
      title: "Faster search",
      version: "2.1.0",
    });
  });

  it("preserves a null version in the mapped entry", async () => {
    const repository = makeRepository({
      findPublished: vi.fn().mockResolvedValue([makeEntry({ version: null })]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.entries[0]?.version).toBeNull();
  });
});

describe("ChangelogService.list locale resolution", () => {
  function makeLocalizedRepository(): ChangelogRepository {
    return makeRepository({
      findPublished: vi.fn().mockResolvedValue([
        makeEntry({
          bodyEn: "We sped up search",
          bodyUk: "Ми пришвидшили пошук",
          titleEn: "Faster search",
          titleUk: "Швидший пошук",
        }),
      ]),
    });
  }

  it("maps title and body to the English fields when locale is en", async () => {
    const service = new ChangelogService(makeLocalizedRepository());

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "en",
      userId: null,
    });

    expect(result.entries[0]).toMatchObject({ body: "We sped up search", title: "Faster search" });
  });

  it("maps title and body to the Ukrainian fields when locale is uk", async () => {
    const service = new ChangelogService(makeLocalizedRepository());

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.entries[0]).toMatchObject({
      body: "Ми пришвидшили пошук",
      title: "Швидший пошук",
    });
  });
});

describe("ChangelogService.list unread count", () => {
  it("returns zero and never reads the marker for an anonymous caller", async () => {
    const getRead = vi.fn();
    const countPublished = vi.fn();
    const countPublishedAfter = vi.fn();
    const repository = makeRepository({ countPublished, countPublishedAfter, getRead });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.unreadCount).toBe(0);
    expect(getRead).not.toHaveBeenCalled();
    expect(countPublished).not.toHaveBeenCalled();
    expect(countPublishedAfter).not.toHaveBeenCalled();
  });

  it("counts every published entry when the user has no read marker", async () => {
    const countPublished = vi.fn().mockResolvedValue(4);
    const countPublishedAfter = vi.fn();
    const repository = makeRepository({
      countPublished,
      countPublishedAfter,
      getRead: vi.fn().mockResolvedValue(null),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: USER_ID,
    });

    expect(result.unreadCount).toBe(4);
    expect(countPublishedAfter).not.toHaveBeenCalled();
  });

  it("counts only entries published after the marker when a read marker exists", async () => {
    const countPublished = vi.fn();
    const countPublishedAfter = vi.fn().mockResolvedValue(2);
    const repository = makeRepository({
      countPublished,
      countPublishedAfter,
      getRead: vi.fn().mockResolvedValue({ lastSeenAt: LAST_SEEN_AT, userId: USER_ID }),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: USER_ID,
    });

    expect(result.unreadCount).toBe(2);
    expect(countPublished).not.toHaveBeenCalled();
    expect(countPublishedAfter).toHaveBeenCalledWith({
      after: LAST_SEEN_AT,
      now: expect.any(Date),
    });
  });
});

describe("ChangelogService.list cursor pagination", () => {
  const ID_ONE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ID_TWO = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const ID_THREE = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  it("slices the extra row off and returns the last kept id as nextCursor when more exist", async () => {
    const repository = makeRepository({
      findPublished: vi
        .fn()
        .mockResolvedValue([
          makeEntry({ id: ID_ONE, slug: "one" }),
          makeEntry({ id: ID_TWO, slug: "two" }),
          makeEntry({ id: ID_THREE, slug: "three" }),
        ]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({ cursor: undefined, limit: 2, locale: "uk", userId: null });

    expect(result.entries.map((entry) => entry.slug)).toEqual(["one", "two"]);
    expect(result.nextCursor).toBe(ID_TWO);
  });

  it("returns a null nextCursor when the repository yields no more than the limit", async () => {
    const repository = makeRepository({
      findPublished: vi
        .fn()
        .mockResolvedValue([
          makeEntry({ id: ID_ONE, slug: "one" }),
          makeEntry({ id: ID_TWO, slug: "two" }),
        ]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({ cursor: undefined, limit: 3, locale: "uk", userId: null });

    expect(result.entries.map((entry) => entry.slug)).toEqual(["one", "two"]);
    expect(result.nextCursor).toBeNull();
  });

  it("forwards the cursor and limit to the repository", async () => {
    const findPublished = vi.fn().mockResolvedValue([]);
    const repository = makeRepository({ findPublished });
    const service = new ChangelogService(repository);

    await service.list({ cursor: ID_ONE, limit: 2, locale: "uk", userId: null });

    expect(findPublished).toHaveBeenCalledWith({ cursor: ID_ONE, limit: 2, now: expect.any(Date) });
  });

  it("returns a null nextCursor when no limit is supplied even with entries present", async () => {
    const repository = makeRepository({
      findPublished: vi
        .fn()
        .mockResolvedValue([
          makeEntry({ id: ID_ONE, slug: "one" }),
          makeEntry({ id: ID_TWO, slug: "two" }),
        ]),
    });
    const service = new ChangelogService(repository);

    const result = await service.list({
      cursor: undefined,
      limit: undefined,
      locale: "uk",
      userId: null,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });
});

describe("ChangelogService.markSeen", () => {
  it("upserts the caller's read marker with a fresh timestamp", async () => {
    const upsertRead = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({ upsertRead });
    const service = new ChangelogService(repository);

    await service.markSeen({ userId: USER_ID });

    expect(upsertRead).toHaveBeenCalledWith({ lastSeenAt: expect.any(Date), userId: USER_ID });
  });
});
