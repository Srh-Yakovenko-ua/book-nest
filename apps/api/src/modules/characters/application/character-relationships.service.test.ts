import type { CreateCharacterRelationship } from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RelationshipDetailsRow } from "../infrastructure/character-relationships.repository.js";
import type { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterRelationshipsService } from "./character-relationships.service.js";
import { RelationshipContextService } from "./relationship-context.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Config = {
  ancestryEdges?: { sourceCharacterId: string; targetCharacterId: string; type: string }[];
  duplicates?: { customType: null | string; id: string }[];
  ownedCharacters?: number;
};

function baseInput(
  overrides: Partial<CreateCharacterRelationship> = {},
): CreateCharacterRelationship {
  return {
    allowFamilyCycle: false,
    category: "social",
    customType: undefined,
    directionality: "symmetric",
    initialBookStates: [],
    isCanonical: false,
    sourceCharacterId: ALICE,
    sourceLabel: undefined,
    targetCharacterId: BOB,
    targetLabel: undefined,
    type: "friend_of",
    ...overrides,
  };
}

function createService(config: Config = {}): {
  createBookStates: ReturnType<typeof vi.fn>;
  createRelationship: ReturnType<typeof vi.fn>;
  service: CharacterRelationshipsService;
  updateRelationship: ReturnType<typeof vi.fn>;
} {
  const acquireRelationshipLock = vi.fn().mockResolvedValue(undefined);
  const countOwnedCharacters = vi.fn().mockResolvedValue(config.ownedCharacters ?? 2);
  const findDuplicateCandidates = vi.fn().mockResolvedValue(config.duplicates ?? []);
  const findFamilyAncestryEdges = vi.fn().mockResolvedValue(config.ancestryEdges ?? []);
  const createRelationship = vi.fn().mockResolvedValue({ id: REL_ID });
  const createBookStates = vi.fn().mockResolvedValue(undefined);
  const updateRelationship = vi.fn().mockResolvedValue({ id: REL_ID });
  const findOwnedRelationshipBare = vi
    .fn()
    .mockResolvedValue({ category: "social", customType: null, id: REL_ID, type: "friend_of" });

  const relationshipsRepository = {
    acquireRelationshipLock,
    countOwnedCharacters,
    createBookStates,
    createRelationship,
    findDuplicateCandidates,
    findFamilyAncestryEdges,
    findOwnedRelationshipBare,
    updateRelationship,
  } as unknown as CharacterRelationshipsRepository;
  const accessAsserter = {
    assertBookOwned: vi.fn().mockResolvedValue(undefined),
  } as unknown as CharacterAccessAsserter;
  const contextService = {
    loadDetails: vi.fn().mockResolvedValue(makeDetailsRow()),
  } as unknown as RelationshipContextService;
  const transactionRunner = {
    run: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as TransactionRunner;

  const service = new CharacterRelationshipsService(
    relationshipsRepository,
    accessAsserter,
    contextService,
    transactionRunner,
  );
  return { createBookStates, createRelationship, service, updateRelationship };
}

function makeDetailsRow(overrides: Partial<RelationshipDetailsRow> = {}): RelationshipDetailsRow {
  return {
    bookStates: [],
    category: "social",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    customType: null,
    directionality: "symmetric",
    id: REL_ID,
    isCanonical: false,
    sourceCharacter: { name: "Alice" },
    sourceCharacterId: ALICE,
    sourceLabel: null,
    targetCharacter: { name: "Bob" },
    targetCharacterId: BOB,
    targetLabel: null,
    type: "friend_of",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as RelationshipDetailsRow;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CharacterRelationshipsService create validation", () => {
  it("rejects a self relationship before any write", async () => {
    const { createRelationship, service } = createService();

    await expect(
      service.create({ input: baseInput({ targetCharacterId: ALICE }), userId: USER_ID }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.selfReference });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("rejects a directionality that mismatches the catalog", async () => {
    const { createRelationship, service } = createService();

    await expect(
      service.create({
        input: baseInput({ directionality: "directed", type: "friend_of" }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.directionMismatch });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("rejects a duplicate non-custom edge", async () => {
    const { createRelationship, service } = createService({
      duplicates: [{ customType: null, id: "existing" }],
    });

    await expect(service.create({ input: baseInput(), userId: USER_ID })).rejects.toMatchObject({
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.duplicate,
    });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("rejects when an endpoint character is not owned", async () => {
    const { createRelationship, service } = createService({ ownedCharacters: 1 });

    await expect(service.create({ input: baseInput(), userId: USER_ID })).rejects.toMatchObject({
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
    });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("stores a symmetric edge in canonical endpoint order", async () => {
    const { createRelationship, service } = createService();

    await service.create({
      input: baseInput({ sourceCharacterId: BOB, targetCharacterId: ALICE }),
      userId: USER_ID,
    });

    expect(createRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCharacterId: ALICE, targetCharacterId: BOB }),
      expect.anything(),
    );
  });
});

describe("CharacterRelationshipsService family diagnostics", () => {
  const parentInput = baseInput({
    category: "family",
    directionality: "directed",
    type: "biological_parent_of",
  });

  it("hard-blocks a direct parent contradiction", async () => {
    const { createRelationship, service } = createService({
      ancestryEdges: [
        { sourceCharacterId: BOB, targetCharacterId: ALICE, type: "biological_parent_of" },
      ],
    });

    await expect(service.create({ input: parentInput, userId: USER_ID })).rejects.toMatchObject({
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
    });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("blocks a deeper cycle without override", async () => {
    const { createRelationship, service } = createService({
      ancestryEdges: [
        { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "biological_parent_of" },
        { sourceCharacterId: BOB, targetCharacterId: CAROL, type: "biological_parent_of" },
      ],
    });

    await expect(
      service.create({
        input: baseInput({
          category: "family",
          directionality: "directed",
          sourceCharacterId: CAROL,
          targetCharacterId: ALICE,
          type: "biological_parent_of",
        }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("allows a deeper cycle with an explicit override and returns a warning", async () => {
    const { createRelationship, service } = createService({
      ancestryEdges: [
        { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "biological_parent_of" },
        { sourceCharacterId: BOB, targetCharacterId: CAROL, type: "biological_parent_of" },
      ],
    });

    const result = await service.create({
      input: baseInput({
        allowFamilyCycle: true,
        category: "family",
        directionality: "directed",
        sourceCharacterId: CAROL,
        targetCharacterId: ALICE,
        type: "biological_parent_of",
      }),
      userId: USER_ID,
    });

    expect(createRelationship).toHaveBeenCalled();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ severity: "warning" });
  });
});

describe("CharacterRelationshipsService update", () => {
  it("updates the semantic edge without deleting book states", async () => {
    const { createBookStates, service, updateRelationship } = createService();

    await service.update({
      input: {
        allowFamilyCycle: false,
        category: "conflict",
        sourceLabel: undefined,
        targetLabel: undefined,
        type: "enemy_of",
      },
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(updateRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: "conflict", type: "enemy_of" }),
      }),
      expect.anything(),
    );
    expect(createBookStates).not.toHaveBeenCalled();
  });
});
