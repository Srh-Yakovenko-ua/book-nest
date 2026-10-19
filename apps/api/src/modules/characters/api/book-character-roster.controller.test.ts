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

describe("book roster filters", () => {
  const CAST = [
    { importance: "central", isFavorite: true, isPovCharacter: true, name: "Paul" },
    { importance: "major", isFavorite: false, isPovCharacter: true, name: "Jessica" },
    { importance: "major", isFavorite: true, isPovCharacter: false, name: "Leto" },
    { importance: "not_specified", isFavorite: true, isPovCharacter: false, name: "Stilgar" },
    { importance: "mentioned", isFavorite: false, isPovCharacter: false, name: "Shaddam" },
  ];

  async function seedCast(token: string): Promise<string> {
    const bookId = await createBook(token, "Dune");
    for (const member of CAST) {
      await addCharacter({
        bookId,
        character: { isFavorite: member.isFavorite, name: member.name },
        profile: { importance: member.importance, isPovCharacter: member.isPovCharacter },
        token,
      });
    }
    return bookId;
  }

  function names(page: { items: Record<string, unknown>[] }): unknown[] {
    return page.items.map((item) => item.name);
  }

  it("matches selected importances with OR, comma-separated or repeated", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await seedCast(accessToken);

    const csv = await roster(accessToken, bookId, "?sort=name&importance=major,not_specified");
    const repeated = await roster(
      accessToken,
      bookId,
      "?sort=name&importance=major&importance=not_specified&importance=major",
    );

    expect(names(csv)).toEqual(["Jessica", "Leto", "Stilgar"]);
    expect(csv.totalCount).toBe(3);
    expect(names(repeated)).toEqual(names(csv));
    expect(repeated.totalCount).toBe(3);
  });

  it("ANDs favorites, POV, importance and search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await seedCast(accessToken);

    const favorites = await roster(accessToken, bookId, "?sort=name&favoritesOnly=true");
    const pov = await roster(accessToken, bookId, "?sort=name&povOnly=true");
    const favoritePov = await roster(accessToken, bookId, "?favoritesOnly=true&povOnly=true");
    const combined = await roster(
      accessToken,
      bookId,
      "?sort=name&favoritesOnly=true&importance=major,not_specified&search=st",
    );
    const disabled = await roster(accessToken, bookId, "?favoritesOnly=false&povOnly=false");

    expect(names(favorites)).toEqual(["Leto", "Paul", "Stilgar"]);
    expect(names(pov)).toEqual(["Jessica", "Paul"]);
    expect(names(favoritePov)).toEqual(["Paul"]);
    expect(names(combined)).toEqual(["Stilgar"]);
    expect(combined.totalCount).toBe(1);
    expect(disabled.totalCount).toBe(CAST.length);
  });

  it("rejects an unknown importance or a malformed boolean", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");

    for (const query of ["?importance=heroic", "?favoritesOnly=maybe", "?povOnly=1x"]) {
      const res = await authed("get", `/api/books/${bookId}/characters${query}`, accessToken);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it("keeps the filtered total in agreement with the pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Crowd");
    const favoriteNames = Array.from({ length: 23 }, (_, index) => `Fan ${index + 10}`);
    for (const name of favoriteNames) {
      await addCharacter({ bookId, character: { isFavorite: true, name }, token: accessToken });
    }
    await addCharacter({ bookId, character: { name: "Stranger" }, token: accessToken });

    const query = "?sort=name&favoritesOnly=true&pageSize=20";
    const first = await roster(accessToken, bookId, query);
    const second = await roster(accessToken, bookId, `${query}&pageNumber=2`);

    expect(first.totalCount).toBe(favoriteNames.length);
    expect(second.totalCount).toBe(favoriteNames.length);
    expect([...names(first), ...names(second)]).toEqual(favoriteNames);
  });
});

describe("book roster card payload", () => {
  async function createSpecies(token: string, name: string): Promise<string> {
    const res = await authed("post", "/api/species", token).send({ name });
    expect(res.status).toBe(HttpStatus.CREATED);
    return res.body.id;
  }

  it("serves the safe card fields and none of the hidden values", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const humanId = await createSpecies(accessToken, "Human");
    const fremenId = await createSpecies(accessToken, "Fremen");
    await addCharacter({
      bookId,
      character: { name: "Paul", neutralDescription: "Heir of Caladan", speciesId: humanId },
      profile: {
        description: "Becomes the Kwisatz Haderach",
        descriptionIsSpoiler: true,
        roles: [
          { position: 0, roleType: "protagonist" },
          { customRole: "Secret emperor", isSpoiler: true, position: 1, roleType: "custom" },
          { customRole: "Desert mouse", position: 2, roleType: "custom" },
          { position: 3, roleType: "love_interest" },
        ],
        speciesOverrideId: fremenId,
        speciesOverrideIsSpoiler: true,
        status: "other",
        statusCustomText: "Godlike",
        statusIsSpoiler: true,
      },
      token: accessToken,
    });

    const res = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const [item] = res.body.items;

    expect(item).toMatchObject({
      descriptionPreview: "Heir of Caladan",
      hiddenFields: ["description", "roles", "speciesOverride", "status"],
      species: null,
      status: null,
      statusCustomText: null,
    });
    expect(
      item.roles.map((visible: { customRole: unknown; roleType: unknown }) => [
        visible.roleType,
        visible.customRole,
      ]),
    ).toEqual([
      ["protagonist", null],
      ["custom", "Desert mouse"],
      ["love_interest", null],
    ]);
    const serialized = JSON.stringify(res.body);
    for (const secret of ["Kwisatz", "Secret emperor", "Godlike", fremenId, humanId]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("shows the visible book description, override and custom status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const humanId = await createSpecies(accessToken, "Human");
    const fremenId = await createSpecies(accessToken, "Fremen");
    await addCharacter({
      bookId,
      character: { name: "Chani", neutralDescription: "Neutral", speciesId: humanId },
      profile: {
        description: "A Fremen warrior",
        speciesOverrideId: fremenId,
        status: "other",
        statusCustomText: "Wandering",
      },
      token: accessToken,
    });

    const [item] = (await roster(accessToken, bookId)).items;

    expect(item).toMatchObject({
      descriptionPreview: "A Fremen warrior",
      hiddenFields: [],
      species: { id: fremenId },
      status: "other",
      statusCustomText: "Wandering",
    });
  });

  it("keeps the book summary top list on the base summary shape", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addCharacter({
      bookId,
      character: { name: "Paul", neutralDescription: "Heir of Caladan" },
      profile: { description: "Heir", importance: "central", roles: [{ roleType: "protagonist" }] },
      token: accessToken,
    });

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const [top] = res.body.top;

    expect(top.name).toBe("Paul");
    for (const rosterOnlyKey of ["descriptionPreview", "roles", "species", "statusCustomText"]) {
      expect(top).not.toHaveProperty(rosterOnlyKey);
    }
  });
});
