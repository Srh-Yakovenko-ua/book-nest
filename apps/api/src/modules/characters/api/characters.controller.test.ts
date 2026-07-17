import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

const bookProfile = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  importance: "central",
  ...overrides,
});

async function createNewInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<request.Response> {
  return authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: bookProfile(profile),
    character: { name: "Paul Atreides", ...character },
    mode: "new",
  });
}

describe("character catalog CRUD", () => {
  it("creates a global character with a first appearance and reads it back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await authed("post", "/api/characters", accessToken).send({
      character: { entityKind: "individual", gender: "male", name: "Paul Atreides" },
      firstAppearance: { bookId, bookProfile: bookProfile({ status: "active" }) },
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.id).toMatch(UUID);
    expect(created.body).toMatchObject({
      entityKind: "individual",
      gender: "male",
      name: "Paul Atreides",
    });
    expect(created.body.appearances).toHaveLength(1);
    expect(created.body.appearances[0]).toMatchObject({ bookId, importance: "central" });

    const read = await authed("get", `/api/characters/${created.body.id}`, accessToken);
    expect(read.status).toBe(HttpStatus.OK);
    expect(read.body.name).toBe("Paul Atreides");
    expect(read.body.appearances).toHaveLength(1);
  });

  it("reuses one character identity across several books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await createBook(accessToken, { title: "Dune" });
    const secondBook = await createBook(accessToken, { title: "Dune Messiah" });

    const created = await createNewInBook(accessToken, firstBook, { name: "Paul Atreides" });
    expect(created.status).toBe(HttpStatus.CREATED);
    const characterId = created.body.id;

    const linked = await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: bookProfile({ importance: "major" }),
      characterId,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);
    expect(linked.body.id).toBe(characterId);

    const global = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(global.body.appearances).toHaveLength(2);
  });

  it("rejects linking the same character to a book twice", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;

    const duplicate = await authed("post", `/api/books/${bookId}/characters`, accessToken).send({
      bookProfile: bookProfile(),
      characterId,
      mode: "existing",
    });
    expect(duplicate.status).toBe(HttpStatus.CONFLICT);
    expect(duplicate.body.code).toBe("character_already_linked_to_book");
  });

  it("allows two different characters with the same name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const first = await createNewInBook(accessToken, bookId, { name: "The Stranger" });
    const second = await authed("post", "/api/characters", accessToken).send({
      character: { name: "The Stranger" },
    });
    expect(first.status).toBe(HttpStatus.CREATED);
    expect(second.status).toBe(HttpStatus.CREATED);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it("does not overwrite global data when linking an existing character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await createBook(accessToken, { title: "Dune" });
    const secondBook = await createBook(accessToken, { title: "Dune Messiah" });

    const created = await createNewInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides", neutralDescription: "House Atreides heir" },
      { displayName: "Muad'Dib" },
    );
    const characterId = created.body.id;

    await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: bookProfile({ displayName: "The Preacher" }),
      characterId,
      mode: "existing",
    });

    const global = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(global.body.neutralDescription).toBe("House Atreides heir");
  });
});

describe("character validation", () => {
  it("rejects roleType narrator and point_of_view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const narrator = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { roles: [{ roleType: "narrator" }] },
    );
    expect(narrator.status).toBe(HttpStatus.BAD_REQUEST);

    const pov = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { roles: [{ roleType: "point_of_view" }] },
    );
    expect(pov.status).toBe(HttpStatus.BAD_REQUEST);

    const protagonist = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }] },
    );
    expect(protagonist.status).toBe(HttpStatus.CREATED);
    expect(protagonist.body.appearances[0].roles[0].roleType).toBe("protagonist");
  });

  it("rejects entityKind group", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/characters", accessToken).send({
      character: { entityKind: "group", name: "The Council" },
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);

    const collective = await authed("post", "/api/characters", accessToken).send({
      character: { entityKind: "collective", name: "The Council" },
    });
    expect(collective.status).toBe(HttpStatus.CREATED);
  });
});

describe("character ownership (IDOR)", () => {
  it("returns 404 without leaking existence for foreign character, book and media", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });

    const ownerBook = await createBook(owner.accessToken);
    const character = await createNewInBook(owner.accessToken, ownerBook, {
      name: "Paul Atreides",
    });
    const characterId = character.body.id;

    const foreignCharacter = await authed(
      "get",
      `/api/characters/${characterId}`,
      intruder.accessToken,
    );
    expect(foreignCharacter.status).toBe(HttpStatus.NOT_FOUND);

    const foreignBookRoster = await authed(
      "get",
      `/api/books/${ownerBook}/characters`,
      intruder.accessToken,
    );
    expect(foreignBookRoster.status).toBe(HttpStatus.NOT_FOUND);

    const intruderBook = await createBook(intruder.accessToken, { title: "Foundation" });
    const linkForeignCharacter = await authed(
      "post",
      `/api/books/${intruderBook}/characters`,
      intruder.accessToken,
    ).send({ bookProfile: bookProfile(), characterId, mode: "existing" });
    expect(linkForeignCharacter.status).toBe(HttpStatus.NOT_FOUND);
    expect(linkForeignCharacter.body.code).toBe("character_ownership_mismatch");

    const foreignMedia = await authed(
      "post",
      `/api/books/${intruderBook}/characters`,
      intruder.accessToken,
    ).send({
      bookProfile: bookProfile({ portraitMediaId: MISSING_ID }),
      character: { name: "Hari Seldon" },
      mode: "new",
    });
    expect(foreignMedia.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignMedia.body.code).toBe("media_ownership_mismatch");
  });

  it("returns 404 for a well-formed but missing character or book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const missingCharacter = await authed("get", `/api/characters/${MISSING_ID}`, accessToken);
    expect(missingCharacter.status).toBe(HttpStatus.NOT_FOUND);

    const missingBookRoster = await authed(
      "get",
      `/api/books/${MISSING_ID}/characters`,
      accessToken,
    );
    expect(missingBookRoster.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("rejects a character alias that references a foreign or missing book and rolls back", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/characters", accessToken).send({
      character: {
        aliases: [{ bookId: MISSING_ID, name: "Usul" }],
        name: "Paul Atreides",
      },
    });
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_book_not_found");

    const prisma = app.get(PrismaService);
    expect(await prisma.character.count({ where: { userId } })).toBe(0);
  });
});

describe("spoiler redaction", () => {
  it("omits spoiler-flagged fields from the roster but keeps them in details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      {
        description: "Becomes the Kwisatz Haderach",
        descriptionIsSpoiler: true,
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );

    const roster = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    expect(roster.status).toBe(HttpStatus.OK);
    expect(roster.body.totalCount).toBe(1);
    const item = roster.body.items[0];
    expect(item.displayName).toBeNull();
    expect(item.status).toBeNull();
    expect(item.hiddenFields).toEqual(expect.arrayContaining(["displayName", "status"]));
    expect(item.hiddenFields).not.toContain("description");
    expect(JSON.stringify(item)).not.toContain("Muad'Dib");
    expect(JSON.stringify(item)).not.toContain("Kwisatz Haderach");

    const details = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    const characterId = details.body.items[0].characterId;
    const full = await authed("get", `/api/books/${bookId}/characters/${characterId}`, accessToken);
    expect(full.status).toBe(HttpStatus.OK);
    const appearance = full.body.appearances[0];
    expect(appearance.displayName).toBe("Muad'Dib");
    expect(appearance.description).toBe("Becomes the Kwisatz Haderach");
    expect(appearance.displayNameIsSpoiler).toBe(true);
    expect(appearance.hiddenFields).toEqual(
      expect.arrayContaining(["description", "displayName", "status"]),
    );
  });

  it("hides characters flagged with hidePresenceAsSpoiler from the roster", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createNewInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const roster = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    expect(roster.body.totalCount).toBe(1);
    expect(roster.body.items[0].name).toBe("Paul Atreides");
  });
});

describe("create-in-book transaction", () => {
  it("rolls back the new character when a mid-create step fails", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const failed = await authed("post", `/api/books/${bookId}/characters`, accessToken).send({
      bookProfile: bookProfile({ portraitMediaId: MISSING_ID }),
      character: { name: "Paul Atreides" },
      mode: "new",
    });
    expect(failed.status).toBe(HttpStatus.NOT_FOUND);
    expect(failed.body.code).toBe("media_ownership_mismatch");

    const prisma = app.get(PrismaService);
    expect(await prisma.character.count({ where: { userId } })).toBe(0);
    expect(await prisma.bookCharacter.count({ where: { bookId } })).toBe(0);
  });
});

describe("cascade and invariants", () => {
  it("removes book appearances but keeps the global character when the book is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.NO_CONTENT);

    const global = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(global.status).toBe(HttpStatus.OK);
    expect(global.body.appearances).toHaveLength(0);
  });

  it("cascades character deletion when the owning user is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    expect(created.status).toBe(HttpStatus.CREATED);

    const prisma = app.get(PrismaService);
    expect(await prisma.character.count({ where: { userId } })).toBe(1);

    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.character.count({ where: { userId } })).toBe(0);
  });
});
