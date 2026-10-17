import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { parseISO } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CharacterFactModel } from "../../../generated/prisma/models.js";
import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";
import { CharacterFactsRepository } from "../infrastructure/character-facts.repository.js";
import { CharacterMergeRepository } from "../infrastructure/character-merge.repository.js";

type Gate = {
  entered: Promise<void>;
  markEntered: () => void;
  release: () => void;
  released: Promise<void>;
};

type MergeScenario = {
  loser: string;
  loserOnlyAppearance: string;
  loserSharedAppearance: string;
  onlyLoserBook: string;
  sharedBook: string;
  survivor: string;
  survivorSharedAppearance: string;
  token: string;
};

type SeedFact = Omit<CharacterFactModel, "bookCharacterId">;

const FIXTURE = {
  characterNotFound: "character_not_found",
  createdAt: parseISO("2020-01-02T03:04:05.678Z"),
  duplicate: { text: "Wields a sword of fire", title: "Flaming sword" },
  factIds: {
    loserOnly: "a1111111-1111-4111-8111-111111111111",
    loserOnlySecond: "a5555555-5555-4555-8555-555555555555",
    loserSharedDuplicate: "a2222222-2222-4222-8222-222222222222",
    loserSharedSecondDuplicate: "a3333333-3333-4333-8333-333333333333",
    loserSharedUnique: "a4444444-4444-4444-8444-444444444444",
    survivorSharedDuplicate: "b1111111-1111-4111-8111-111111111111",
    survivorSharedUnique: "b2222222-2222-4222-8222-222222222222",
  },
  lockWaitTimeoutMs: 10_000,
  pollIntervalMs: 10,
  updatedAt: parseISO("2021-06-07T08:09:10.111Z"),
} as const;

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

const openGates: Gate[] = [];

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let factsRepository: CharacterFactsRepository;
let mergeRepository: CharacterMergeRepository;

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
  factsRepository = app.get(CharacterFactsRepository);
  mergeRepository = app.get(CharacterMergeRepository);
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  for (const gate of openGates.splice(0)) {
    gate.release();
  }
  vi.restoreAllMocks();
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function allFacts(): Promise<CharacterFactModel[]> {
  return prisma.characterFact.findMany({ orderBy: { id: "asc" } });
}

async function appearanceIdOf(bookId: string, characterId: string): Promise<string> {
  const row = await prisma.bookCharacter.findFirstOrThrow({
    select: { id: true },
    where: { bookId, characterId },
  });
  return row.id;
}

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function countMergeLocks({ granted }: { granted: boolean }): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND granted = ${granted}
      AND classid::int = ${ADVISORY_LOCK_CLASS.characterMerge}
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
  `;
  return rows[0]?.total ?? 0;
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

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function createGate(): Gate {
  let markEntered = (): void => undefined;
  let release = (): void => undefined;
  const entered = new Promise<void>((resolve) => {
    markEntered = () => resolve();
  });
  const released = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  const gate = { entered, markEntered, release, released };
  openGates.push(gate);
  return gate;
}

function factsPath(bookId: string, characterId: string): string {
  return `/api/books/${bookId}/characters/${characterId}/facts`;
}

async function linkToBook(token: string, bookId: string, characterId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting" },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

function mergeRequest({ loser, survivor, token }: MergeScenario): request.Test {
  return authed("post", `/api/characters/${survivor}/merge`, token).send({ otherId: loser });
}

function seedFact(id: string, content: Partial<SeedFact> = {}): SeedFact {
  return {
    chapter: null,
    createdAt: FIXTURE.createdAt,
    id,
    page: null,
    text: `Text of ${id}`,
    title: `Title of ${id}`,
    updatedAt: FIXTURE.updatedAt,
    ...content,
  };
}

async function seedFacts(bookCharacterId: string, facts: SeedFact[]): Promise<void> {
  await prisma.characterFact.createMany({
    data: facts.map((fact) => ({ ...fact, bookCharacterId })),
  });
}

async function seedScenario(): Promise<MergeScenario> {
  const { accessToken } = await context.registerVerifyAndLogin();
  const sharedBook = await createBook(accessToken, "Dune");
  const onlyLoserBook = await createBook(accessToken, "Dune Messiah");
  const survivor = await createCharacter(accessToken, "Survivor");
  const loser = await createCharacter(accessToken, "Loser");
  await linkToBook(accessToken, sharedBook, survivor);
  await linkToBook(accessToken, sharedBook, loser);
  await linkToBook(accessToken, onlyLoserBook, loser);
  return {
    loser,
    loserOnlyAppearance: await appearanceIdOf(onlyLoserBook, loser),
    loserSharedAppearance: await appearanceIdOf(sharedBook, loser),
    onlyLoserBook,
    sharedBook,
    survivor,
    survivorSharedAppearance: await appearanceIdOf(sharedBook, survivor),
    token: accessToken,
  };
}

async function seedScenarioWithFacts(): Promise<MergeScenario> {
  const scenario = await seedScenario();
  await seedFacts(scenario.survivorSharedAppearance, [
    seedFact(FIXTURE.factIds.survivorSharedDuplicate, FIXTURE.duplicate),
    seedFact(FIXTURE.factIds.survivorSharedUnique, { chapter: "Book One", page: 12 }),
  ]);
  await seedFacts(scenario.loserSharedAppearance, [
    seedFact(FIXTURE.factIds.loserSharedDuplicate, FIXTURE.duplicate),
    seedFact(FIXTURE.factIds.loserSharedSecondDuplicate, FIXTURE.duplicate),
    seedFact(FIXTURE.factIds.loserSharedUnique, { chapter: "Appendix", page: 300 }),
  ]);
  await seedFacts(scenario.loserOnlyAppearance, [
    seedFact(FIXTURE.factIds.loserOnly, { chapter: "Part Two", page: 77 }),
  ]);
  return scenario;
}

async function settle(test: request.Test): Promise<request.Response> {
  const response = await test;
  return response;
}

async function waitForMergeLocks(expected: { granted: boolean; total: number }): Promise<void> {
  await vi.waitFor(
    async () => {
      expect(await countMergeLocks({ granted: expected.granted })).toBe(expected.total);
    },
    { interval: FIXTURE.pollIntervalMs, timeout: FIXTURE.lockWaitTimeoutMs },
  );
}

function withAppearance(
  rows: CharacterFactModel[],
  { factIds, to }: { factIds: string[]; to: string },
): CharacterFactModel[] {
  return rows.map((row) => (factIds.includes(row.id) ? { ...row, bookCharacterId: to } : row));
}

const loserSharedFactIds = [
  FIXTURE.factIds.loserSharedDuplicate,
  FIXTURE.factIds.loserSharedSecondDuplicate,
  FIXTURE.factIds.loserSharedUnique,
];

describe("merge with facts on a non-overlapping appearance", () => {
  it("re-points the loser appearance and keeps every column of its facts byte for byte", async () => {
    const scenario = await seedScenario();
    await seedFacts(scenario.loserOnlyAppearance, [
      seedFact(FIXTURE.factIds.loserOnly, { chapter: "Part Two", page: 77 }),
      seedFact(FIXTURE.factIds.loserOnlySecond),
    ]);
    const before = await allFacts();

    const merged = await mergeRequest(scenario);

    expect(merged.status).toBe(HttpStatus.OK);
    expect(before).toEqual([
      {
        bookCharacterId: scenario.loserOnlyAppearance,
        chapter: "Part Two",
        createdAt: FIXTURE.createdAt,
        id: FIXTURE.factIds.loserOnly,
        page: 77,
        text: `Text of ${FIXTURE.factIds.loserOnly}`,
        title: `Title of ${FIXTURE.factIds.loserOnly}`,
        updatedAt: FIXTURE.updatedAt,
      },
      {
        bookCharacterId: scenario.loserOnlyAppearance,
        chapter: null,
        createdAt: FIXTURE.createdAt,
        id: FIXTURE.factIds.loserOnlySecond,
        page: null,
        text: `Text of ${FIXTURE.factIds.loserOnlySecond}`,
        title: `Title of ${FIXTURE.factIds.loserOnlySecond}`,
        updatedAt: FIXTURE.updatedAt,
      },
    ]);
    expect(await allFacts()).toEqual(before);
    expect(
      await prisma.bookCharacter.findUniqueOrThrow({
        select: { characterId: true },
        where: { id: scenario.loserOnlyAppearance },
      }),
    ).toEqual({ characterId: scenario.survivor });
  });
});

describe("merge with facts on an overlapping appearance", () => {
  it("moves every loser fact of the shared book onto the survivor appearance with identical content and timestamps", async () => {
    const scenario = await seedScenarioWithFacts();
    const before = await allFacts();

    const merged = await mergeRequest(scenario);

    expect(merged.status).toBe(HttpStatus.OK);
    expect(await allFacts()).toEqual(
      withAppearance(before, {
        factIds: loserSharedFactIds,
        to: scenario.survivorSharedAppearance,
      }),
    );
    expect(
      await prisma.bookCharacter.count({ where: { id: scenario.loserSharedAppearance } }),
    ).toBe(0);
  });

  it("leaves the survivor's own facts in the shared book untouched", async () => {
    const scenario = await seedScenarioWithFacts();
    const survivorIds: string[] = [
      FIXTURE.factIds.survivorSharedDuplicate,
      FIXTURE.factIds.survivorSharedUnique,
    ];
    const survivorBefore = (await allFacts()).filter((row) => survivorIds.includes(row.id));

    await mergeRequest(scenario).expect(HttpStatus.OK);

    expect((await allFacts()).filter((row) => survivorIds.includes(row.id))).toEqual(
      survivorBefore,
    );
  });

  it("retains facts whose title and text duplicate the survivor's instead of collapsing them", async () => {
    const scenario = await seedScenarioWithFacts();
    const before = await allFacts();

    await mergeRequest(scenario).expect(HttpStatus.OK);

    const duplicates = await prisma.characterFact.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      where: { bookCharacterId: scenario.survivorSharedAppearance, ...FIXTURE.duplicate },
    });
    expect(duplicates).toEqual([
      { id: FIXTURE.factIds.loserSharedDuplicate },
      { id: FIXTURE.factIds.loserSharedSecondDuplicate },
      { id: FIXTURE.factIds.survivorSharedDuplicate },
    ]);
    expect(before).toHaveLength(6);
    expect(await prisma.characterFact.count()).toBe(6);
  });
});

describe("merge fact counts", () => {
  it("reports four moved and zero dropped facts in both preview and result, matching the rows that changed owner", async () => {
    const scenario = await seedScenarioWithFacts();
    const survivorFactsBefore = await prisma.characterFact.count({
      where: { bookCharacter: { characterId: scenario.survivor } },
    });

    const preview = await authed(
      "get",
      `/api/characters/${scenario.survivor}/merge-preview?otherId=${scenario.loser}`,
      scenario.token,
    );
    const merged = await mergeRequest(scenario);

    expect(preview.status).toBe(HttpStatus.OK);
    expect(preview.body.counts.facts).toEqual({ dropped: 0, moved: 4 });
    expect(merged.status).toBe(HttpStatus.OK);
    expect(merged.body.counts.facts).toEqual({ dropped: 0, moved: 4 });
    const survivorFactsAfter = await prisma.characterFact.count({
      where: { bookCharacter: { characterId: scenario.survivor } },
    });
    expect({ after: survivorFactsAfter, before: survivorFactsBefore }).toEqual({
      after: 6,
      before: 2,
    });
    expect(await prisma.characterFact.count()).toBe(6);
  });
});

describe("merge rollback", () => {
  it("returns every fact to its original appearance when the merge fails right after re-parenting", async () => {
    const scenario = await seedScenarioWithFacts();
    const before = await allFacts();
    const observedInsideTransaction: number[] = [];
    vi.spyOn(mergeRepository, "deleteBookCharacters").mockImplementationOnce(async (...args) => {
      const client = args[1] ?? prisma;
      observedInsideTransaction.push(
        await client.characterFact.count({
          where: { bookCharacterId: scenario.survivorSharedAppearance },
        }),
      );
      throw new Error("induced failure after fact re-parenting");
    });

    const merged = await mergeRequest(scenario);

    expect(merged.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(observedInsideTransaction).toEqual([5]);
    expect(await allFacts()).toEqual(before);
    expect(await prisma.character.count({ where: { id: scenario.loser } })).toBe(1);
  });

  it("returns every fact to its original appearance when deleting the loser fails at the very end", async () => {
    const scenario = await seedScenarioWithFacts();
    const before = await allFacts();
    vi.spyOn(mergeRepository, "hardDeleteCharacter").mockRejectedValueOnce(
      new Error("induced failure on loser delete"),
    );

    const merged = await mergeRequest(scenario);

    expect(merged.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(await allFacts()).toEqual(before);
    expect(await prisma.character.count({ where: { id: scenario.loser } })).toBe(1);
    expect(
      await prisma.bookCharacter.findMany({
        orderBy: { id: "asc" },
        select: { id: true },
        where: { characterId: scenario.loser },
      }),
    ).toEqual(
      [scenario.loserOnlyAppearance, scenario.loserSharedAppearance]
        .sort((left, right) => left.localeCompare(right))
        .map((id) => ({ id })),
    );
  });
});

describe("merge and fact writer interleaving", () => {
  it("lets a writer that already holds the guard finish, then moves its new fact onto the survivor", async () => {
    const scenario = await seedScenario();
    const gate = createGate();
    const originalCreateFact = factsRepository.createFact.bind(factsRepository);
    vi.spyOn(factsRepository, "createFact").mockImplementationOnce(async (...args) => {
      gate.markEntered();
      await gate.released;
      return originalCreateFact(...args);
    });
    const content = { text: "Written while the merge waits", title: "Racing fact" };

    const createPending = settle(
      authed("post", factsPath(scenario.sharedBook, scenario.loser), scenario.token).send(content),
    );
    await gate.entered;
    await waitForMergeLocks({ granted: true, total: 1 });
    const mergePending = settle(mergeRequest(scenario));
    await waitForMergeLocks({ granted: false, total: 1 });
    gate.release();
    const [created, merged] = await Promise.all([createPending, mergePending]);

    expect(created.status).toBe(HttpStatus.CREATED);
    expect(merged.status).toBe(HttpStatus.OK);
    expect(merged.body.counts.facts).toEqual({ dropped: 0, moved: 1 });
    expect(await allFacts()).toEqual([
      {
        bookCharacterId: scenario.survivorSharedAppearance,
        chapter: null,
        createdAt: parseISO(created.body.createdAt),
        id: created.body.id,
        page: null,
        text: content.text,
        title: content.title,
        updatedAt: parseISO(created.body.updatedAt),
      },
    ]);
  });

  it("answers 404 to writers that queue behind a running merge and loses no fact", async () => {
    const scenario = await seedScenarioWithFacts();
    const before = await allFacts();
    const gate = createGate();
    const originalReparentFacts = mergeRepository.reparentFacts.bind(mergeRepository);
    vi.spyOn(mergeRepository, "reparentFacts").mockImplementationOnce(async (...args) => {
      gate.markEntered();
      await gate.released;
      return originalReparentFacts(...args);
    });

    const mergePending = settle(mergeRequest(scenario));
    await gate.entered;
    const createPending = settle(
      authed("post", factsPath(scenario.sharedBook, scenario.loser), scenario.token).send({
        text: "Arrives during the merge",
        title: "Intruder",
      }),
    );
    const updatePending = settle(
      authed(
        "patch",
        `${factsPath(scenario.sharedBook, scenario.loser)}/${FIXTURE.factIds.loserSharedUnique}`,
        scenario.token,
      ).send({ title: "Hijacked" }),
    );
    await waitForMergeLocks({ granted: false, total: 2 });
    gate.release();
    const [merged, created, updated] = await Promise.all([
      mergePending,
      createPending,
      updatePending,
    ]);

    expect(merged.status).toBe(HttpStatus.OK);
    expect({ body: created.body, status: created.status }).toMatchObject({
      body: { code: FIXTURE.characterNotFound },
      status: HttpStatus.NOT_FOUND,
    });
    expect({ body: updated.body, status: updated.status }).toMatchObject({
      body: { code: FIXTURE.characterNotFound },
      status: HttpStatus.NOT_FOUND,
    });
    expect(await allFacts()).toEqual(
      withAppearance(before, {
        factIds: loserSharedFactIds,
        to: scenario.survivorSharedAppearance,
      }),
    );
    expect(
      await prisma.characterFact.count({
        where: { bookCharacter: { characterId: scenario.survivor } },
      }),
    ).toBe(before.length);
  });
});
