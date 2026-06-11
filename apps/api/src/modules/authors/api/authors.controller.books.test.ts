import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { OpenLibraryWork } from "../infrastructure/open-library.client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { AuthorsModule } from "../authors.module.js";
import { OpenLibraryClient } from "../infrastructure/open-library.client.js";
import { WikidataClient } from "../infrastructure/wikidata.client.js";

const BAD_UUID = "not-a-uuid";
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

const work: OpenLibraryWork = {
  coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
  firstPublishYear: 1949,
  openLibraryWorkKey: "OL1W",
  title: "1984",
};

const getWorksByAuthor = vi.fn<(olid: string) => Promise<OpenLibraryWork[]>>();
const getAuthorFactsByQid = vi.fn().mockResolvedValue(null);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, AuthorsModule],
    [
      { provide: OpenLibraryClient, useValue: { getWorksByAuthor } },
      { provide: WikidataClient, useValue: { getAuthorFactsByQid } },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  getWorksByAuthor.mockReset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function seedAuthor(data: {
  name: string;
  normalizedName: string;
  openLibraryKey?: string;
  userId?: string;
}): Promise<string> {
  const created = await prisma.author.create({
    data: {
      name: data.name,
      normalizedName: data.normalizedName,
      openLibraryKey: data.openLibraryKey ?? null,
      userId: data.userId ?? null,
    },
  });
  return created.id;
}

describe("GET /api/authors/:id/books", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/authors/${MISSING_UUID}/books`);

    expect(res.status).toBe(401);
  });

  it("returns 400 when the author id is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get(`/api/authors/${BAD_UUID}/books`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 when the author is not visible to the user", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get(`/api/authors/${MISSING_UUID}/books`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("proxies the open library works for a global author with an open library key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    getWorksByAuthor.mockResolvedValue([work]);
    const authorId = await seedAuthor({
      name: "George Orwell",
      normalizedName: "george orwell",
      openLibraryKey: "OL23919A",
    });

    const res = await request(app.getHttpServer())
      .get(`/api/authors/${authorId}/books`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([work]);
    expect(getWorksByAuthor).toHaveBeenCalledWith("OL23919A");
  });

  it("returns an empty list without calling open library when the author has no open library key", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorId = await seedAuthor({
      name: "My Custom Author",
      normalizedName: "my custom author",
      userId,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/authors/${authorId}/books`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(getWorksByAuthor).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const authorId = await seedAuthor({
      name: "Owner Author",
      normalizedName: "owner author",
      userId: owner.userId,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/authors/${authorId}/books`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });
});
