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

type SeriesSetup = { firstBook: string; secondBook: string; seriesId: string };

type TheoriesBody = {
  items: { characterName: null | string; id: string; text: string }[];
  totalCount: number;
};

const THEORY_PAGE_BOUNDARY_SIZE = 2;

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

async function addCharacter({
  bookId,
  name,
  profile,
  token,
}: {
  bookId: string;
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central", ...profile },
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function authed(method: "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createSeries(token: string): Promise<SeriesSetup> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: "Dune Saga" },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  const seriesId = res.body.series.id;
  const secondBook = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId,
    title: "Dune Messiah",
  });
  expect(secondBook.status).toBe(HttpStatus.CREATED);
  return { firstBook: res.body.id, secondBook: secondBook.body.id, seriesId };
}

async function createTheory({
  characterId,
  text,
  token,
}: {
  characterId: string;
  text: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", "/api/character-theories", token).send({ characterId, text });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function listTheories(token: string, query = ""): Promise<TheoriesBody> {
  const res = await authed("get", `/api/character-theories${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("character theories in a reading context", () => {
  it("lists theories whatever their character's first-appearance chapter, page or audio position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    for (const seed of [
      { name: "Duncan Idaho", profile: { firstAppearanceChapter: "2" }, text: "Idaho is a ghola" },
      {
        name: "Alia Atreides",
        profile: { firstAppearanceChapter: "40" },
        text: "Alia is possessed",
      },
      { name: "Hayt", profile: { firstAppearancePage: 420 }, text: "Hayt remembers" },
      { name: "Scytale", profile: { firstAppearanceAudioSeconds: 36000 }, text: "Scytale plots" },
    ]) {
      const characterId = await addCharacter({
        bookId: secondBook,
        name: seed.name,
        profile: seed.profile,
        token: accessToken,
      });
      await createTheory({ characterId, text: seed.text, token: accessToken });
    }

    const listed = await listTheories(accessToken, `?contextBookId=${secondBook}`);

    expect(listed.totalCount).toBe(4);
    expect(listed.items.map((theory) => theory.text).sort()).toEqual([
      "Alia is possessed",
      "Hayt remembers",
      "Idaho is a ghola",
      "Scytale plots",
    ]);
  });

  it("lists theories about the context book's and earlier parts' characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const earlierPart = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    const contextPart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    await createTheory({ characterId: earlierPart, text: "Paul survives", token: accessToken });
    await createTheory({ characterId: contextPart, text: "Alia is possessed", token: accessToken });

    const listed = await listTheories(accessToken, `?contextBookId=${secondBook}`);

    expect(listed.items.map((theory) => theory.text).sort()).toEqual([
      "Alia is possessed",
      "Paul survives",
    ]);
  });

  it("hides a theory about a future part's character while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const futurePart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    await createTheory({ characterId: futurePart, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(accessToken, `?contextBookId=${firstBook}`);
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const full = await listTheories(accessToken);
    expect(full.totalCount).toBe(1);
  });

  it("counts a gated page from the same visible set the items come from", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const reached = await addCharacter({
      bookId: firstBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    const unreached = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    for (const index of [1, 2, 3]) {
      await createTheory({
        characterId: reached,
        text: `Idaho theory ${index}`,
        token: accessToken,
      });
      await createTheory({
        characterId: unreached,
        text: `Alia theory ${index}`,
        token: accessToken,
      });
    }

    const query = `?contextBookId=${firstBook}&pageSize=${THEORY_PAGE_BOUNDARY_SIZE}`;
    const firstPage = await listTheories(accessToken, `${query}&pageNumber=1`);
    const secondPage = await listTheories(accessToken, `${query}&pageNumber=2`);

    expect(firstPage.totalCount).toBe(3);
    expect(secondPage.totalCount).toBe(3);
    expect(firstPage.items).toHaveLength(THEORY_PAGE_BOUNDARY_SIZE);
    expect(secondPage.items).toHaveLength(1);
    expect([...firstPage.items, ...secondPage.items].map((theory) => theory.text).sort()).toEqual([
      "Idaho theory 1",
      "Idaho theory 2",
      "Idaho theory 3",
    ]);
    expect(JSON.stringify(firstPage)).not.toContain("Alia");
    expect(JSON.stringify(secondPage)).not.toContain("Alia");
  });

  it("gates contextual search by the same visible set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const futurePart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await createTheory({ characterId: futurePart, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(accessToken, `?contextBookId=${firstBook}&search=possessed`);
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia");

    const found = await listTheories(accessToken, `?contextBookId=${secondBook}&search=possessed`);
    expect(found.items.map((theory) => theory.text)).toEqual(["Alia is possessed"]);
  });

  it("leaves a request with no context book untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const earlierPart = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    const futurePart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await createTheory({ characterId: earlierPart, text: "Paul survives", token: accessToken });
    await createTheory({ characterId: futurePart, text: "Alia is possessed", token: accessToken });

    const full = await listTheories(accessToken);
    expect(full.totalCount).toBe(2);
    expect(full.items.map((theory) => theory.text).sort()).toEqual([
      "Alia is possessed",
      "Paul survives",
    ]);
  });
});
