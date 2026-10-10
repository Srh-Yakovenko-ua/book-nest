import type { INestApplication } from "@nestjs/common";

import { OwnSpeciesListSchema, SpeciesCandidatesSchema } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { findSystemSpeciesId, seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SpeciesModule } from "../species.module.js";
import { speciesApi } from "./species-api.fixtures.js";

const UNICODE = {
  modifierApostrophe: String.fromCodePoint(0x02bc),
  noBreakSpace: String.fromCodePoint(0x00a0),
  rightQuote: String.fromCodePoint(0x2019),
} as const;

const APOSTROPHE_VARIANTS = [
  { apostrophe: "'", label: "U+0027" },
  { apostrophe: UNICODE.rightQuote, label: "U+2019" },
  { apostrophe: UNICODE.modifierApostrophe, label: "U+02BC" },
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

async function ownCount(api: ReturnType<typeof speciesApi>): Promise<number> {
  return OwnSpeciesListSchema.parse((await api.own()).body).items.length;
}

async function registerSystemAlias({
  key,
  name,
  normalizedName,
}: {
  key: string;
  name: string;
  normalizedName: string;
}): Promise<string> {
  const speciesId = await findSystemSpeciesId({ app, key });
  await prisma.speciesName.create({
    data: { kind: "alias", locale: "uk", name, normalizedName, speciesId },
  });
  return speciesId;
}

async function signIn(): Promise<ReturnType<typeof speciesApi>> {
  const { accessToken } = await context.registerVerifyAndLogin();
  return speciesApi({ accessToken, app });
}

describe("POST /api/species against a system label", () => {
  it.each([
    { input: "  темний   ЕЛЬФ ", label: "the Ukrainian label in other casing and spacing" },
    {
      input: `Темний${UNICODE.noBreakSpace}ельф`,
      label: "the Ukrainian label with a no-break space",
    },
    { input: "DARK  elf", label: "the English label in other casing and spacing" },
  ])("answers 409 with the visible system species for $label", async ({ input }) => {
    const api = await signIn();
    const darkElfId = await findSystemSpeciesId({ app, key: "dark_elf" });

    const res = await api.create(input);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_duplicate",
      details: {
        species: { id: darkElfId, isOwn: false, key: "dark_elf", name: "Темний ельф" },
      },
    });
  });

  it("creates nothing when the name collides with a system label", async () => {
    const api = await signIn();

    await api.create("Відьмак");

    await expect(ownCount(api)).resolves.toBe(0);
  });

  it("labels the colliding system species in the requested locale", async () => {
    const api = await signIn();

    const res = await api.create("Witcher", "en");

    expect(res.body.details.species).toMatchObject({ key: "witcher", name: "Witcher" });
  });
});

describe("POST /api/species against a registered alias", () => {
  it.each(APOSTROPHE_VARIANTS)(
    "answers 409 with the aliased system species when the alias is typed with $label",
    async ({ apostrophe }) => {
      const api = await signIn();
      const dragonId = await registerSystemAlias({
        key: "dragon",
        name: "Пір'ястий змій",
        normalizedName: "пір'ястий змій",
      });

      const res = await api.create(`ПІР${apostrophe}ЯСТИЙ  змій`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: "species_duplicate",
        details: { species: { id: dragonId, key: "dragon", name: "Дракон" } },
      });
    },
  );
});

describe("POST /api/species against the caller's own species", () => {
  it.each(APOSTROPHE_VARIANTS)(
    "answers 409 with the own species when its name is retyped with $label",
    async ({ apostrophe }) => {
      const api = await signIn();
      const first = await api.create("Кам'яник");

      const res = await api.create(`  КАМ${apostrophe}ЯНИК`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: "species_duplicate",
        details: { species: { id: first.body.id, isOwn: true, key: null, name: "Кам'яник" } },
      });
      await expect(ownCount(api)).resolves.toBe(1);
    },
  );
});

describe("POST /api/species with a name that only resembles an existing species", () => {
  it("offers the resembling system species as a similar candidate, not as an exact match", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.candidates("Ельфійка");
    const candidates = SpeciesCandidatesSchema.parse(res.body);

    expect(candidates.exact).toBeNull();
    expect(candidates.similar.map((item) => item.id)).toContain(elfId);
  });

  it("creates the near-miss name as a new own species", async () => {
    const api = await signIn();

    const res = await api.create("Ельфійка");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ category: null, isOwn: true, key: null, name: "Ельфійка" });
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("reports the exact system match for a name that differs only in casing", async () => {
    const api = await signIn();
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.candidates("ЕЛЬФ");

    expect(SpeciesCandidatesSchema.parse(res.body).exact?.id).toBe(elfId);
  });
});

describe("POST /api/species twice at once with the same name", () => {
  it("creates one species and answers the other request with 409 pointing at it", async () => {
    const api = await signIn();

    const responses = await Promise.all([api.create("Зорянин"), api.create("ЗОРЯНИН ")]);

    const created = responses.filter((res) => res.status === 201);
    const conflicted = responses.filter((res) => res.status === 409);
    expect(created).toHaveLength(1);
    expect(conflicted).toHaveLength(1);
    expect(conflicted[0]?.body).toMatchObject({
      code: "species_duplicate",
      details: { species: { id: created[0]?.body.id } },
    });
    await expect(ownCount(api)).resolves.toBe(1);
  });
});

describe("PATCH /api/species/:speciesId name collisions", () => {
  it("answers 409 when renaming onto a system label", async () => {
    const api = await signIn();
    const own = await api.create("Зорянин");
    const elfId = await findSystemSpeciesId({ app, key: "elf" });

    const res = await api.rename(own.body.id, "Elf");

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_duplicate",
      details: { species: { id: elfId } },
    });
  });

  it("answers 409 when renaming onto another own species", async () => {
    const api = await signIn();
    const kept = await api.create("Кам'яник");
    const renamed = await api.create("Зорянин");

    const res = await api.rename(renamed.body.id, `кам${UNICODE.rightQuote}яник`);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "species_duplicate",
      details: { species: { id: kept.body.id, isOwn: true } },
    });
  });

  it("lets an own species be respelled to another casing of its own name", async () => {
    const api = await signIn();
    const own = await api.create("зорянин");

    const res = await api.rename(own.body.id, "Зорянин");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: own.body.id, name: "Зорянин" });
  });
});
