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

async function addCharacter({
  bookId,
  character,
  profile,
  token,
}: {
  bookId: string;
  character: Record<string, unknown>;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { ...profile },
    character,
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function authed(method: "get" | "patch" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function linkCharacter({
  bookId,
  characterId,
  profile,
  token,
}: {
  bookId: string;
  characterId: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { ...profile },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function replaceBookAliases({
  aliases,
  bookId,
  characterId,
  token,
}: {
  aliases: Record<string, unknown>[];
  bookId: string;
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("patch", `/api/books/${bookId}/characters/${characterId}`, token).send({
    aliases,
  });
  expect(res.status).toBe(HttpStatus.OK);
}

async function replaceGlobalAliases({
  aliases,
  characterId,
  token,
}: {
  aliases: Record<string, unknown>[];
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("patch", `/api/characters/${characterId}`, token).send({ aliases });
  expect(res.status).toBe(HttpStatus.OK);
}

async function roster(
  token: string,
  bookId: string,
  query = "",
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const res = await authed("get", `/api/books/${bookId}/characters${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("book roster alias search", () => {
  it("finds a character by a revealable global alias", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const characterId = await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      token: accessToken,
    });
    await replaceGlobalAliases({
      aliases: [{ isSpoiler: false, name: "Usul", type: "nickname" }],
      characterId,
      token: accessToken,
    });

    const found = await roster(accessToken, bookId, "?search=usul");
    expect(found.totalCount).toBe(1);
    expect(found.items[0]?.characterId).toBe(characterId);
  });

  it("finds a character by an alias scoped to the current book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const characterId = await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      token: accessToken,
    });
    await replaceBookAliases({
      aliases: [{ isSpoiler: false, name: "Lisan al-Gaib", type: "title" }],
      bookId,
      characterId,
      token: accessToken,
    });

    const found = await roster(accessToken, bookId, "?search=lisan");
    expect(found.totalCount).toBe(1);
    expect(found.items[0]?.characterId).toBe(characterId);
  });

  it("never matches a spoiler alias", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const characterId = await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      token: accessToken,
    });
    await replaceGlobalAliases({
      aliases: [{ isSpoiler: true, name: "Muad'Dib", type: "nickname" }],
      characterId,
      token: accessToken,
    });

    const hidden = await roster(accessToken, bookId, "?search=muad");
    expect(hidden.totalCount).toBe(0);

    const byName = await roster(accessToken, bookId, "?search=atreides");
    expect(byName.totalCount).toBe(1);
  });

  it("ignores an alias that belongs to another book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const otherBookId = await createBook(accessToken, "Dune Messiah");
    const characterId = await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      token: accessToken,
    });
    await linkCharacter({ bookId: otherBookId, characterId, token: accessToken });
    await replaceBookAliases({
      aliases: [{ isSpoiler: false, name: "Emperor Muad'Dib", type: "title" }],
      bookId: otherBookId,
      characterId,
      token: accessToken,
    });

    const firstBook = await roster(accessToken, bookId, "?search=emperor");
    expect(firstBook.totalCount).toBe(0);

    const secondBook = await roster(accessToken, otherBookId, "?search=emperor");
    expect(secondBook.totalCount).toBe(1);
  });
});

describe("book roster POV marker", () => {
  it("exposes isPovCharacter on every roster row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      profile: { isPovCharacter: true },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      character: { name: "Duncan Idaho" },
      profile: { isPovCharacter: false },
      token: accessToken,
    });

    const listed = await roster(accessToken, bookId, "?sort=name");
    expect(listed.items.map((item) => [item.name, item.isPovCharacter])).toEqual([
      ["Duncan Idaho", false],
      ["Paul Atreides", true],
    ]);
  });
});

describe("book roster sorting", () => {
  const IMPORTANCE_BY_NAME = [
    { importance: "mentioned", name: "Eta" },
    { importance: "central", name: "Beta" },
    { importance: "not_specified", name: "Zeta" },
    { importance: "supporting", name: "Gamma" },
    { importance: "major", name: "Alpha" },
    { importance: "episodic", name: "Delta" },
  ];

  it("orders importance first and keeps unspecified last across a page boundary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    for (const seed of IMPORTANCE_BY_NAME) {
      await addCharacter({
        bookId,
        character: { name: seed.name },
        profile: { importance: seed.importance },
        token: accessToken,
      });
    }

    const firstPage = await roster(accessToken, bookId, "?sort=importance&pageNumber=1&pageSize=4");
    expect(firstPage.totalCount).toBe(6);
    expect(firstPage.items.map((item) => item.importance)).toEqual([
      "central",
      "major",
      "supporting",
      "episodic",
    ]);

    const secondPage = await roster(
      accessToken,
      bookId,
      "?sort=importance&pageNumber=2&pageSize=4",
    );
    expect(secondPage.totalCount).toBe(6);
    expect(secondPage.items.map((item) => item.importance)).toEqual(["mentioned", "not_specified"]);
  });

  it("re-sorts a character after its importance changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const promotedId = await addCharacter({
      bookId,
      character: { name: "Duncan Idaho" },
      profile: { importance: "mentioned" },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      character: { name: "Paul Atreides" },
      profile: { importance: "supporting" },
      token: accessToken,
    });

    const before = await roster(accessToken, bookId, "?sort=importance");
    expect(before.items.map((item) => item.name)).toEqual(["Paul Atreides", "Duncan Idaho"]);

    const patched = await authed(
      "patch",
      `/api/books/${bookId}/characters/${promotedId}`,
      accessToken,
    ).send({ importance: "central" });
    expect(patched.status).toBe(HttpStatus.OK);

    const after = await roster(accessToken, bookId, "?sort=importance");
    expect(after.items.map((item) => item.name)).toEqual(["Duncan Idaho", "Paul Atreides"]);
  });

  it("orders by name and keeps pagination totals stable", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    for (const seed of IMPORTANCE_BY_NAME) {
      await addCharacter({
        bookId,
        character: { name: seed.name },
        profile: { importance: seed.importance },
        token: accessToken,
      });
    }

    const firstPage = await roster(accessToken, bookId, "?sort=name&pageNumber=1&pageSize=4");
    expect(firstPage.totalCount).toBe(6);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha", "Beta", "Delta", "Eta"]);

    const secondPage = await roster(accessToken, bookId, "?sort=name&pageNumber=2&pageSize=4");
    expect(secondPage.totalCount).toBe(6);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Gamma", "Zeta"]);
  });

  it("defaults to the manual sortOrder the roster already used", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addCharacter({
      bookId,
      character: { name: "Alpha" },
      profile: { importance: "mentioned", sortOrder: 2 },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      character: { name: "Zeta" },
      profile: { importance: "central", sortOrder: 1 },
      token: accessToken,
    });

    const listed = await roster(accessToken, bookId);
    expect(listed.items.map((item) => item.name)).toEqual(["Zeta", "Alpha"]);
  });

  it("keeps the alias search predicate and the total in agreement", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    for (const name of ["Alpha", "Beta", "Gamma"]) {
      const characterId = await addCharacter({
        bookId,
        character: { name },
        token: accessToken,
      });
      await replaceGlobalAliases({
        aliases: [{ isSpoiler: false, name: `${name} the Fremen`, type: "nickname" }],
        characterId,
        token: accessToken,
      });
    }

    const firstPage = await roster(accessToken, bookId, "?search=fremen&pageSize=2&sort=name");
    expect(firstPage.totalCount).toBe(3);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha", "Beta"]);

    const secondPage = await roster(
      accessToken,
      bookId,
      "?search=fremen&pageSize=2&pageNumber=2&sort=name",
    );
    expect(secondPage.totalCount).toBe(3);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Gamma"]);
  });
});
