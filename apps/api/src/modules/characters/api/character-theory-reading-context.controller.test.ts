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
  character,
  name,
  profile,
  token,
}: {
  bookId: string;
  character?: Record<string, unknown>;
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central", ...profile },
    character: { name, ...character },
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

describe("character theories reading-position gating", () => {
  it("hides a theory whose character first appears in a later chapter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const early = await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await createTheory({ characterId: early, text: "Idaho is a ghola", token: accessToken });
    await createTheory({ characterId: late, text: "Alia is possessed", token: accessToken });

    const ungated = await listTheories(accessToken, `?contextBookId=${secondBook}`);
    expect(ungated.totalCount).toBe(2);

    const gated = await listTheories(accessToken, `?contextBookId=${secondBook}&contextChapter=5`);
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((theory) => theory.text)).toEqual(["Idaho is a ghola"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
    expect(JSON.stringify(gated)).not.toContain("Alia is possessed");

    const reached = await listTheories(
      accessToken,
      `?contextBookId=${secondBook}&contextChapter=40`,
    );
    expect(reached.totalCount).toBe(2);
  });

  it("hides a theory whose character first appears on a later page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });
    await createTheory({ characterId: late, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(accessToken, `?contextBookId=${secondBook}&contextPage=50`);
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const reached = await listTheories(accessToken, `?contextBookId=${secondBook}&contextPage=420`);
    expect(reached.totalCount).toBe(1);
  });

  it("hides a theory whose character first appears at a later audiobook position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });
    await createTheory({ characterId: late, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(
      accessToken,
      `?contextBookId=${secondBook}&contextAudioSeconds=600`,
    );
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const reached = await listTheories(
      accessToken,
      `?contextBookId=${secondBook}&contextAudioSeconds=36000`,
    );
    expect(reached.totalCount).toBe(1);
  });

  it("keeps a theory about an earlier part's character while a position gates the context book", async () => {
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
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    await createTheory({ characterId: earlierPart, text: "Paul survives", token: accessToken });
    await createTheory({ characterId: futurePart, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(accessToken, `?contextBookId=${secondBook}&contextChapter=5`);
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((theory) => theory.text)).toEqual(["Paul survives"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
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

    const gated = await listTheories(accessToken, `?contextBookId=${firstBook}&contextChapter=99`);
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const full = await listTheories(accessToken);
    expect(full.totalCount).toBe(1);
  });

  it("keeps a theory about a presence-hidden character out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const traitor = await addCharacter({
      bookId: secondBook,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });
    await createTheory({ characterId: traitor, text: "The Traitor betrays", token: accessToken });

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const gated = await listTheories(accessToken, `?contextBookId=${secondBook}${position}`);
      expect(gated.totalCount).toBe(0);
      expect(JSON.stringify(gated)).not.toContain("The Traitor");
    }
  });

  it("keeps a theory about a profile-hidden character out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const heir = await addCharacter({
      bookId: secondBook,
      character: { hideProfileAsSpoiler: true },
      name: "Leto II",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    await createTheory({ characterId: heir, text: "Leto II transforms", token: accessToken });

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const gated = await listTheories(accessToken, `?contextBookId=${secondBook}${position}`);
      expect(gated.totalCount).toBe(0);
      expect(JSON.stringify(gated)).not.toContain("Leto II");
    }
  });

  it("counts a gated page from the same visible set the items come from", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const reached = await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    const unreached = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
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

    const query = `?contextBookId=${secondBook}&contextChapter=5&pageSize=${THEORY_PAGE_BOUNDARY_SIZE}`;
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
    const { secondBook } = await createSeries(accessToken);
    const unreached = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await createTheory({ characterId: unreached, text: "Alia is possessed", token: accessToken });

    const gated = await listTheories(
      accessToken,
      `?contextBookId=${secondBook}&contextChapter=5&search=possessed`,
    );
    expect(gated.totalCount).toBe(0);
    expect(gated.items).toEqual([]);
    expect(JSON.stringify(gated)).not.toContain("Alia");
  });

  it("rejects a reading position unless the context book is named", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const unreached = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await createTheory({ characterId: unreached, text: "Alia is possessed", token: accessToken });

    const bare = await authed("get", "/api/character-theories?contextChapter=5", accessToken);
    expect(bare.status).toBe(HttpStatus.BAD_REQUEST);
    expect(bare.body.errorsMessages).toEqual([
      {
        field: "contextBookId",
        message: "contextBookId is required when a reading position is supplied",
      },
    ]);
    expect(JSON.stringify(bare.body)).not.toContain("Alia Atreides");
  });

  it("leaves a request with no context book and no position untouched", async () => {
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
