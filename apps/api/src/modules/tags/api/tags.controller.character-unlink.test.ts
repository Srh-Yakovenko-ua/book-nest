import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { TagsUsageFixtures } from "./tags-usage.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../../characters/characters.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { createTagsUsageFixtures } from "./tags-usage.fixtures.js";

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let seed: TagsUsageFixtures;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [{ provide: StoragePort, useValue: storageStub }],
  );
  app = context.app;
  seed = createTagsUsageFixtures(app.get(PrismaService));
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function authed(method: "delete" | "get", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

describe("character tags after unlinking a character from a book", () => {
  it("I-CHAR-03 keeps the global character tag and its catalog usage once the character leaves every book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await seed.book({ title: "Dune", userId });
    const paul = await seed.character({ name: "Paul", userId });
    await seed.appearIn({ bookIds: [book.id], characterId: paul.id });
    const tag = await seed.tag({ name: "chosen one", userId });
    await seed.tagCharacters({ characterIds: [paul.id], tagId: tag.id });

    const unlink = await authed(
      "delete",
      `/api/books/${book.id}/characters/${paul.id}`,
      accessToken,
    );
    const catalog = await authed("get", "/api/tags/catalog", accessToken);
    const preview = await authed("get", `/api/tags/${tag.id}/deletion-preview`, accessToken);

    expect(unlink.status).toBe(204);
    expect(catalog.body.items[0]).toMatchObject({ charactersCount: 1, name: "chosen one" });
    expect(preview.body).toEqual({ bookLinksCount: 0, characterLinksCount: 1 });
  });
});
