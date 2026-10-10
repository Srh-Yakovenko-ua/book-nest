import type { INestApplication } from "@nestjs/common";

import { SPECIES_ERROR_CODES } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { findSystemSpeciesId, seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const MISSING_SPECIES_ID = "99999999-9999-4999-8999-999999999999";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
  app = context.app;
});

beforeEach(async () => {
  context.reset();
  await seedSystemSpeciesCatalog(app);
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

async function createBook(token: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "J. R. R. Tolkien" }],
    ownershipStatus: "owned",
    title: "The Hobbit",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createGlobal(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook({
  bookId,
  bookProfile = {},
  character,
  token,
}: {
  bookId: string;
  bookProfile?: Record<string, unknown>;
  character: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting", ...bookProfile },
    character,
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createOwnSpecies(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/species", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function listedNames(token: string, query: string): Promise<string[]> {
  const res = await authed("get", `/api/characters?${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.items.map((item: { name: string }) => item.name).sort();
}

describe("character species write path", () => {
  it("stores a system species, swaps in an own one and clears it with null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const sylvanId = await createOwnSpecies(accessToken, "Sylvan");
    const characterId = await createGlobal(accessToken, { name: "Legolas", speciesId: elfId });

    const created = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(created.body.species).toEqual({
      id: elfId,
      key: "elf",
      labels: { en: "Elf", uk: "Ельф" },
    });

    const swapped = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      speciesId: sylvanId,
    });
    expect(swapped.status).toBe(HttpStatus.OK);
    expect(swapped.body.species).toEqual({
      id: sylvanId,
      key: null,
      labels: { en: "Sylvan", uk: "Sylvan" },
    });

    const cleared = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      speciesId: null,
    });
    expect(cleared.status).toBe(HttpStatus.OK);
    expect(cleared.body.species).toBeNull();
  });

  it("answers species_not_found identically for a missing id and another user's species", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const foreignId = await createOwnSpecies(stranger.accessToken, "Hidden kind");
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createGlobal(accessToken, { name: "Bilbo" });

    for (const speciesId of [MISSING_SPECIES_ID, foreignId]) {
      const onCreate = await authed("post", "/api/characters", accessToken).send({
        character: { name: "Probe", speciesId },
      });
      const onUpdate = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
        speciesId,
      });
      const onBookCreate = await authed(
        "post",
        `/api/books/${bookId}/characters`,
        accessToken,
      ).send({
        bookProfile: { speciesOverrideId: speciesId },
        character: { name: "Probe" },
        mode: "new",
      });
      for (const res of [onCreate, onUpdate, onBookCreate]) {
        expect(res.status).toBe(HttpStatus.NOT_FOUND);
        expect(res.body.code).toBe(SPECIES_ERROR_CODES.notFound);
      }
    }
  });

  it("updates and clears a per-book override against a visible species only", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const foreignId = await createOwnSpecies(stranger.accessToken, "Hidden kind");
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook({
      bookId,
      character: { name: "Gollum" },
      token: accessToken,
    });
    const hobbitId = await findSystemSpeciesId({ app, key: "hobbit" });
    const path = `/api/books/${bookId}/characters/${characterId}`;

    const foreign = await authed("patch", path, accessToken).send({ speciesOverrideId: foreignId });
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreign.body.code).toBe(SPECIES_ERROR_CODES.notFound);

    const set = await authed("patch", path, accessToken).send({ speciesOverrideId: hobbitId });
    expect(set.status).toBe(HttpStatus.OK);
    expect(set.body.appearances[0].speciesOverride).toMatchObject({ id: hobbitId, key: "hobbit" });

    const cleared = await authed("patch", path, accessToken).send({ speciesOverrideId: null });
    expect(cleared.status).toBe(HttpStatus.OK);
    expect(cleared.body.appearances[0].speciesOverride).toBeNull();
  });
});

describe("character species spoiler masking", () => {
  it("hides both the label and the id of a spoiler override until it is revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const wizardId = await findSystemSpeciesId({ app, key: "wizard" });
    const characterId = await createInBook({
      bookId,
      bookProfile: { speciesOverrideId: wizardId, speciesOverrideIsSpoiler: true },
      character: { name: "Gandalf" },
      token: accessToken,
    });
    const contextualPath = `/api/characters/${characterId}?contextBookId=${bookId}`;

    const masked = await authed("get", contextualPath, accessToken);
    expect(masked.status).toBe(HttpStatus.OK);
    expect(masked.body.appearances[0].speciesOverride).toBeNull();
    expect(masked.body.appearances[0].speciesOverrideIsSpoiler).toBe(true);
    expect(masked.body.appearances[0].hiddenFields).toContain("speciesOverride");
    expect(JSON.stringify(masked.body)).not.toContain(wizardId);

    const revealed = await authed(
      "get",
      `${contextualPath}&revealFieldIds=speciesOverride`,
      accessToken,
    );
    expect(revealed.status).toBe(HttpStatus.OK);
    expect(revealed.body.appearances[0].speciesOverride).toMatchObject({ id: wizardId });
    expect(revealed.body.appearances[0].hiddenFields).not.toContain("speciesOverride");
  });
});

describe("character list species filter", () => {
  it("filters by a system or an own species id and matches nothing for a foreign one", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const foreignId = await createOwnSpecies(stranger.accessToken, "Hidden kind");
    await createGlobal(stranger.accessToken, { name: "Stranger", speciesId: foreignId });
    const { accessToken } = await context.registerVerifyAndLogin();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const dwarfId = await findSystemSpeciesId({ app, key: "dwarf" });
    const sylvanId = await createOwnSpecies(accessToken, "Sylvan");
    await createGlobal(accessToken, { name: "Legolas", speciesId: elfId });
    await createGlobal(accessToken, { name: "Gimli", speciesId: dwarfId });
    await createGlobal(accessToken, { name: "Thranduil", speciesId: sylvanId });
    await createGlobal(accessToken, { name: "Bilbo" });

    expect(await listedNames(accessToken, `speciesId=${elfId}`)).toEqual(["Legolas"]);
    expect(await listedNames(accessToken, `speciesId=${sylvanId}`)).toEqual(["Thranduil"]);
    expect(await listedNames(accessToken, `speciesId=${elfId}&speciesId=${dwarfId}`)).toEqual([
      "Gimli",
      "Legolas",
    ]);
    expect(await listedNames(accessToken, `speciesId=${foreignId}`)).toEqual([]);
  });
});
