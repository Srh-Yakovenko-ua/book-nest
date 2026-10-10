import type { INestApplication } from "@nestjs/common";
import type { Response } from "supertest";

import { OwnSpeciesListSchema } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { SpeciesApi } from "./species-api.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { findSystemSpeciesId, seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SpeciesModule } from "../species.module.js";
import {
  readCharacterSpecies,
  readOverrideSpecies,
  seedCharacter,
  seedOverride,
  SPECIES_TEST_IDS,
  speciesApi,
} from "./species-api.fixtures.js";

const UNRELATED_TARGET_ID = "00000000-0000-4000-8000-000000000001";
const TRASHED_AT = new Date("2026-09-01T10:00:00.000Z");

const ID_PROBES = [
  { call: (api: SpeciesApi, id: string) => api.rename(id, "Перейменований"), name: "rename" },
  { call: (api: SpeciesApi, id: string) => api.deletionPreview(id), name: "deletion preview" },
  { call: (api: SpeciesApi, id: string) => api.remove(id), name: "delete" },
  {
    call: (api: SpeciesApi, id: string) => api.merge(id, UNRELATED_TARGET_ID),
    name: "merge source",
  },
] as const;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SpeciesModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

async function createOwn(api: SpeciesApi, name: string): Promise<string> {
  const res = await api.create(name);
  expect(res.status).toBe(201);
  return res.body.id;
}

async function ownNames(api: SpeciesApi): Promise<string[]> {
  return OwnSpeciesListSchema.parse((await api.own()).body).items.map((item) => item.name);
}

async function signIn(): Promise<SpeciesApi & { userId: string }> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  return { ...speciesApi({ accessToken, app }), userId };
}

function withoutRequestId(res: Response): { body: unknown; status: number } {
  const { requestId: _requestId, ...body } = res.body;
  return { body, status: res.status };
}

describe("PATCH /api/species/:speciesId", () => {
  it("renames an own species and returns it under the new name", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");

    const res = await api.rename(speciesId, "Зоряний народ");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      category: null,
      id: speciesId,
      isOwn: true,
      key: null,
      name: "Зоряний народ",
    });
    await expect(ownNames(api)).resolves.toEqual(["Зоряний народ"]);
  });

  it("refuses to rename a system species with 403 species_forbidden", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.rename(elfId, "Перейменований ельф");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "species_forbidden" });
  });

  it("leaves the system labels untouched after a refused rename", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    await api.rename(elfId, "Перейменований ельф");
    const res = await api.candidates("Ельф");

    expect(res.body.exact).toMatchObject({ id: elfId, name: "Ельф" });
  });
});

describe("GET /api/species/:speciesId/deletion-preview", () => {
  it("allows deleting an own species nothing uses", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");

    const res = await api.deletionPreview(speciesId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookOverrides: 0, canDelete: true, characters: 0, trashed: 0 });
  });

  it("counts character and book override usage and forbids deletion", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");
    const character = await seedCharacter({ name: "Ая", prisma, speciesId, userId: api.userId });
    await seedCharacter({ name: "Бран", prisma, speciesId, userId: api.userId });
    await seedOverride({
      characterId: character.id,
      prisma,
      speciesOverrideId: speciesId,
      speciesOverrideIsSpoiler: false,
      userId: api.userId,
    });

    const res = await api.deletionPreview(speciesId);

    expect(res.body).toEqual({ bookOverrides: 1, canDelete: false, characters: 2, trashed: 0 });
  });

  it("refuses to preview a system species with 403 species_forbidden", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.deletionPreview(elfId);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "species_forbidden" });
  });
});

describe("DELETE /api/species/:speciesId", () => {
  it("deletes an unused own species with 204", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");

    const res = await api.remove(speciesId);

    expect(res.status).toBe(204);
    await expect(ownNames(api)).resolves.toEqual([]);
  });

  it("refuses with 409 species_in_use while a live character uses the species", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");
    await seedCharacter({ name: "Ая", prisma, speciesId, userId: api.userId });

    const res = await api.remove(speciesId);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_in_use",
      details: { bookOverrides: 0, characters: 1, trashed: 0 },
    });
    await expect(ownNames(api)).resolves.toEqual(["Зорянин"]);
  });

  it("refuses with 409 species_in_use while only a book override uses the species", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");
    const character = await seedCharacter({ name: "Ая", prisma, userId: api.userId });
    await seedOverride({
      characterId: character.id,
      prisma,
      speciesOverrideId: speciesId,
      speciesOverrideIsSpoiler: true,
      userId: api.userId,
    });

    const res = await api.remove(speciesId);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_in_use",
      details: { bookOverrides: 1, characters: 0, trashed: 0 },
    });
  });

  it("refuses with 409 species_in_use while only a trashed character uses the species", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");
    await seedCharacter({
      deletedAt: TRASHED_AT,
      name: "Ая",
      prisma,
      speciesId,
      userId: api.userId,
    });

    const res = await api.remove(speciesId);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_in_use",
      details: { bookOverrides: 0, characters: 1, trashed: 1 },
    });
  });

  it("deletes the species once its last reference has moved away", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");
    const character = await seedCharacter({ name: "Ая", prisma, speciesId, userId: api.userId });
    await prisma.character.update({ data: { speciesId: null }, where: { id: character.id } });

    const res = await api.remove(speciesId);

    expect(res.status).toBe(204);
  });

  it("refuses to delete a system species with 403 species_forbidden", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.remove(elfId);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "species_forbidden" });
  });
});

describe("POST /api/species/:speciesId/merge into a system species", () => {
  it("moves every character and book override onto the target and reports the counts", async () => {
    const api = await signIn();
    const sourceId = await createOwn(api, "Ельфійка");
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const first = await seedCharacter({
      name: "Ая",
      prisma,
      speciesId: sourceId,
      userId: api.userId,
    });
    const second = await seedCharacter({
      deletedAt: TRASHED_AT,
      name: "Бран",
      prisma,
      speciesId: sourceId,
      userId: api.userId,
    });
    const override = await seedOverride({
      characterId: second.id,
      prisma,
      speciesOverrideId: sourceId,
      speciesOverrideIsSpoiler: false,
      userId: api.userId,
    });

    const res = await api.merge(sourceId, elfId, "en");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reassigned: { bookOverrides: 1, characters: 2 },
      target: {
        category: { key: "elven", name: "Elves & kin" },
        id: elfId,
        isOwn: false,
        key: "elf",
        name: "Elf",
      },
    });
    await expect(readCharacterSpecies({ characterId: first.id, prisma })).resolves.toMatchObject({
      speciesId: elfId,
    });
    await expect(readCharacterSpecies({ characterId: second.id, prisma })).resolves.toMatchObject({
      speciesId: elfId,
    });
    await expect(
      readOverrideSpecies({ bookCharacterId: override.id, prisma }),
    ).resolves.toMatchObject({ speciesId: elfId });
  });

  it("deletes the merged source species", async () => {
    const api = await signIn();
    const sourceId = await createOwn(api, "Ельфійка");
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    await api.merge(sourceId, elfId);

    await expect(ownNames(api)).resolves.toEqual([]);
    expect((await api.deletionPreview(sourceId)).status).toBe(404);
  });

  it("keeps each override's spoiler flag and every legacy text exactly as it was", async () => {
    const api = await signIn();
    const sourceId = await createOwn(api, "Ельфійка");
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const character = await seedCharacter({
      legacySpecies: "ельфійка ",
      name: "Ая",
      prisma,
      speciesId: sourceId,
      userId: api.userId,
    });
    const hidden = await seedOverride({
      characterId: character.id,
      legacySpeciesOverride: "Ельфійка (таємно)",
      prisma,
      speciesOverrideId: sourceId,
      speciesOverrideIsSpoiler: true,
      userId: api.userId,
    });
    const shown = await seedOverride({
      characterId: character.id,
      legacySpeciesOverride: null,
      prisma,
      speciesOverrideId: sourceId,
      speciesOverrideIsSpoiler: false,
      userId: api.userId,
    });

    await api.merge(sourceId, elfId);

    await expect(readCharacterSpecies({ characterId: character.id, prisma })).resolves.toEqual({
      legacy: "ельфійка ",
      speciesId: elfId,
    });
    await expect(readOverrideSpecies({ bookCharacterId: hidden.id, prisma })).resolves.toEqual({
      isSpoiler: true,
      legacy: "Ельфійка (таємно)",
      speciesId: elfId,
    });
    await expect(readOverrideSpecies({ bookCharacterId: shown.id, prisma })).resolves.toEqual({
      isSpoiler: false,
      legacy: null,
      speciesId: elfId,
    });
  });
});

describe("POST /api/species/:speciesId/merge into an own species", () => {
  it("moves the references onto the own target and removes the source", async () => {
    const api = await signIn();
    const sourceId = await createOwn(api, "Зорянка");
    const targetId = await createOwn(api, "Зорянин");
    const character = await seedCharacter({
      name: "Ая",
      prisma,
      speciesId: sourceId,
      userId: api.userId,
    });
    const override = await seedOverride({
      characterId: character.id,
      prisma,
      speciesOverrideId: sourceId,
      speciesOverrideIsSpoiler: true,
      userId: api.userId,
    });

    const res = await api.merge(sourceId, targetId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reassigned: { bookOverrides: 1, characters: 1 },
      target: { id: targetId, isOwn: true, name: "Зорянин" },
    });
    await expect(
      readCharacterSpecies({ characterId: character.id, prisma }),
    ).resolves.toMatchObject({ speciesId: targetId });
    await expect(readOverrideSpecies({ bookCharacterId: override.id, prisma })).resolves.toEqual({
      isSpoiler: true,
      legacy: null,
      speciesId: targetId,
    });
    await expect(ownNames(api)).resolves.toEqual(["Зорянин"]);
  });
});

describe("POST /api/species/:speciesId/merge refusals", () => {
  it("rejects merging a species into itself with 400 species_merge_self", async () => {
    const api = await signIn();
    const speciesId = await createOwn(api, "Зорянин");

    const res = await api.merge(speciesId, speciesId);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "species_merge_self" });
    await expect(ownNames(api)).resolves.toEqual(["Зорянин"]);
  });

  it("rejects merging a system species away with 403 species_forbidden", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });
    const targetId = await createOwn(api, "Зорянин");

    const res = await api.merge(elfId, targetId);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "species_forbidden" });
  });

  it("rejects a missing target with 422 species_merge_invalid_target and keeps the source", async () => {
    const api = await signIn();
    const sourceId = await createOwn(api, "Зорянин");
    const character = await seedCharacter({
      name: "Ая",
      prisma,
      speciesId: sourceId,
      userId: api.userId,
    });

    const res = await api.merge(sourceId, SPECIES_TEST_IDS.missing);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: "species_merge_invalid_target" });
    await expect(
      readCharacterSpecies({ characterId: character.id, prisma }),
    ).resolves.toMatchObject({ speciesId: sourceId });
  });
});

describe("species ID probes across users", () => {
  it.each(ID_PROBES)(
    "answers $name on another user's species exactly as on a missing id",
    async ({ call }) => {
      const alice = await signIn();
      const bob = await signIn();
      const bobsId = await createOwn(bob, "Мороколь");

      const [foreign, missing] = await Promise.all([
        call(alice, bobsId),
        call(alice, SPECIES_TEST_IDS.missing),
      ]);

      expect(foreign.status).toBe(404);
      expect(foreign.body).toMatchObject({ code: "species_not_found" });
      expect(withoutRequestId(foreign)).toEqual(withoutRequestId(missing));
    },
  );

  it.each(ID_PROBES)(
    "leaves the other user's species intact after a $name probe",
    async ({ call }) => {
      const alice = await signIn();
      const bob = await signIn();
      const bobsId = await createOwn(bob, "Мороколь");

      await call(alice, bobsId);

      await expect(ownNames(bob)).resolves.toEqual(["Мороколь"]);
    },
  );

  it("answers a merge into another user's species exactly as into a missing target", async () => {
    const alice = await signIn();
    const bob = await signIn();
    const bobsId = await createOwn(bob, "Мороколь");
    const sourceId = await createOwn(alice, "Зорянин");

    const foreign = await alice.merge(sourceId, bobsId);
    const missing = await alice.merge(sourceId, SPECIES_TEST_IDS.missing);

    expect(foreign.status).toBe(422);
    expect(foreign.body).toMatchObject({ code: "species_merge_invalid_target" });
    expect(withoutRequestId(foreign)).toEqual(withoutRequestId(missing));
    await expect(ownNames(alice)).resolves.toEqual(["Зорянин"]);
  });
});
