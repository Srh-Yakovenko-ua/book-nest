import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { normalizeSpeciesName } from "../domain/species-name-normalizer.js";

const BACKFILL_MIGRATION_URL = new URL(
  "../../../../prisma/migrations/20261009130000_species_catalog_backfill/migration.sql",
  import.meta.url,
);

const cp = (...points: number[]): string => String.fromCodePoint(...points);

const CHARS = {
  enDash: cp(0x2013),
  modifierApostrophe: cp(0x02bc),
  noBreakSpace: cp(0x00a0),
  rightQuote: cp(0x2019),
  tab: cp(0x09),
} as const;

const STAMPS = {
  newest: new Date("2026-03-01T10:00:00.000Z"),
  older: new Date("2026-01-01T10:00:00.000Z"),
} as const;

const CharacterRowSchema = z.object({
  id: z.string(),
  legacy: z.string().nullable(),
  speciesId: z.string().nullable(),
});

const OverrideRowSchema = CharacterRowSchema.extend({ isSpoiler: z.boolean() });

const PrivateSpeciesRowSchema = z.object({
  categoryKey: z.string().nullable(),
  id: z.string(),
  key: z.string().nullable(),
  name: z.string(),
  normalizedName: z.string(),
  userId: z.string(),
});

const IdRowSchema = z.object({ id: z.string() });

const NormalizedRowSchema = z.object({ normalized: z.string() });

type BackfillSnapshot = {
  characters: z.infer<typeof CharacterRowSchema>[];
  overrides: z.infer<typeof OverrideRowSchema>[];
  privateSpecies: z.infer<typeof PrivateSpeciesRowSchema>[];
};

type LegacyLibrary = Awaited<ReturnType<typeof seedLegacyLibrary>>;

let app: INestApplication;
let prisma: PrismaService;
let backfillSql: string;

beforeAll(async () => {
  app = await createTestApp([]);
  prisma = app.get(PrismaService);
  backfillSql = await readFile(BACKFILL_MIGRATION_URL, "utf8");
});

afterAll(async () => {
  await app.close();
});

async function backfilledLibrary(): Promise<{ library: LegacyLibrary; state: BackfillSnapshot }> {
  const library = await seedLegacyLibrary();
  await runBackfill();
  return { library, state: await snapshot() };
}

function characterSpecies(state: BackfillSnapshot, id: string): Nullable<string> {
  return state.characters.find((row) => row.id === id)?.speciesId ?? null;
}

async function createBook(userId: string): Promise<string> {
  const book = await prisma.book.create({
    data: { title: "Backfill probe", userId },
    select: { id: true },
  });
  return book.id;
}

async function createUser(): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: { email: `backfill-${id}@example.test`, id, name: "Backfill probe", passwordHash: "x" },
  });
  return id;
}

async function insertLegacyCharacter({
  legacy,
  speciesId = null,
  updatedAt = STAMPS.older,
  userId,
}: {
  legacy: Nullable<string>;
  speciesId?: Nullable<string>;
  updatedAt?: Date;
  userId: string;
}): Promise<string> {
  const name = `Character ${randomUUID()}`;
  const rows = await prisma.$queryRaw`
    INSERT INTO characters (id, user_id, name, normalized_name, species, species_id, updated_at)
    VALUES (gen_random_uuid(), ${userId}::uuid, ${name}, ${name.toLowerCase()}, ${legacy},
            ${speciesId}::uuid, ${updatedAt})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

async function insertLegacyOverride({
  bookId,
  characterId,
  isSpoiler,
  legacy,
  updatedAt = STAMPS.older,
}: {
  bookId: string;
  characterId: string;
  isSpoiler: boolean;
  legacy: Nullable<string>;
  updatedAt?: Date;
}): Promise<string> {
  const rows = await prisma.$queryRaw`
    INSERT INTO book_characters
      (id, book_id, character_id, species_override, species_override_is_spoiler, updated_at)
    VALUES (gen_random_uuid(), ${bookId}::uuid, ${characterId}::uuid, ${legacy}, ${isSpoiler},
            ${updatedAt})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

function overrideRow(state: BackfillSnapshot, id: string) {
  return state.overrides.find((row) => row.id === id);
}

function privateSpecies(state: BackfillSnapshot, id: Nullable<string>) {
  return state.privateSpecies.find((row) => row.id === id);
}

async function runBackfill(): Promise<string[]> {
  return withSession(async (client) => {
    const notices: string[] = [];
    client.on("notice", (notice) => notices.push(notice.message ?? ""));
    await client.query("BEGIN");
    try {
      await client.query(backfillSql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return notices;
  });
}

async function seedLegacyLibrary() {
  await seedSystemSpeciesCatalog(app);
  const alice = await createUser();
  const bob = await createUser();
  const aliceBook = await createBook(alice);
  const existingOwn = await prisma.species.create({
    data: { name: "Скельник", normalizedName: "скельник", userId: alice },
    select: { id: true },
  });

  const character = (legacy: Nullable<string>, updatedAt?: Date) =>
    insertLegacyCharacter({ legacy, updatedAt, userId: alice });

  const characters = {
    blankText: await character("   "),
    bobMage: await insertLegacyCharacter({ legacy: "Ельф-маг", userId: bob }),
    darkElfNoBreakSpace: await character(`Темний${CHARS.noBreakSpace}ЕЛЬФ`),
    emptyText: await character(""),
    existingOwnUpper: await character("СКЕЛЬНИК"),
    mageEnDash: await character(`ельф${CHARS.enDash}МАГ`),
    mageNewest: await character("Ельф-маг", STAMPS.newest),
    noBreakSpaceOnly: await character(`${CHARS.noBreakSpace}${CHARS.noBreakSpace}`),
    nullText: await character(null),
    paddedEnglish: await character("  human "),
    stoneModifier: await character(`КАМ${CHARS.modifierApostrophe}ЯНИК `, STAMPS.newest),
    stoneRightQuote: await character(`кам${CHARS.rightQuote}яник`),
    stoneStraight: await character("Кам'яник"),
    upperUkrainian: await character("ЛЮДИНА"),
    witcher: await character("Відьмак"),
  };

  const overrides = {
    blank: await insertLegacyOverride({
      bookId: aliceBook,
      characterId: characters.paddedEnglish,
      isSpoiler: true,
      legacy: null,
    }),
    hiddenUnknown: await insertLegacyOverride({
      bookId: aliceBook,
      characterId: characters.nullText,
      isSpoiler: true,
      legacy: `Нічний ${CHARS.tab} мисливець`,
    }),
    sharedMage: await insertLegacyOverride({
      bookId: aliceBook,
      characterId: characters.witcher,
      isSpoiler: true,
      legacy: "ельф-маг",
    }),
    systemVampire: await insertLegacyOverride({
      bookId: aliceBook,
      characterId: characters.upperUkrainian,
      isSpoiler: false,
      legacy: "  VAMPIRE",
    }),
  };

  return { alice, bob, characters, existingOwnId: existingOwn.id, overrides };
}

async function snapshot(): Promise<BackfillSnapshot> {
  const [characters, overrides, privateSpecies] = await Promise.all([
    prisma.$queryRaw`
      SELECT id::text AS id, species_id::text AS "speciesId", species AS legacy
      FROM characters ORDER BY id
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, species_override_id::text AS "speciesId",
             species_override AS legacy, species_override_is_spoiler AS "isSpoiler"
      FROM book_characters ORDER BY id
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, user_id::text AS "userId", key, category_key AS "categoryKey",
             name, normalized_name AS "normalizedName"
      FROM species WHERE user_id IS NOT NULL ORDER BY id
    `,
  ]);
  return {
    characters: z.array(CharacterRowSchema).parse(characters),
    overrides: z.array(OverrideRowSchema).parse(overrides),
    privateSpecies: z.array(PrivateSpeciesRowSchema).parse(privateSpecies),
  };
}

async function systemId(key: string): Promise<string> {
  const species = await prisma.species.findFirstOrThrow({
    select: { id: true },
    where: { key, userId: null },
  });
  return species.id;
}

async function withSession<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe("species backfill migration on legacy text", () => {
  afterEach(async () => {
    await truncateAllTables(app);
  });

  it("maps odd casing, padding and no-break spaces of system labels to the system species", async () => {
    const { library, state } = await backfilledLibrary();
    const { characters } = library;

    expect(characterSpecies(state, characters.upperUkrainian)).toBe(await systemId("human"));
    expect(characterSpecies(state, characters.paddedEnglish)).toBe(await systemId("human"));
    expect(characterSpecies(state, characters.witcher)).toBe(await systemId("witcher"));
    expect(characterSpecies(state, characters.darkElfNoBreakSpace)).toBe(
      await systemId("dark_elf"),
    );
  });

  it("leaves NULL, empty, blank and no-break-space-only text without a species", async () => {
    const { library, state } = await backfilledLibrary();
    const { characters } = library;

    expect(
      [
        characters.nullText,
        characters.emptyText,
        characters.blankText,
        characters.noBreakSpaceOnly,
      ].map((id) => characterSpecies(state, id)),
    ).toEqual([null, null, null, null]);
  });

  it("gives an owner one private species shared by the characters and overrides that spell it", async () => {
    const { library, state } = await backfilledLibrary();
    const mageId = characterSpecies(state, library.characters.mageNewest);

    expect(characterSpecies(state, library.characters.mageEnDash)).toBe(mageId);
    expect(overrideRow(state, library.overrides.sharedMage)?.speciesId).toBe(mageId);
    expect(privateSpecies(state, mageId)).toMatchObject({
      categoryKey: null,
      key: null,
      normalizedName: "ельф-маг",
      userId: library.alice,
    });
  });

  it("names a private species after its most recently updated spelling", async () => {
    const { library, state } = await backfilledLibrary();

    expect(
      privateSpecies(state, characterSpecies(state, library.characters.mageNewest))?.name,
    ).toBe("Ельф-маг");
  });

  it("keeps the same unknown name of a second owner in that owner's own private species", async () => {
    const { library, state } = await backfilledLibrary();
    const bobsId = characterSpecies(state, library.characters.bobMage);

    expect(bobsId).not.toBe(characterSpecies(state, library.characters.mageNewest));
    expect(privateSpecies(state, bobsId)).toMatchObject({
      normalizedName: "ельф-маг",
      userId: library.bob,
    });
  });

  it("folds U+0027, U+2019 and U+02BC apostrophes into one private species", async () => {
    const { library, state } = await backfilledLibrary();
    const { characters } = library;
    const stoneId = characterSpecies(state, characters.stoneStraight);

    expect(characterSpecies(state, characters.stoneRightQuote)).toBe(stoneId);
    expect(characterSpecies(state, characters.stoneModifier)).toBe(stoneId);
    expect(privateSpecies(state, stoneId)).toMatchObject({
      name: `КАМ${CHARS.modifierApostrophe}ЯНИК`,
      normalizedName: "кам'яник",
    });
  });

  it("reuses an own species the owner already has instead of creating a second one", async () => {
    const { library, state } = await backfilledLibrary();

    expect(characterSpecies(state, library.characters.existingOwnUpper)).toBe(
      library.existingOwnId,
    );
    expect(
      state.privateSpecies.filter((row) => row.normalizedName === "скельник").map((row) => row.id),
    ).toEqual([library.existingOwnId]);
  });

  it("creates exactly one private species per owner and normalized name", async () => {
    const { library, state } = await backfilledLibrary();

    expect(
      state.privateSpecies
        .map((row) => `${row.userId === library.alice ? "alice" : "bob"}:${row.normalizedName}`)
        .sort(),
    ).toEqual([
      "alice:ельф-маг",
      "alice:кам'яник",
      "alice:нічний мисливець",
      "alice:скельник",
      "bob:ельф-маг",
    ]);
  });

  it("turns an unknown override into a private species of the character owner and keeps it a spoiler", async () => {
    const { library, state } = await backfilledLibrary();
    const override = overrideRow(state, library.overrides.hiddenUnknown);

    expect(override?.isSpoiler).toBe(true);
    expect(privateSpecies(state, override?.speciesId ?? null)).toMatchObject({
      name: "Нічний мисливець",
      userId: library.alice,
    });
  });

  it("maps an override that spells a system label to the system species and keeps it visible", async () => {
    const { library, state } = await backfilledLibrary();

    expect(overrideRow(state, library.overrides.systemVampire)).toMatchObject({
      isSpoiler: false,
      speciesId: await systemId("vampire"),
    });
  });

  it("leaves an override without text unset and keeps its spoiler flag", async () => {
    const { library, state } = await backfilledLibrary();

    expect(overrideRow(state, library.overrides.blank)).toMatchObject({
      isSpoiler: true,
      speciesId: null,
    });
  });

  it("never rewrites legacy text or spoiler flags", async () => {
    await seedLegacyLibrary();
    const before = await snapshot();

    await runBackfill();
    const after = await snapshot();

    const legacyOf = (state: BackfillSnapshot) => ({
      characters: state.characters.map(({ id, legacy }) => ({ id, legacy })),
      overrides: state.overrides.map(({ id, isSpoiler, legacy }) => ({ id, isSpoiler, legacy })),
    });
    expect(legacyOf(after)).toEqual(legacyOf(before));
  });

  it("reports the reconciliation totals", async () => {
    await seedLegacyLibrary();

    const notices = await runBackfill();

    expect(notices).toContain(
      "species backfill: characters systemMatched=4 privateMatched=7 blankSkipped=4; " +
        "overrides systemMatched=1 privateMatched=2 blankSkipped=1; " +
        "privateSpeciesBackingLegacyText=5",
    );
  });

  it("changes nothing on a second run", async () => {
    await seedLegacyLibrary();
    await runBackfill();
    const afterFirst = await snapshot();

    await runBackfill();

    await expect(snapshot()).resolves.toEqual(afterFirst);
  });
});

describe("species backfill parity guard", () => {
  afterEach(async () => {
    await truncateAllTables(app);
  });

  beforeEach(async () => {
    await seedSystemSpeciesCatalog(app);
  });

  it("refuses an override on a book owned by someone other than the character owner", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const characterId = await insertLegacyCharacter({ legacy: "Відьмак", userId: alice });
    await insertLegacyOverride({
      bookId: await createBook(bob),
      characterId,
      isSpoiler: false,
      legacy: "Невідомий народ",
    });

    await expect(runBackfill()).rejects.toThrow(/species backfill refused: 1 book characters/);
  });

  it("rolls back every mapping when it refuses", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const characterId = await insertLegacyCharacter({ legacy: "Відьмак", userId: alice });
    await insertLegacyOverride({
      bookId: await createBook(bob),
      characterId,
      isSpoiler: false,
      legacy: "Невідомий народ",
    });

    await runBackfill().catch(() => null);
    const state = await snapshot();

    expect(characterSpecies(state, characterId)).toBeNull();
    expect(state.privateSpecies).toEqual([]);
  });

  it("refuses a species FK that already points at another user's private species", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const bobsSpecies = await prisma.species.create({
      data: { name: "Мороколь", normalizedName: "мороколь", userId: bob },
      select: { id: true },
    });
    await insertLegacyCharacter({ legacy: "Мороколь", speciesId: bobsSpecies.id, userId: alice });

    await expect(runBackfill()).rejects.toThrow(
      /species backfill refused: 1 species FKs point at another user's private species/,
    );
  });
});

const PARITY_INPUTS = [
  { label: "tabs and newlines around Latin", value: `  Dark ${CHARS.tab}  Elf ${cp(0x0a)}` },
  { label: "upper-case Cyrillic", value: "Темний ЕЛЬФ" },
  { label: "Cyrillic ghe with upturn", value: `${cp(0x0490)}АВА` },
  { label: "left single quote U+2018", value: `Сім${cp(0x2018)}я` },
  { label: "right single quote U+2019", value: `Сім${cp(0x2019)}я` },
  { label: "modifier apostrophe U+02BC", value: `Сім${cp(0x02bc)}я` },
  { label: "grave accent U+0060", value: `Сім${cp(0x0060)}я` },
  { label: "acute accent U+00B4", value: `Сім${cp(0x00b4)}я` },
  { label: "fullwidth apostrophe U+FF07", value: `Сім${cp(0xff07)}я` },
  { label: "hyphen U+2010", value: `Half${cp(0x2010)}Elf` },
  { label: "non-breaking hyphen U+2011", value: `Half${cp(0x2011)}Elf` },
  { label: "figure dash U+2012", value: `Half${cp(0x2012)}Elf` },
  { label: "en dash U+2013", value: `Half${cp(0x2013)}Elf` },
  { label: "em dash U+2014", value: `Half${cp(0x2014)}Elf` },
  { label: "horizontal bar U+2015", value: `Half${cp(0x2015)}Elf` },
  { label: "minus sign U+2212", value: `Half${cp(0x2212)}Elf` },
  { label: "small em dash U+FE58", value: `Half${cp(0xfe58)}Elf` },
  { label: "small hyphen-minus U+FE63", value: `Half${cp(0xfe63)}Elf` },
  { label: "fullwidth hyphen-minus U+FF0D", value: `Half${cp(0xff0d)}Elf` },
  { label: "fullwidth Latin letters", value: cp(0xff25, 0xff2c, 0xff26) },
  { label: "fi ligature", value: `${cp(0xfb01)}re giant` },
  { label: "Kelvin sign", value: `${cp(0x212a)}obold` },
  { label: "decomposed Ukrainian yi", value: `${cp(0x0456, 0x0308)}жак` },
  { label: "combining acute on e", value: `Ve${cp(0x0301)}la` },
  { label: "no-break space", value: `Sea${cp(0x00a0)}elf` },
  { label: "narrow no-break and figure spaces", value: `Sea${cp(0x202f, 0x2007)}elf` },
  { label: "ideographic space", value: `Sea${cp(0x3000)}elf` },
  {
    label: "byte order mark and line separators",
    value: `${cp(0xfeff)}Sea${cp(0x2028)}elf${cp(0x2029)}`,
  },
  { label: "ogham and medium mathematical spaces", value: `Sea${cp(0x1680)}elf${cp(0x205f)}` },
  { label: "vertical tab and form feed", value: `Sea${cp(0x0b, 0x0c)}elf` },
  { label: "zero-width space", value: `Sea${cp(0x200b)}elf` },
  { label: "next line U+0085", value: `Sea${cp(0x0085)}elf` },
  { label: "Mongolian vowel separator", value: `Sea${cp(0x180e)}elf` },
  { label: "dotted capital I", value: `${cp(0x0130)}stanbul` },
  { label: "Greek final sigma", value: cp(0x039f, 0x0394, 0x039f, 0x03a3, 0x0020, 0x039d, 0x03a5) },
  { label: "titlecase digraph", value: `${cp(0x01c5)}in` },
  { label: "capital sharp s", value: `${cp(0x1e9e)}TRASSE` },
  { label: "astral emoji", value: `${cp(0x1f409)} Дракон` },
  { label: "empty string", value: "" },
  { label: "whitespace only", value: ` ${CHARS.tab} ${cp(0x00a0)}` },
] as const;

describe("species name normalization parity between the migration and TypeScript", () => {
  const postgresResults = new Map<string, string>();

  beforeAll(async () => {
    await truncateAllTables(app);
    await withSession(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(backfillSql);
        for (const input of PARITY_INPUTS) {
          const result = await client.query(
            "SELECT pg_temp.normalize_species_name($1) AS normalized",
            [input.value],
          );
          postgresResults.set(
            input.label,
            z.tuple([NormalizedRowSchema]).parse(result.rows)[0].normalized,
          );
        }
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it.each(PARITY_INPUTS)("normalizes $label identically", ({ label, value }) => {
    expect(postgresResults.get(label)).toBe(normalizeSpeciesName(value));
  });
});
