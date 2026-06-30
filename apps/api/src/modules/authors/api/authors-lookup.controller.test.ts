import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { OpenLibraryAuthor } from "../infrastructure/open-library.client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { AuthorsModule } from "../authors.module.js";
import { OpenLibraryClient } from "../infrastructure/open-library.client.js";

const searchAuthors = vi.fn<(query: string) => Promise<OpenLibraryAuthor[]>>();

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

function candidate(overrides: Partial<OpenLibraryAuthor> = {}): OpenLibraryAuthor {
  return {
    birthYear: 1903,
    key: "OL23919A",
    name: "George Orwell",
    photoUrl: "https://covers.openlibrary.org/a/olid/OL23919A-M.jpg",
    ...overrides,
  };
}

function lookup(accessToken: string, query: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/authors/lookup?q=${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, AuthorsModule],
    [{ provide: OpenLibraryClient, useValue: { searchAuthors } }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  searchAuthors.mockReset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

describe("GET /api/authors/lookup", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/authors/lookup?q=orwell");

    expect(res.status).toBe(401);
  });

  it("returns 400 when the query parameter is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/authors/lookup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "q" })]),
    );
  });

  it("returns 400 when the query parameter is shorter than two characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await lookup(accessToken, "a");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "q" })]),
    );
  });

  it("returns 200 with the lookup result shape for a valid query", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    searchAuthors.mockResolvedValue([candidate()]);

    const res = await lookup(accessToken, "orwell");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        birthYear: 1903,
        inDb: false,
        name: "George Orwell",
        openLibraryKey: "OL23919A",
        photoUrl: "https://covers.openlibrary.org/a/olid/OL23919A-M.jpg",
        source: "open_library",
      },
    ]);
  });

  it("marks inDb true when a stored author shares the open library key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: {
        name: "Eric Blair",
        normalizedName: "eric blair",
        openLibraryKey: "OL23919A",
        userId: null,
      },
    });
    searchAuthors.mockResolvedValue([candidate({ key: "OL23919A", name: "George Orwell" })]);

    const res = await lookup(accessToken, "orwell");

    expect(res.body[0].inDb).toBe(true);
  });

  it("marks inDb true when a stored author shares the normalized name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });
    searchAuthors.mockResolvedValue([candidate({ key: "OL999A", name: "George Orwell" })]);

    const res = await lookup(accessToken, "orwell");

    expect(res.body[0].inDb).toBe(true);
  });

  it("marks inDb false when no stored author matches the candidate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "Isaac Asimov", normalizedName: "isaac asimov", userId: null },
    });
    searchAuthors.mockResolvedValue([candidate({ key: "OL23919A", name: "George Orwell" })]);

    const res = await lookup(accessToken, "orwell");

    expect(res.body[0].inDb).toBe(false);
  });

  it("does not match against another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.author.create({
      data: {
        name: "George Orwell",
        normalizedName: "george orwell",
        userId: stranger.userId,
      },
    });
    searchAuthors.mockResolvedValue([candidate({ key: "OL23919A", name: "George Orwell" })]);

    const res = await lookup(owner.accessToken, "orwell");

    expect(res.body[0].inDb).toBe(false);
  });

  it("returns an empty array when open library yields no candidates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    searchAuthors.mockResolvedValue([]);

    const res = await lookup(accessToken, "nobody");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
