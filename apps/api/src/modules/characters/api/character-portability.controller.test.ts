import type { BundleAppearance, BundleFact, CharacterBundle, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CharacterBundleSchema } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { findSystemSpeciesId, seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";
import { CharacterPortabilityRepository } from "../infrastructure/character-portability.repository.js";

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

const ZERO_SKIPPED = {
  aliasesMissingBook: 0,
  appearancesMissingBook: 0,
  bookStatesMissingBook: 0,
  factsMissingBook: 0,
  membershipsMissingBook: 0,
  relationshipsInvalid: 0,
  tagsMissing: 0,
  theoriesWithoutTarget: 0,
  unlinkedMedia: 0,
  unlinkedSeries: 0,
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(CHARACTER_PURGE_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  vi.restoreAllMocks();
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

async function buildGraph(token: string): Promise<void> {
  const book1 = await createBook(token, "Dune");
  const book2 = await createBook(token, "Dune Messiah");
  const survivor = await createCharacter(token, {
    aliases: [{ name: "Muad'Dib", type: "nickname" }],
    name: "Paul",
  });
  const chani = await createCharacter(token, { name: "Chani" });

  await linkToBook(token, book1, survivor, {
    importance: "central",
    roles: [{ roleType: "protagonist" }],
  });
  await linkToBook(token, book2, survivor, { importance: "major" });

  const tagRes = await authed("post", "/api/tags", token).send({ name: "Hero" });
  expect(tagRes.status).toBe(HttpStatus.CREATED);
  await authed("patch", `/api/books/${book1}/characters/${survivor}`, token)
    .send({ tagIds: [tagRes.body.id] })
    .expect(HttpStatus.OK);

  await authed("post", "/api/character-groups", token)
    .send({
      members: [{ characterId: survivor }, { characterId: chani }],
      name: "House Atreides",
      type: "house",
    })
    .expect(HttpStatus.CREATED);

  await authed("post", "/api/character-relationships", token)
    .send({
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: survivor,
      targetCharacterId: chani,
      type: "friend_of",
    })
    .expect(HttpStatus.CREATED);

  await authed("post", "/api/character-theories", token)
    .send({ characterId: survivor, text: "Paul becomes the Kwisatz Haderach" })
    .expect(HttpStatus.CREATED);
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

async function createCharacter(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createForm(
  token: string,
  characterId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await authed("post", `/api/characters/${characterId}/forms`, token).send(body);
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function exportBundle(token: string): Promise<Record<string, unknown>> {
  const res = await authed("get", "/api/characters/export", token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

async function insertMedia(userId: string): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 100,
      kind: "avatar",
      sizeBytes: 1234,
      storageKey: `media/avatar/${randomUUID()}/image.webp`,
      userId,
      width: 100,
    },
  });
  return asset.id;
}

async function linkToBook(
  token: string,
  bookId: string,
  characterId: string,
  bookProfile: Record<string, unknown>,
): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting", ...bookProfile },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

const EXPECTED_FULL_CREATED = {
  aliases: 1,
  appearances: 2,
  bookStates: 0,
  characters: 2,
  facts: 0,
  forms: 0,
  groups: 1,
  memberships: 2,
  relationships: 1,
  roles: 1,
  tags: 1,
  theories: 1,
};

describe("GET /api/characters/export", () => {
  it("exports the caller's full character graph and stays owner-scoped", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);

    const bundle = await exportBundle(accessToken);
    expect(bundle.formatVersion).toBe(2);
    expect(typeof bundle.exportedAt).toBe("string");
    expect(Array.isArray(bundle.characters)).toBe(true);
    expect((bundle.characters as unknown[]).length).toBe(2);
    expect((bundle.groups as unknown[]).length).toBe(1);
    expect((bundle.relationships as unknown[]).length).toBe(1);
    expect((bundle.theories as unknown[]).length).toBe(1);

    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });
    const empty = await exportBundle(stranger.accessToken);
    expect(empty.characters).toEqual([]);
    expect(empty.groups).toEqual([]);
    expect(empty.relationships).toEqual([]);
    expect(empty.theories).toEqual([]);
  });
});

describe("POST /api/characters/import", () => {
  it("round-trips the caller's own bundle with fresh ids and full re-linking", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.formatVersion).toBe(2);
    expect(res.body.created).toEqual(EXPECTED_FULL_CREATED);
    expect(res.body.skipped).toEqual(ZERO_SKIPPED);

    expect(await prisma.character.count({ where: { userId } })).toBe(4);
    expect(await prisma.characterRelationship.count({ where: { userId } })).toBe(2);
    expect(await prisma.characterGroup.count({ where: { userId } })).toBe(2);
    expect(await prisma.characterTheory.count({ where: { userId } })).toBe(2);
    expect(await prisma.bookCharacter.count({ where: { character: { userId } } })).toBe(4);
  });

  it("stamps ownership on the importer and skips library refs it does not own", async () => {
    const owner = await context.registerVerifyAndLogin();
    await buildGraph(owner.accessToken);
    const bundle = await exportBundle(owner.accessToken);

    const importer = await context.registerVerifyAndLogin({ email: "importer@example.com" });
    const res = await authed("post", "/api/characters/import", importer.accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.OK);

    expect(res.body.created).toEqual({
      aliases: 1,
      appearances: 0,
      bookStates: 0,
      characters: 2,
      facts: 0,
      forms: 0,
      groups: 1,
      memberships: 2,
      relationships: 1,
      roles: 0,
      tags: 0,
      theories: 1,
    });
    expect(res.body.skipped.appearancesMissingBook).toBe(2);
    expect(res.body.skipped.tagsMissing).toBe(1);

    const importerCharacters = await prisma.character.findMany({
      select: { userId: true },
      where: { userId: importer.userId },
    });
    expect(importerCharacters.length).toBe(2);
    expect(importerCharacters.every((row) => row.userId === importer.userId)).toBe(true);
    expect(await prisma.character.count({ where: { userId: owner.userId } })).toBe(2);
    expect(await prisma.characterRelationship.count({ where: { userId: importer.userId } })).toBe(
      1,
    );
    expect(
      await prisma.bookCharacter.count({ where: { character: { userId: importer.userId } } }),
    ).toBe(0);
  });

  it("rejects an over-limit bundle with 422", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);
    const characters = bundle.characters as { aliases: unknown[] }[];
    const firstCharacter = characters[0];
    if (firstCharacter !== undefined) {
      firstCharacter.aliases = Array.from({ length: 31 }, (_unused, index) => ({
        bookId: null,
        isSpoiler: false,
        name: `Alias ${index}`,
        position: index,
        type: "nickname",
      }));
    }

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_too_large");
  });

  it("rejects a malformed bundle with 422", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/characters/import", accessToken).send({
      characters: "not-an-array",
      exportedAt: "2026-01-01T00:00:00.000Z",
      formatVersion: 1,
      groups: [],
      relationships: [],
      theories: [],
    });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_invalid");
  });

  it("rolls the whole import back when insertion fails midway", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);

    const repository = app.get(CharacterPortabilityRepository);
    const realInsert = CharacterPortabilityRepository.prototype.insertGraph;
    vi.spyOn(repository, "insertGraph").mockImplementation(async (plan, client) => {
      await realInsert.call(repository, plan, client);
      throw new Error("boom");
    });

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(await prisma.character.count({ where: { userId } })).toBe(2);
  });
});

describe("character portability — forms", () => {
  it("round-trips forms with fresh ids, preserving spoilers and nulling unowned portraits", async () => {
    const owner = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(owner.accessToken, { name: "Shapeshifter" });
    const ownerPortrait = await insertMedia(owner.userId);
    await createForm(owner.accessToken, characterId, {
      formType: "true_form",
      isSpoiler: true,
      name: "True Form",
    });
    await createForm(owner.accessToken, characterId, {
      formType: "disguise",
      name: "Disguise",
      portraitMediaId: ownerPortrait,
    });

    const bundle = await exportBundle(owner.accessToken);
    const exportedForms = (bundle.characters as { forms: unknown[] }[])[0]?.forms;
    expect(exportedForms).toHaveLength(2);

    const importer = await context.registerVerifyAndLogin({ email: "importer@example.com" });
    const imported = await authed("post", "/api/characters/import", importer.accessToken).send(
      bundle,
    );
    expect(imported.status).toBe(HttpStatus.OK);
    expect(imported.body.created.forms).toBe(2);
    expect(imported.body.skipped.unlinkedMedia).toBe(1);

    const importedForms = await prisma.characterForm.findMany({
      orderBy: { position: "asc" },
      where: { character: { userId: importer.userId } },
    });
    expect(importedForms).toHaveLength(2);
    expect(importedForms.every((form) => form.id !== undefined)).toBe(true);
    const trueForm = importedForms.find((form) => form.normalizedName === "true form");
    expect(trueForm?.isSpoiler).toBe(true);
    expect(importedForms.every((form) => form.portraitMediaId === null)).toBe(true);

    expect(
      await prisma.characterForm.count({ where: { character: { userId: owner.userId } } }),
    ).toBe(2);
  });
});

describe("character portability — retired hiding flags", () => {
  it("imports a bundle that still carries both retired hiding flags and shows its character everywhere", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Children of Dune");
    const characterId = await createCharacter(accessToken, { name: "The Preacher" });
    await linkToBook(accessToken, bookId, characterId, { firstAppearancePage: 410 });
    const exported = CharacterBundleSchema.parse(await exportBundle(accessToken));
    const legacyBundle = {
      ...exported,
      characters: exported.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map(({ facts: _facts, ...appearance }) => ({
          ...appearance,
          hidePresenceAsSpoiler: true,
        })),
        hideProfileAsSpoiler: true,
        name: "Legacy Preacher",
      })),
      formatVersion: 1,
    };

    const res = await authed("post", "/api/characters/import", accessToken).send(legacyBundle);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.formatVersion).toBe(1);
    expect(res.body.created.facts).toBe(0);

    const listed = await authed("get", "/api/characters?q=Legacy", accessToken);
    expect(listed.status).toBe(HttpStatus.OK);
    expect(listed.body.items.map((item: { name: string }) => item.name)).toEqual([
      "Legacy Preacher",
    ]);
    const importedId: string = listed.body.items[0].id;

    const roster = await authed("get", `/api/books/${bookId}/characters?sort=name`, accessToken);
    expect(roster.body.items.map((item: { name: string }) => item.name)).toEqual([
      "Legacy Preacher",
      "The Preacher",
    ]);

    const details = await authed(
      "get",
      `/api/characters/${importedId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(details.status).toBe(HttpStatus.OK);
    expect(details.body.name).toBe("Legacy Preacher");
  });
});

describe("character portability — species", () => {
  async function createOwnSpecies(token: string, name: string): Promise<string> {
    const res = await authed("post", "/api/species", token).send({ name });
    expect(res.status).toBe(HttpStatus.CREATED);
    return res.body.id;
  }

  async function exportSpeciesBundle(token: string): Promise<CharacterBundle> {
    return CharacterBundleSchema.parse(await exportBundle(token));
  }

  async function importBundle(token: string, bundle: CharacterBundle): Promise<void> {
    const res = await authed("post", "/api/characters/import", token).send(bundle);
    expect(res.status).toBe(HttpStatus.OK);
  }

  async function seedElfWithSylvanOverride(token: string): Promise<{
    bookId: string;
    characterId: string;
    elfId: string;
    sylvanId: string;
  }> {
    await seedSystemSpeciesCatalog(app);
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const sylvanId = await createOwnSpecies(token, "Sylvan");
    const bookId = await createBook(token, "The Hobbit");
    const characterId = await createCharacter(token, { name: "Legolas", speciesId: elfId });
    await linkToBook(token, bookId, characterId, {
      speciesOverrideId: sylvanId,
      speciesOverrideIsSpoiler: true,
    });
    return { bookId, characterId, elfId, sylvanId };
  }

  it("exports a system species as key plus name and an own species as name only, never an id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { elfId, sylvanId } = await seedElfWithSylvanOverride(accessToken);

    const bundle = await exportSpeciesBundle(accessToken);

    expect(bundle.characters[0]).toMatchObject({ species: "Elf", speciesKey: "elf" });
    expect(bundle.characters[0]?.appearances[0]).toMatchObject({
      speciesOverride: "Sylvan",
      speciesOverrideIsSpoiler: true,
      speciesOverrideKey: null,
    });
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(elfId);
    expect(serialized).not.toContain(sylvanId);
  });

  it("maps a known key to the system species and an exact visible name to the existing species", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { characterId, elfId, sylvanId } = await seedElfWithSylvanOverride(accessToken);

    await importBundle(accessToken, await exportSpeciesBundle(accessToken));

    const imported = await prisma.character.findFirstOrThrow({
      include: { bookAppearances: true },
      where: { id: { not: characterId }, userId },
    });
    expect(imported.speciesId).toBe(elfId);
    expect(imported.bookAppearances[0]).toMatchObject({
      speciesOverrideId: sylvanId,
      speciesOverrideIsSpoiler: true,
    });
    expect(await prisma.species.count({ where: { userId } })).toBe(1);
  });

  it("falls back to the text for an unknown key or a keyless bundle and creates an own species only for unknown text", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { characterId, elfId } = await seedElfWithSylvanOverride(accessToken);
    const exported = await exportSpeciesBundle(accessToken);
    const bundle: CharacterBundle = {
      ...exported,
      characters: exported.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map((appearance) => ({
          ...appearance,
          speciesOverride: "Mirkwood kin",
          speciesOverrideKey: "no-such-species",
        })),
        species: "ELF",
        speciesKey: undefined,
      })),
    };

    await importBundle(accessToken, bundle);

    const imported = await prisma.character.findFirstOrThrow({
      include: { bookAppearances: { include: { speciesOverride: true } } },
      where: { id: { not: characterId }, userId },
    });
    expect(imported.speciesId).toBe(elfId);
    expect(imported.bookAppearances[0]?.speciesOverride).toMatchObject({
      key: null,
      name: "Mirkwood kin",
      userId,
    });
    expect(imported.bookAppearances[0]?.speciesOverrideIsSpoiler).toBe(true);
    expect(await prisma.species.count({ where: { userId } })).toBe(2);
  });

  it("round-trips a backfilled species name the create form refuses, so the character keeps its species", async () => {
    const legacyName = "<b>Dark</b> elf";
    const exporter = await context.registerVerifyAndLogin();
    const importer = await context.registerVerifyAndLogin();
    const backfilled = await prisma.species.create({
      data: { name: legacyName, normalizedName: "<b>dark</b> elf", userId: exporter.userId },
    });
    await createCharacter(exporter.accessToken, { name: "Drizzt", speciesId: backfilled.id });
    const refused = await authed("post", "/api/species", importer.accessToken).send({
      name: legacyName,
    });
    expect(refused.status).toBe(HttpStatus.BAD_REQUEST);

    const exported = await exportSpeciesBundle(exporter.accessToken);
    expect(exported.characters[0]).toMatchObject({ species: legacyName, speciesKey: null });
    await importBundle(importer.accessToken, exported);

    const imported = await prisma.character.findFirstOrThrow({
      include: { species: true },
      where: { userId: importer.userId },
    });
    expect(imported.species).toMatchObject({
      key: null,
      name: legacyName,
      normalizedName: "<b>dark</b> elf",
      userId: importer.userId,
    });
  });

  it("never creates a species for blank text", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { characterId } = await seedElfWithSylvanOverride(accessToken);
    const exported = await exportSpeciesBundle(accessToken);
    const bundle: CharacterBundle = {
      ...exported,
      characters: exported.characters.map((character) => ({
        ...character,
        appearances: [],
        species: "",
        speciesKey: null,
      })),
    };

    await importBundle(accessToken, bundle);

    const imported = await prisma.character.findFirstOrThrow({
      where: { id: { not: characterId }, userId },
    });
    expect(imported.speciesId).toBeNull();
    expect(await prisma.species.count({ where: { userId } })).toBe(1);
  });
});

describe("character portability — unreliable narrator", () => {
  function toLegacyUnreliableAppearance({
    facts: _facts,
    isUnreliableNarrator: _isUnreliableNarrator,
    isUnreliableNarratorSpoiler: _isUnreliableNarratorSpoiler,
    ...appearance
  }: BundleAppearance): Record<string, unknown> {
    return { ...appearance, narratorType: "unreliable" };
  }

  it("imports a legacy unreliable narrator type as the unreliable flag with no narrator type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Gone Girl");
    const characterId = await createCharacter(accessToken, { name: "Amy Dunne" });
    await linkToBook(accessToken, bookId, characterId, { isPovCharacter: true });
    const exported = CharacterBundleSchema.parse(await exportBundle(accessToken));
    const legacyBundle = {
      ...exported,
      characters: exported.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map(toLegacyUnreliableAppearance),
        name: "Legacy Amy",
      })),
      formatVersion: 1,
    };

    const res = await authed("post", "/api/characters/import", accessToken).send(legacyBundle);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.formatVersion).toBe(1);
    expect(res.body.created.facts).toBe(0);

    const reexported = CharacterBundleSchema.parse(await exportBundle(accessToken));
    const legacyCharacter = reexported.characters.find(
      (character) => character.name === "Legacy Amy",
    );
    expect(legacyCharacter?.appearances).toEqual([
      expect.objectContaining({
        isPovCharacter: true,
        isUnreliableNarrator: true,
        isUnreliableNarratorSpoiler: false,
        narratorType: null,
      }),
    ]);
  });
});

const SPEC_TRANSPORT = {
  globalJsonLimitBytes: 1024 * 1024,
  importMaxBytes: 8 * 1024 * 1024,
  importMaxJsonObjectMembers: 64,
  importMaxJsonValues: 524_288,
} as const;

const FACT_IDS = {
  newest: "00000000-0000-4000-8000-000000000001",
  oldest: "ff000000-0000-4000-8000-000000000000",
  tieHigh: "f0000000-0000-4000-8000-000000000000",
  tieLow: "10000000-0000-4000-8000-000000000000",
} as const;

const LEGACY_APPEARANCE_DESCRIPTION =
  'Перший рядок\n\n**Другий** рядок — <i>з тегами</i> & "лапками"';

const LONG_FACT_TEXT = "Пустеля пам’ятає кожен крок Муад’Діба, і спайс тече крізь його сни. "
  .repeat(80)
  .slice(0, 4500)
  .trim();

type AppearanceIds = { bookId: string; characterId: string };

type FactFields = {
  chapter: Nullable<string>;
  createdAt: Date;
  page: Nullable<number>;
  text: string;
  title: string;
  updatedAt: Date;
};

type GraphCounts = { appearances: number; characters: number; facts: number };

async function createFact(
  token: string,
  { bookId, characterId }: AppearanceIds,
  fact: Record<string, unknown>,
): Promise<string> {
  const res = await authed(
    "post",
    `/api/books/${bookId}/characters/${characterId}/facts`,
    token,
  ).send(fact);
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function emptyObjectsArrayBody(objectCount: number): string {
  return `[${"{},".repeat(objectCount - 1)}{}]`;
}

async function exportParsedBundle(token: string): Promise<CharacterBundle> {
  return CharacterBundleSchema.parse(await exportBundle(token));
}

function factFields({ chapter, createdAt, page, text, title, updatedAt }: FactFields): FactFields {
  return { chapter, createdAt, page, text, title, updatedAt };
}

async function findAppearanceId({ bookId, characterId }: AppearanceIds): Promise<string> {
  const appearance = await prisma.bookCharacter.findFirstOrThrow({
    select: { id: true },
    where: { bookId, characterId },
  });
  return appearance.id;
}

async function graphCounts(userId: string): Promise<GraphCounts> {
  const [appearances, characters, facts] = await Promise.all([
    prisma.bookCharacter.count({ where: { character: { userId } } }),
    prisma.character.count({ where: { userId } }),
    prisma.characterFact.count({ where: { bookCharacter: { character: { userId } } } }),
  ]);
  return { appearances, characters, facts };
}

function longFact(index: number): BundleFact {
  return {
    chapter: `Розділ ${index + 1}`,
    createdAt: "2025-05-05T05:05:05.000Z",
    page: index + 1,
    text: LONG_FACT_TEXT,
    title: `Спостереження ${index + 1}`,
    updatedAt: "2025-05-05T05:05:05.000Z",
  };
}

function paddedJsonBody(totalBytes: number): string {
  const prefix = '{"formatVersion":2,"padding":"';
  const suffix = '"}';
  return `${prefix}${"a".repeat(totalBytes - prefix.length - suffix.length)}${suffix}`;
}

function postJson(path: string, body: string, token?: string): request.Test {
  const req = request(app.getHttpServer()).post(path).set("Content-Type", "application/json");
  return token === undefined
    ? req.send(body)
    : req.set("Authorization", `Bearer ${token}`).send(body);
}

async function seedAppearance(token: string): Promise<AppearanceIds> {
  const bookId = await createBook(token, "Dune");
  const characterId = await createCharacter(token, { name: "Paul" });
  await linkToBook(token, bookId, characterId, {});
  return { bookId, characterId };
}

async function seedAppearanceWithFacts(token: string, factCount: number): Promise<void> {
  const bookCharacterId = await findAppearanceId(await seedAppearance(token));
  await prisma.characterFact.createMany({
    data: Array.from({ length: factCount }, (_unused, index) => ({
      bookCharacterId,
      text: `Detail ${index}`,
      title: `Fact ${index}`,
    })),
  });
}

function withFactInsert(
  client: Prisma.TransactionClient,
  createMany: () => Promise<never>,
): Prisma.TransactionClient {
  return new Proxy(client, {
    get: (target, property) =>
      property === "characterFact" ? { createMany } : Reflect.get(target, property),
  });
}

function withFirstCharacterAppearances(
  bundle: CharacterBundle,
  mapAppearances: (appearances: BundleAppearance[]) => BundleAppearance[],
): CharacterBundle {
  return {
    ...bundle,
    characters: bundle.characters.map((character, index) =>
      index === 0
        ? { ...character, appearances: mapAppearances(character.appearances) }
        : character,
    ),
  };
}

describe("character portability — version 1 bundles", () => {
  it("imports a version 1 bundle without facts and keeps its appearance description verbatim", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const appearanceIds = await seedAppearance(accessToken);
    const exported = await exportParsedBundle(accessToken);
    const v1Bundle = {
      ...exported,
      characters: exported.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map(({ facts: _facts, ...appearance }) => ({
          ...appearance,
          description: LEGACY_APPEARANCE_DESCRIPTION,
        })),
      })),
      formatVersion: 1,
    };

    const res = await authed("post", "/api/characters/import", accessToken).send(v1Bundle);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.formatVersion).toBe(1);
    expect(res.body.created.facts).toBe(0);
    const imported = await prisma.bookCharacter.findFirstOrThrow({
      where: { character: { userId }, characterId: { not: appearanceIds.characterId } },
    });
    expect(imported.description).toBe(LEGACY_APPEARANCE_DESCRIPTION);
  });

  it.each([
    {
      label: "format version 0",
      rewrite: (bundle: CharacterBundle) => ({ ...bundle, formatVersion: 0 }),
    },
    {
      label: "format version 3",
      rewrite: (bundle: CharacterBundle) => ({ ...bundle, formatVersion: 3 }),
    },
    {
      label: "a missing format version",
      rewrite: ({ formatVersion: _formatVersion, ...bundle }: CharacterBundle) => bundle,
    },
    {
      label: "a version 1 bundle whose appearances carry facts",
      rewrite: (bundle: CharacterBundle) => ({ ...bundle, formatVersion: 1 }),
    },
    {
      label: "a version 2 fact with an extra key",
      rewrite: (bundle: CharacterBundle) =>
        withFirstCharacterAppearances(bundle, (appearances) =>
          appearances.map((appearance) => ({
            ...appearance,
            facts: appearance.facts.map((fact) => ({ ...fact, id: randomUUID() })),
          })),
        ),
    },
  ])("rejects $label as an invalid bundle with 422", async ({ rewrite }) => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const appearanceIds = await seedAppearance(accessToken);
    await createFact(accessToken, appearanceIds, { text: "Knows the desert", title: "Desert" });
    const exported = await exportParsedBundle(accessToken);

    const res = await authed("post", "/api/characters/import", accessToken).send(rewrite(exported));

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_invalid");
    expect(await graphCounts(userId)).toEqual({ appearances: 1, characters: 1, facts: 1 });
  });
});

describe("character portability — facts", () => {
  it("exports facts newest first and breaks createdAt ties by id descending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookCharacterId = await findAppearanceId(await seedAppearance(accessToken));
    const tie = new Date("2025-02-02T00:00:00.000Z");
    await prisma.characterFact.createMany({
      data: [
        { bookCharacterId, createdAt: tie, id: FACT_IDS.tieLow, text: "t", title: "Tie low id" },
        {
          bookCharacterId,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          id: FACT_IDS.oldest,
          text: "t",
          title: "Oldest",
        },
        {
          bookCharacterId,
          createdAt: new Date("2025-03-03T00:00:00.000Z"),
          id: FACT_IDS.newest,
          text: "t",
          title: "Newest",
        },
        { bookCharacterId, createdAt: tie, id: FACT_IDS.tieHigh, text: "t", title: "Tie high id" },
      ],
    });

    const bundle = await exportParsedBundle(accessToken);

    expect(bundle.characters[0]?.appearances[0]?.facts.map((fact) => fact.title)).toEqual([
      "Newest",
      "Tie high id",
      "Tie low id",
      "Oldest",
    ]);
  });

  it("recreates facts with fresh ids under the new appearance and keeps their original fields", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const appearanceIds = await seedAppearance(accessToken);
    const originalAppearanceId = await findAppearanceId(appearanceIds);
    const testFactId = await createFact(accessToken, appearanceIds, {
      chapter: "Book One",
      page: 42,
      text: "Passes the gom jabbar",
      title: "The test",
    });
    const riderFactId = await createFact(accessToken, appearanceIds, {
      text: "Rides a sandworm",
      title: "Rider",
    });
    await prisma.characterFact.update({
      data: {
        createdAt: new Date("2024-01-02T03:04:05.678Z"),
        updatedAt: new Date("2024-02-03T04:05:06.789Z"),
      },
      where: { id: testFactId },
    });
    await prisma.characterFact.update({
      data: {
        createdAt: new Date("2024-03-04T05:06:07.890Z"),
        updatedAt: new Date("2024-04-05T06:07:08.901Z"),
      },
      where: { id: riderFactId },
    });
    const originals = await prisma.characterFact.findMany({
      orderBy: { title: "asc" },
      where: { bookCharacterId: originalAppearanceId },
    });

    const res = await authed("post", "/api/characters/import", accessToken).send(
      await exportBundle(accessToken),
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.created.facts).toBe(2);
    const importedAppearance = await prisma.bookCharacter.findFirstOrThrow({
      include: { facts: { orderBy: { title: "asc" } } },
      where: {
        bookId: appearanceIds.bookId,
        character: { userId },
        characterId: { not: appearanceIds.characterId },
      },
    });
    expect(importedAppearance.id).not.toBe(originalAppearanceId);
    const importedIds = importedAppearance.facts.map((fact) => fact.id);
    expect(importedIds).toHaveLength(2);
    expect(importedIds).not.toContain(testFactId);
    expect(importedIds).not.toContain(riderFactId);
    expect(originals.map(factFields)).toEqual([
      {
        chapter: null,
        createdAt: new Date("2024-03-04T05:06:07.890Z"),
        page: null,
        text: "Rides a sandworm",
        title: "Rider",
        updatedAt: new Date("2024-04-05T06:07:08.901Z"),
      },
      {
        chapter: "Book One",
        createdAt: new Date("2024-01-02T03:04:05.678Z"),
        page: 42,
        text: "Passes the gom jabbar",
        title: "The test",
        updatedAt: new Date("2024-02-03T04:05:06.789Z"),
      },
    ]);
    expect(importedAppearance.facts.map(factFields)).toEqual(originals.map(factFields));
  });

  it("counts the facts of an appearance whose book is missing as skipped and writes none of them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const kept = await seedAppearance(accessToken);
    const lost = {
      bookId: await createBook(accessToken, "Dune Messiah"),
      characterId: kept.characterId,
    };
    await linkToBook(accessToken, lost.bookId, lost.characterId, {});
    await createFact(accessToken, kept, { text: "Stays", title: "Kept fact" });
    await createFact(accessToken, lost, { text: "Gone", title: "Lost one" });
    await createFact(accessToken, lost, { text: "Gone", title: "Lost two" });
    const unownedBookId = randomUUID();
    const bundle = withFirstCharacterAppearances(
      await exportParsedBundle(accessToken),
      (appearances) =>
        appearances.map((appearance) =>
          appearance.bookId === lost.bookId ? { ...appearance, bookId: unownedBookId } : appearance,
        ),
    );

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.skipped).toMatchObject({ appearancesMissingBook: 1, factsMissingBook: 2 });
    expect(res.body.created.facts).toBe(1);
    expect(
      await prisma.characterFact.count({ where: { title: { in: ["Lost one", "Lost two"] } } }),
    ).toBe(2);
    expect(await prisma.characterFact.count()).toBe(4);
    expect(await graphCounts(userId)).toEqual({ appearances: 3, characters: 2, facts: 4 });
  });

  it("moves the facts of a duplicate appearance of the same book onto the kept appearance", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const appearanceIds = await seedAppearance(accessToken);
    await createFact(accessToken, appearanceIds, { text: "a", title: "First" });
    await createFact(accessToken, appearanceIds, { text: "b", title: "Second" });
    const bundle = withFirstCharacterAppearances(
      await exportParsedBundle(accessToken),
      (appearances) => [
        ...appearances,
        ...appearances.map((appearance) => ({
          ...appearance,
          facts: [
            {
              chapter: null,
              createdAt: "2025-07-07T07:07:07.000Z",
              page: null,
              text: "Same book again",
              title: "From duplicate",
              updatedAt: "2025-07-07T07:07:07.000Z",
            },
          ],
        })),
      ],
    );

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.created).toMatchObject({ appearances: 1, facts: 3 });
    expect(res.body.skipped.factsMissingBook).toBe(0);
    const imported = await prisma.bookCharacter.findMany({
      include: { facts: { orderBy: { title: "asc" } } },
      where: { character: { userId }, characterId: { not: appearanceIds.characterId } },
    });
    expect(imported.map((appearance) => appearance.facts.map((fact) => fact.title))).toEqual([
      ["First", "From duplicate", "Second"],
    ]);
  });

  it("writes nothing when the fact insert fails inside the import transaction", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createFact(accessToken, await seedAppearance(accessToken), {
      text: "Kept",
      title: "Original",
    });
    const bundle = await exportBundle(accessToken);
    const before = await graphCounts(userId);
    const failingFactInsert = vi.fn((): Promise<never> =>
      Promise.reject(new Error("fact insert failed")),
    );
    const repository = app.get(CharacterPortabilityRepository);
    const realInsert = CharacterPortabilityRepository.prototype.insertGraph;
    vi.spyOn(repository, "insertGraph").mockImplementation((plan, client) =>
      realInsert.call(repository, plan, withFactInsert(client, failingFactInsert)),
    );

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(failingFactInsert).toHaveBeenCalledTimes(1);
    expect(before).toEqual({ appearances: 1, characters: 1, facts: 1 });
    expect(await graphCounts(userId)).toEqual(before);
  });

  it("exports every fact of an appearance holding more than the bundle limit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedAppearanceWithFacts(accessToken, 201);

    const exported = await exportBundle(accessToken);

    const factCounts = z
      .object({
        characters: z.array(
          z.object({ appearances: z.array(z.object({ facts: z.array(z.unknown()) })) }),
        ),
      })
      .parse(exported)
      .characters.flatMap((character) =>
        character.appearances.map((appearance) => appearance.facts.length),
      );
    expect(factCounts).toEqual([201]);
  });

  it("rejects re-importing an over-limit export as too large instead of truncating it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAppearanceWithFacts(accessToken, 201);
    const exported = await exportBundle(accessToken);

    const res = await authed("post", "/api/characters/import", accessToken).send(exported);

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_too_large");
    expect(await graphCounts(userId)).toEqual({ appearances: 1, characters: 1, facts: 201 });
  });
});

describe("character import transport", () => {
  it("accepts a version 2 bundle between the 1 MB global limit and the 8 MiB import budget", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedAppearance(accessToken);
    const bundle = withFirstCharacterAppearances(
      await exportParsedBundle(accessToken),
      (appearances) =>
        appearances.map((appearance) => ({
          ...appearance,
          facts: Array.from({ length: 200 }, (_unused, index) => longFact(index)),
        })),
    );
    const body = JSON.stringify(bundle);
    const bytes = Buffer.byteLength(body);
    expect(bytes).toBeGreaterThan(SPEC_TRANSPORT.globalJsonLimitBytes);
    expect(bytes).toBeLessThan(SPEC_TRANSPORT.importMaxBytes);

    const res = await postJson("/api/characters/import", body, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.created.facts).toBe(200);
  });

  it("reads a body of exactly 8 MiB and judges it by the bundle schema", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const body = paddedJsonBody(SPEC_TRANSPORT.importMaxBytes);
    expect(Buffer.byteLength(body)).toBe(SPEC_TRANSPORT.importMaxBytes);

    const res = await postJson("/api/characters/import", body, accessToken);

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_invalid");
  });

  it("rejects a body one byte over 8 MiB with 413 too large", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const body = paddedJsonBody(SPEC_TRANSPORT.importMaxBytes + 1);

    const res = await postJson("/api/characters/import", body, accessToken);

    expect(res.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(res.body.code).toBe("character_import_too_large");
  });

  it("parses a body that spends exactly the JSON value budget", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const body = emptyObjectsArrayBody(SPEC_TRANSPORT.importMaxJsonValues / 2);
    expect(Buffer.byteLength(body)).toBeLessThan(SPEC_TRANSPORT.importMaxBytes);

    const res = await postJson("/api/characters/import", body, accessToken);

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_invalid");
  });

  it("rejects a body over the JSON value budget but under 8 MiB with 413 too large", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const body = emptyObjectsArrayBody(SPEC_TRANSPORT.importMaxJsonValues / 2 + 1);
    expect(Buffer.byteLength(body)).toBeLessThan(SPEC_TRANSPORT.importMaxBytes);

    const res = await postJson("/api/characters/import", body, accessToken);

    expect(res.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(res.body.code).toBe("character_import_too_large");
  });

  it("rejects a root object with one member over the per-object cap with 413 too large", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const members = Array.from(
      { length: SPEC_TRANSPORT.importMaxJsonObjectMembers + 1 },
      (_unused, index) => `"k${index}":0`,
    );

    const res = await postJson("/api/characters/import", `{${members.join(",")}}`, accessToken);

    expect(res.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(res.body.code).toBe("character_import_too_large");
  });

  it("keeps the 1 MB JSON limit on every other route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, characterId } = await seedAppearance(accessToken);
    const body = JSON.stringify({
      text: "x".repeat(SPEC_TRANSPORT.globalJsonLimitBytes),
      title: "Too long",
    });

    const res = await postJson(
      `/api/books/${bookId}/characters/${characterId}/facts`,
      body,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it("rejects an unauthenticated over-budget import with 401 before reading its body", async () => {
    const body = emptyObjectsArrayBody(SPEC_TRANSPORT.importMaxJsonValues);
    expect(Buffer.byteLength(body)).toBeGreaterThan(SPEC_TRANSPORT.globalJsonLimitBytes);

    const res = await postJson("/api/characters/import", body);

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});
