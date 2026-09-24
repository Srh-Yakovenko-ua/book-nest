import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
  app = context.app;
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

function authed(method: "get" | "patch" | "post", url: string, token: string): request.Test {
  return request(app.getHttpServer())[method](url).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    ageCategory: "16_plus",
    authors: [{ name: "Френк Герберт" }],
    bookType: "solo",
    formats: ["paper"],
    languages: ["uk"],
    ownershipStatus: "owned",
    readingProgress: {},
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook(token: string, bookId: string, name: string): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: {},
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function linkExisting(token: string, bookId: string, characterId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: {},
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function overview(token: string) {
  const res = await authed("get", "/api/characters/overview", token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("GET /api/characters/overview", () => {
  it("reports an empty catalog without pretending there is a leader", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await overview(accessToken)).toEqual({
      favoriteCount: 0,
      mostFrequent: null,
      multipleBooksCount: 0,
      totalCount: 0,
      withPersonalImpressionCount: 0,
    });
  });

  it("counts the catalog independently of the list page size", async () => {
    const { accessToken } = await context.registerVerifyAndLogin({ email: "counts@example.com" });
    const first = await createBook(accessToken, "Дюна");
    const second = await createBook(accessToken, "Месія Дюни");

    const paul = await createInBook(accessToken, first, "Paul");
    await linkExisting(accessToken, second, paul);
    await createInBook(accessToken, first, "Chani");
    const stilgar = await createInBook(accessToken, first, "Stilgar");

    await authed("patch", `/api/characters/${stilgar}`, accessToken).send({ isFavorite: true });
    await authed("patch", `/api/books/${first}/characters/${stilgar}`, accessToken).send({
      personalImpression: "Найкращий наїб",
    });

    const list = await authed("get", "/api/characters?pageSize=1", accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body.items).toHaveLength(1);

    const body = await overview(accessToken);
    expect(body.totalCount).toBe(3);
    expect(body.favoriteCount).toBe(1);
    expect(body.withPersonalImpressionCount).toBe(1);
    expect(body.multipleBooksCount).toBe(1);
  });

  it("names a single leader and matches its appearance count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin({ email: "leader@example.com" });
    const first = await createBook(accessToken, "Дюна");
    const second = await createBook(accessToken, "Месія Дюни");

    const paul = await createInBook(accessToken, first, "Paul");
    await linkExisting(accessToken, second, paul);
    await createInBook(accessToken, first, "Chani");

    const body = await overview(accessToken);
    expect(body.mostFrequent).toMatchObject({ appearanceCount: 2, leaderCount: 1 });
    expect(body.mostFrequent.leaders).toHaveLength(1);
    expect(body.mostFrequent.leaders[0].name).toBe("Paul");
  });

  it("admits a tie instead of picking the alphabetical winner", async () => {
    const { accessToken } = await context.registerVerifyAndLogin({ email: "tie@example.com" });
    const first = await createBook(accessToken, "Дюна");
    const second = await createBook(accessToken, "Месія Дюни");

    const paul = await createInBook(accessToken, first, "Paul");
    const chani = await createInBook(accessToken, first, "Chani");
    await linkExisting(accessToken, second, paul);
    await linkExisting(accessToken, second, chani);

    const body = await overview(accessToken);
    expect(body.mostFrequent.appearanceCount).toBe(2);
    expect(body.mostFrequent.leaderCount).toBe(2);
    expect(body.mostFrequent.leaders.map((leader: { name: string }) => leader.name).sort()).toEqual(
      ["Chani", "Paul"],
    );
  });

  it("never reports another owner's characters", async () => {
    const owner = await context.registerVerifyAndLogin({ email: "owner@example.com" });
    const intruder = await context.registerVerifyAndLogin({ email: "intruder2@example.com" });
    const bookId = await createBook(owner.accessToken, "Дюна");
    await createInBook(owner.accessToken, bookId, "Paul");

    expect((await overview(intruder.accessToken)).totalCount).toBe(0);
  });
});

describe("GET /api/characters quick filters", () => {
  async function seedCatalog(): Promise<string> {
    const auth = await context.registerVerifyAndLogin({ email: "quick@example.com" });
    const token = auth.accessToken;
    const first = await createBook(token, "Дюна");
    const second = await createBook(token, "Месія Дюни");

    const paul = await createInBook(token, first, "Paul");
    await linkExisting(token, second, paul);
    const chani = await createInBook(token, first, "Chani");
    await authed("patch", `/api/books/${first}/characters/${chani}`, token).send({
      personalImpression: "Фрименка",
    });
    await createInBook(token, first, "Stilgar");
    return token;
  }

  it("filters to the characters that appear in more than one book", async () => {
    const token = await seedCatalog();
    const res = await authed("get", "/api/characters?multipleBooks=true", token);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].name).toBe("Paul");
  });

  it("filters to the characters that carry a personal impression", async () => {
    const token = await seedCatalog();
    const res = await authed("get", "/api/characters?hasPersonalImpression=true", token);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].name).toBe("Chani");
  });

  it("treats a blank impression as no impression", async () => {
    const token = await seedCatalog();
    const withImpression = await authed("get", "/api/characters?hasPersonalImpression=true", token);
    const without = await authed("get", "/api/characters?hasPersonalImpression=false", token);

    expect(withImpression.body.totalCount + without.body.totalCount).toBe(3);
  });

  it("agrees with the overview counts", async () => {
    const token = await seedCatalog();
    const body = await overview(token);
    const multiple = await authed("get", "/api/characters?multipleBooks=true", token);
    const impressions = await authed("get", "/api/characters?hasPersonalImpression=true", token);
    const favorites = await authed("get", "/api/characters?favorite=true", token);
    const all = await authed("get", "/api/characters", token);

    expect(body.multipleBooksCount).toBe(multiple.body.totalCount);
    expect(body.withPersonalImpressionCount).toBe(impressions.body.totalCount);
    expect(body.favoriteCount).toBe(favorites.body.totalCount);
    expect(body.totalCount).toBe(all.body.totalCount);
  });
});
