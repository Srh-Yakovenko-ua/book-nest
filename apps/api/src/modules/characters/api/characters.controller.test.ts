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

async function createTag(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/tags", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

describe("global character update", () => {
  it("rejects a book-scoped field with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    const res = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      importance: "central",
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("rejects clearing customGender while the stored gender stays custom", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { customGender: "Eldritch", gender: "custom", name: "The Old One" },
    });
    const characterId = created.body.id;

    const res = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      customGender: "",
    });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("validation_failed");

    const read = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(read.body.gender).toBe("custom");
    expect(read.body.customGender).toBe("Eldritch");
  });

  it("updates global fields and global aliases without touching the book appearance", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", importance: "central" },
    );
    const characterId = created.body.id;

    const patched = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      aliases: [{ name: "Usul", type: "nickname" }],
      isFavorite: true,
      name: "Paul Muad'Dib Atreides",
    });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.name).toBe("Paul Muad'Dib Atreides");
    expect(patched.body.isFavorite).toBe(true);

    const globalAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0]).toMatchObject({ name: "Usul", type: "nickname" });

    expect(patched.body.appearances).toHaveLength(1);
    expect(patched.body.appearances[0]).toMatchObject({
      bookId,
      displayName: "Muad'Dib",
      importance: "central",
    });
  });
});

describe("book character update", () => {
  it("rejects a global field with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;

    const res = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({ name: "Renamed Globally" });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("updates the book profile, roles, book aliases and tags without touching global data", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { aliases: [{ name: "GlobalUsul", type: "nickname" }], name: "Paul Atreides" },
      { importance: "supporting" },
    );
    const characterId = created.body.id;
    const tagId = await createTag(accessToken, "Villain");

    const patched = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({
      aliases: [{ name: "BookMuad", type: "title" }],
      displayName: "Muad'Dib",
      importance: "central",
      roles: [{ roleType: "protagonist" }],
      tagIds: [tagId],
    });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.name).toBe("Paul Atreides");

    const appearance = patched.body.appearances[0];
    expect(appearance).toMatchObject({ bookId, displayName: "Muad'Dib", importance: "central" });
    expect(appearance.roles).toHaveLength(1);
    expect(appearance.roles[0].roleType).toBe("protagonist");

    const bookAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === bookId,
    );
    expect(bookAliases).toHaveLength(1);
    expect(bookAliases[0].name).toBe("BookMuad");

    const globalAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0].name).toBe("GlobalUsul");

    const prisma = app.get(PrismaService);
    const links = await prisma.characterTag.findMany({ where: { characterId } });
    expect(links).toHaveLength(1);
    expect(links[0]?.tagId).toBe(tagId);
  });

  it("replaces the whole role set on update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }, { roleType: "supporting" }] },
    );
    const characterId = created.body.id;
    expect(created.body.appearances[0].roles).toHaveLength(2);

    const patched = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({ roles: [{ roleType: "antagonist" }] });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.appearances[0].roles).toHaveLength(1);
    expect(patched.body.appearances[0].roles[0].roleType).toBe("antagonist");
  });

  it("rejects roleType narrator and point_of_view with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;

    const narrator = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({ roles: [{ roleType: "narrator" }] });
    expect(narrator.status).toBe(HttpStatus.BAD_REQUEST);

    const pov = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({ roles: [{ roleType: "point_of_view" }] });
    expect(pov.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("replaces book aliases within the book scope only", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(accessToken, bookId, {
      aliases: [{ name: "GlobalUsul", type: "nickname" }],
      name: "Paul Atreides",
    });
    const characterId = created.body.id;

    await authed("patch", `/api/books/${bookId}/characters/${characterId}`, accessToken).send({
      aliases: [{ name: "BookMuad", type: "title" }],
    });
    const patched = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    ).send({ aliases: [{ name: "BookLisan", type: "title" }] });
    expect(patched.status).toBe(HttpStatus.OK);

    const bookAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === bookId,
    );
    expect(bookAliases).toHaveLength(1);
    expect(bookAliases[0].name).toBe("BookLisan");

    const globalAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0].name).toBe("GlobalUsul");
  });

  it("keeps book aliases when global aliases are replaced", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(accessToken, bookId, {
      aliases: [{ name: "GlobalUsul", type: "nickname" }],
      name: "Paul Atreides",
    });
    const characterId = created.body.id;

    await authed("patch", `/api/books/${bookId}/characters/${characterId}`, accessToken).send({
      aliases: [{ name: "BookMuad", type: "title" }],
    });

    const patched = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      aliases: [{ name: "NewGlobal", type: "nickname" }],
    });
    expect(patched.status).toBe(HttpStatus.OK);

    const globalAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0].name).toBe("NewGlobal");

    const bookAliases = patched.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === bookId,
    );
    expect(bookAliases).toHaveLength(1);
    expect(bookAliases[0].name).toBe("BookMuad");
  });

  it("rejects a foreign or missing tag and links nothing", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);
    const created = await createNewInBook(owner.accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;
    const foreignTagId = await createTag(intruder.accessToken, "Foreign");

    const foreign = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      owner.accessToken,
    ).send({ tagIds: [foreignTagId] });
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreign.body.code).toBe("character_tag_not_found");

    const missing = await authed(
      "patch",
      `/api/books/${bookId}/characters/${characterId}`,
      owner.accessToken,
    ).send({ tagIds: [MISSING_ID] });
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
    expect(missing.body.code).toBe("character_tag_not_found");

    const prisma = app.get(PrismaService);
    expect(await prisma.characterTag.count({ where: { characterId } })).toBe(0);
  });
});

describe("book character unlink", () => {
  it("removes only the book appearance, roles and book aliases while keeping the global profile", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await createBook(accessToken, { title: "Dune" });
    const secondBook = await createBook(accessToken, { title: "Dune Messiah" });

    const created = await createNewInBook(
      accessToken,
      firstBook,
      { aliases: [{ name: "GlobalUsul", type: "nickname" }], name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }] },
    );
    const characterId = created.body.id;

    await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: bookProfile({ importance: "major" }),
      characterId,
      mode: "existing",
    });

    const tagId = await createTag(accessToken, "Hero");
    await authed("patch", `/api/books/${firstBook}/characters/${characterId}`, accessToken).send({
      aliases: [{ name: "FirstBookAlias", type: "title" }],
      tagIds: [tagId],
    });

    const unlinked = await authed(
      "delete",
      `/api/books/${firstBook}/characters/${characterId}`,
      accessToken,
    );
    expect(unlinked.status).toBe(HttpStatus.NO_CONTENT);

    const global = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(global.status).toBe(HttpStatus.OK);
    expect(global.body.appearances).toHaveLength(1);
    expect(global.body.appearances[0].bookId).toBe(secondBook);

    const globalAliases = global.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0].name).toBe("GlobalUsul");

    const firstBookAliases = global.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === firstBook,
    );
    expect(firstBookAliases).toHaveLength(0);

    const prisma = app.get(PrismaService);
    expect(await prisma.characterTag.count({ where: { characterId } })).toBe(1);
    expect(await prisma.bookCharacter.count({ where: { bookId: firstBook, characterId } })).toBe(0);
    expect(
      await prisma.bookCharacterRole.count({ where: { bookCharacter: { characterId } } }),
    ).toBe(0);
  });
});

describe("mutation ownership (IDOR)", () => {
  it("returns 404 for a foreign character, book, media or tag without leaking existence", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const ownerBook = await createBook(owner.accessToken);
    const created = await createNewInBook(owner.accessToken, ownerBook, { name: "Paul Atreides" });
    const characterId = created.body.id;

    const foreignGlobal = await authed(
      "patch",
      `/api/characters/${characterId}`,
      intruder.accessToken,
    ).send({ name: "Hijacked" });
    expect(foreignGlobal.status).toBe(HttpStatus.NOT_FOUND);

    const foreignBook = await authed(
      "patch",
      `/api/books/${ownerBook}/characters/${characterId}`,
      intruder.accessToken,
    ).send({ importance: "central" });
    expect(foreignBook.status).toBe(HttpStatus.NOT_FOUND);

    const foreignUnlink = await authed(
      "delete",
      `/api/books/${ownerBook}/characters/${characterId}`,
      intruder.accessToken,
    );
    expect(foreignUnlink.status).toBe(HttpStatus.NOT_FOUND);

    const foreignAvatar = await authed(
      "patch",
      `/api/characters/${characterId}`,
      owner.accessToken,
    ).send({ avatarMediaId: MISSING_ID });
    expect(foreignAvatar.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignAvatar.body.code).toBe("media_ownership_mismatch");

    const foreignPortrait = await authed(
      "patch",
      `/api/books/${ownerBook}/characters/${characterId}`,
      owner.accessToken,
    ).send({ portraitMediaId: MISSING_ID });
    expect(foreignPortrait.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignPortrait.body.code).toBe("media_ownership_mismatch");
  });
});

describe("page-level spoiler masking (character details)", () => {
  async function createGlobalWithAppearance(
    token: string,
    bookId: string,
    profile: Record<string, unknown>,
  ): Promise<string> {
    const res = await authed("post", "/api/characters", token).send({
      character: { name: "Late Arrival" },
      firstAppearance: { bookId, bookProfile: bookProfile(profile) },
    });
    expect(res.status).toBe(HttpStatus.CREATED);
    return res.body.id;
  }

  it("masks an appearance the reader has not yet reached in the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createGlobalWithAppearance(accessToken, bookId, {
      firstAppearancePage: 200,
    });

    const before = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}&contextPage=3`,
      accessToken,
    );
    expect(before.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("reveals the appearance once the reader page reaches it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createGlobalWithAppearance(accessToken, bookId, {
      firstAppearancePage: 200,
    });

    const after = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}&contextPage=250`,
      accessToken,
    );
    expect(after.status).toBe(HttpStatus.OK);
    expect(after.body.appearances).toHaveLength(1);
    expect(after.body.appearances[0].firstAppearancePage).toBe(200);
  });

  it("still shows a positionless appearance once the book is reached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createGlobalWithAppearance(accessToken, bookId, {});

    const res = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}&contextPage=3`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances).toHaveLength(1);
  });

  it("keeps book-level behavior unchanged when no reader position is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createGlobalWithAppearance(accessToken, bookId, {
      firstAppearancePage: 200,
    });

    const res = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances).toHaveLength(1);
  });
});
