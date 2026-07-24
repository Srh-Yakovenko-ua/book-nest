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
  method: "delete" | "get" | "patch" | "post" | "put",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "J. K. Rowling" }],
    ownershipStatus: "owned",
    title: "Harry Potter",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesBook(
  token: string,
  overrides: Record<string, unknown>,
): Promise<request.Response> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "J. K. Rowling" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res;
}

function createTheory(token: string, body: Record<string, unknown>): request.Test {
  return authed("post", "/api/character-theories", token).send(body);
}

describe("character theory CRUD", () => {
  it("creates a theory for a character and reads it back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Severus Snape");

    const created = await createTheory(accessToken, {
      characterId: character,
      text: "He is loyal to Dumbledore",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.id).toMatch(UUID);
    expect(created.body).toMatchObject({
      characterId: character,
      characterName: "Severus Snape",
      isResolved: false,
      isSpoiler: false,
      status: "unverified",
      text: "He is loyal to Dumbledore",
    });

    const list = await authed("get", "/api/character-theories", accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body.totalCount).toBe(1);
    expect(list.body.items[0].id).toBe(created.body.id);
  });

  it("creates a theory targeting a character, book and series at once", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesBook = await createSeriesBook(accessToken, {
      newSeries: { name: "Harry Potter" },
      partNumber: 1,
      title: "Philosopher's Stone",
    });
    const bookId = seriesBook.body.id;
    const seriesId = seriesBook.body.series.id;
    const character = await createCharacter(accessToken, "Harry");

    const created = await createTheory(accessToken, {
      bookId,
      characterId: character,
      seriesId,
      text: "A horcrux hides in book one",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({ bookId, characterId: character, seriesId });
    expect(created.body.bookTitle).toBe("Philosopher's Stone");
    expect(created.body.seriesName).toBe("Harry Potter");
  });

  it("rejects a theory with no target", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTheory(accessToken, { text: "A floating hypothesis" });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("changes the status and reports isResolved", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Snape");
    const created = await createTheory(accessToken, { characterId: character, text: "A guess" });

    const confirmed = await authed(
      "patch",
      `/api/character-theories/${created.body.id}`,
      accessToken,
    ).send({ status: "confirmed" });
    expect(confirmed.status).toBe(HttpStatus.OK);
    expect(confirmed.body).toMatchObject({ isResolved: true, status: "confirmed" });

    const disproved = await authed(
      "patch",
      `/api/character-theories/${created.body.id}`,
      accessToken,
    ).send({ status: "disproved" });
    expect(disproved.body).toMatchObject({ isResolved: true, status: "disproved" });
  });

  it("rejects an empty update body", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Snape");
    const created = await createTheory(accessToken, { characterId: character, text: "A guess" });

    const empty = await authed(
      "patch",
      `/api/character-theories/${created.body.id}`,
      accessToken,
    ).send({});
    expect(empty.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("deletes a theory", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Snape");
    const created = await createTheory(accessToken, { characterId: character, text: "A guess" });

    const removed = await authed(
      "delete",
      `/api/character-theories/${created.body.id}`,
      accessToken,
    );
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const list = await authed("get", "/api/character-theories", accessToken);
    expect(list.body.totalCount).toBe(0);
  });

  it("filters by character, book, series and status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterA = await createCharacter(accessToken, "Alpha");
    const characterB = await createCharacter(accessToken, "Beta");

    const theoryA = await createTheory(accessToken, {
      characterId: characterA,
      status: "confirmed",
      text: "Alpha theory",
    });
    await createTheory(accessToken, { bookId, characterId: characterB, text: "Beta theory" });

    const byCharacter = await authed(
      "get",
      `/api/character-theories?characterId=${characterA}`,
      accessToken,
    );
    expect(byCharacter.body.totalCount).toBe(1);
    expect(byCharacter.body.items[0].id).toBe(theoryA.body.id);

    const byBook = await authed("get", `/api/character-theories?bookId=${bookId}`, accessToken);
    expect(byBook.body.totalCount).toBe(1);
    expect(byBook.body.items[0].characterId).toBe(characterB);

    const byStatus = await authed("get", "/api/character-theories?status=confirmed", accessToken);
    expect(byStatus.body.totalCount).toBe(1);
    expect(byStatus.body.items[0].id).toBe(theoryA.body.id);
  });
});

describe("character theory ownership (IDOR)", () => {
  it("returns 404 for foreign or missing targets and theories", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const ownerCharacter = await createCharacter(owner.accessToken, "Owned");
    const ownerTheory = await createTheory(owner.accessToken, {
      characterId: ownerCharacter,
      text: "A guess",
    });

    const missingCharacter = await createTheory(owner.accessToken, {
      characterId: MISSING_ID,
      text: "x",
    });
    expect(missingCharacter.status).toBe(HttpStatus.NOT_FOUND);
    expect(missingCharacter.body.code).toBe("character_theory_character_not_found");

    const missingBook = await createTheory(owner.accessToken, { bookId: MISSING_ID, text: "x" });
    expect(missingBook.status).toBe(HttpStatus.NOT_FOUND);
    expect(missingBook.body.code).toBe("character_theory_book_not_found");

    const missingSeries = await createTheory(owner.accessToken, {
      seriesId: MISSING_ID,
      text: "x",
    });
    expect(missingSeries.status).toBe(HttpStatus.NOT_FOUND);
    expect(missingSeries.body.code).toBe("character_theory_series_not_found");

    const foreignPatch = await authed(
      "patch",
      `/api/character-theories/${ownerTheory.body.id}`,
      intruder.accessToken,
    ).send({ status: "confirmed" });
    expect(foreignPatch.status).toBe(HttpStatus.NOT_FOUND);

    const foreignDelete = await authed(
      "delete",
      `/api/character-theories/${ownerTheory.body.id}`,
      intruder.accessToken,
    );
    expect(foreignDelete.status).toBe(HttpStatus.NOT_FOUND);

    const intruderList = await authed("get", "/api/character-theories", intruder.accessToken);
    expect(intruderList.body.totalCount).toBe(0);
  });
});

describe("character theory spoiler redaction", () => {
  it("hides a spoiler theory in a reading context but shows it in the full owner view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const character = await createCharacter(accessToken, "Snape");
    await createTheory(accessToken, {
      bookId,
      characterId: character,
      isSpoiler: true,
      text: "He kills Dumbledore",
    });

    const safe = await authed(
      "get",
      `/api/character-theories?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.status).toBe(HttpStatus.OK);
    expect(safe.body.totalCount).toBe(0);
    expect(JSON.stringify(safe.body)).not.toContain("kills Dumbledore");

    const full = await authed("get", "/api/character-theories", accessToken);
    expect(full.body.totalCount).toBe(1);
    expect(full.body.items[0].text).toBe("He kills Dumbledore");
  });

  it("hides a confirmed theory on a future book in an earlier reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await createSeriesBook(accessToken, {
      newSeries: { name: "Harry Potter" },
      partNumber: 1,
      title: "Philosopher's Stone",
    });
    const seriesId = firstBook.body.series.id;
    const firstBookId = firstBook.body.id;

    const secondBook = await createSeriesBook(accessToken, {
      partNumber: 2,
      seriesId,
      title: "Chamber of Secrets",
    });
    const secondBookId = secondBook.body.id;
    const character = await createCharacter(accessToken, "Tom Riddle");

    await createTheory(accessToken, {
      bookId: secondBookId,
      characterId: character,
      status: "confirmed",
      text: "Riddle is Voldemort",
    });

    const safe = await authed(
      "get",
      `/api/character-theories?contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(safe.body.totalCount).toBe(0);
    expect(JSON.stringify(safe.body)).not.toContain("Voldemort");

    const reached = await authed(
      "get",
      `/api/character-theories?contextBookId=${secondBookId}`,
      accessToken,
    );
    expect(reached.body.totalCount).toBe(1);
    expect(reached.body.items[0].text).toBe("Riddle is Voldemort");

    const full = await authed("get", "/api/character-theories", accessToken);
    expect(full.body.totalCount).toBe(1);
  });

  it("keeps a non-spoiler character-only theory visible in any reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const character = await createCharacter(accessToken, "Snape");
    await createTheory(accessToken, {
      characterId: character,
      text: "He is complicated",
    });

    const safe = await authed(
      "get",
      `/api/character-theories?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.body.totalCount).toBe(1);
    expect(safe.body.items[0].text).toBe("He is complicated");
  });
});

describe("character theory soft-deleted target", () => {
  it("keeps the theory but hides the trashed character name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const character = await createCharacter(accessToken, "The Traitor");
    const created = await createTheory(accessToken, {
      bookId,
      characterId: character,
      text: "A guess about a book target",
    });

    const deleted = await authed(
      "delete",
      `/api/characters/${character}?confirm=true`,
      accessToken,
    );
    expect(deleted.status).toBe(HttpStatus.OK);

    const list = await authed("get", "/api/character-theories", accessToken);
    expect(list.body.totalCount).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      bookId,
      characterId: character,
      characterName: null,
      id: created.body.id,
    });
    expect(JSON.stringify(list.body)).not.toContain("The Traitor");
  });
});

describe("character theories — whole-profile hidden characters", () => {
  it("excludes a theory whose character is profile-hidden, then reveals it on un-hide", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "The Secret Heir");
    const created = await createTheory(accessToken, {
      characterId: character,
      text: "SECRET-TWIST reveals the true bloodline",
    });
    expect(created.status).toBe(HttpStatus.CREATED);

    const before = await authed("get", "/api/character-theories", accessToken);
    expect(before.body.totalCount).toBe(1);

    const hide = await authed("patch", `/api/characters/${character}`, accessToken).send({
      hideProfileAsSpoiler: true,
    });
    expect(hide.status).toBe(HttpStatus.OK);

    const hidden = await authed("get", "/api/character-theories", accessToken);
    expect(hidden.body.totalCount).toBe(0);
    expect(hidden.body.items).toEqual([]);
    expect(JSON.stringify(hidden.body)).not.toContain("SECRET-TWIST");
    expect(JSON.stringify(hidden.body)).not.toContain("The Secret Heir");

    const unhide = await authed("patch", `/api/characters/${character}`, accessToken).send({
      hideProfileAsSpoiler: false,
    });
    expect(unhide.status).toBe(HttpStatus.OK);

    const revealed = await authed("get", "/api/character-theories", accessToken);
    expect(revealed.body.totalCount).toBe(1);
    expect(revealed.body.items[0].id).toBe(created.body.id);
  });
});
