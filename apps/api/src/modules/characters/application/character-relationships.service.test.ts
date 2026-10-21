import type {
  CreateCharacterRelationship,
  InitialRelationshipBookState,
  UpdateCharacterRelationship,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  InitialRelationshipBookStateSchema,
} from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RelationshipDetailsRow } from "../infrastructure/character-relationships.repository.js";
import type { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import type { RelationshipCustomTypesRepository } from "../infrastructure/relationship-custom-types.repository.js";
import type { RelationshipRoleSuggestionsRepository } from "../infrastructure/relationship-role-suggestions.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterRelationshipsService } from "./character-relationships.service.js";
import { RelationshipContextService } from "./relationship-context.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BOOK_1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const BOOK_2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TX = { transaction: "stub" };

type BookLink = { bookId: string; characterId: string };

type Config = {
  ancestryEdges?: { sourceCharacterId: string; targetCharacterId: string; type: string }[];
  bookLinks?: BookLink[];
  duplicates?: { customType: null | string; id: string }[];
  existing?: ExistingEdge;
  ownedCharacters?: number;
};

type ExistingEdge = {
  category: string;
  customType: null | string;
  directionality: string;
  id: string;
  sourceCharacterId: string;
  sourceLabel: null | string;
  targetCharacterId: string;
  targetLabel: null | string;
  type: string;
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

function bookState(bookId: string): InitialRelationshipBookState {
  return InitialRelationshipBookStateSchema.parse({ bookId });
}

function createService(config: Config = {}): {
  assertCharactersLinkedToBooks: ReturnType<typeof vi.fn>;
  createBookStates: ReturnType<typeof vi.fn>;
  createRelationship: ReturnType<typeof vi.fn>;
  service: CharacterRelationshipsService;
  updateRelationship: ReturnType<typeof vi.fn>;
  upsertRoleSuggestionUsage: ReturnType<typeof vi.fn>;
  upsertUsage: ReturnType<typeof vi.fn>;
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
    .mockResolvedValue(
      config.existing ?? { category: "social", customType: null, id: REL_ID, type: "friend_of" },
    );
  const assertCharactersLinkedToBooks = vi
    .fn()
    .mockImplementation(
      ({
        bookIds,
        characterIds,
        invalidCode,
      }: {
        bookIds: string[];
        characterIds: string[];
        invalidCode: string;
      }) =>
        hasEveryBookLink({ bookIds, characterIds, links: config.bookLinks })
          ? Promise.resolve()
          : Promise.reject(
              new BadRequestError("Every character must appear in the selected book", {
                code: invalidCode,
              }),
            ),
    );
  const upsertUsage = vi.fn().mockResolvedValue(undefined);
  const upsertRoleSuggestionUsage = vi.fn().mockResolvedValue(undefined);

  const relationshipsRepository = {
    acquireRelationshipLock,
    createBookStates,
    createRelationship,
    findDuplicateCandidates,
    findFamilyAncestryEdges,
    findOwnedRelationshipBare,
    updateRelationship,
  } as unknown as CharacterRelationshipsRepository;
  const accessAsserter = {
    assertBookOwned: vi.fn().mockResolvedValue(undefined),
    assertCharactersLinkedToBooks,
    assertCharactersOwned: async ({ characterIds }: { characterIds: string[] }) => {
      const owned = await countOwnedCharacters();
      if (owned !== new Set(characterIds).size) {
        throw new NotFoundError("Character not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
        });
      }
    },
  } as unknown as CharacterAccessAsserter;
  const contextService = {
    loadDetails: vi.fn().mockResolvedValue(makeDetailsRow()),
  } as unknown as RelationshipContextService;
  const transactionRunner = {
    run: (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
  } as unknown as TransactionRunner;
  const customTypesRepository = {
    upsertUsage,
  } as unknown as RelationshipCustomTypesRepository;
  const roleSuggestionsRepository = {
    upsertUsage: upsertRoleSuggestionUsage,
  } as unknown as RelationshipRoleSuggestionsRepository;

  const service = new CharacterRelationshipsService(
    relationshipsRepository,
    accessAsserter,
    contextService,
    transactionRunner,
    customTypesRepository,
    roleSuggestionsRepository,
  );
  return {
    assertCharactersLinkedToBooks,
    createBookStates,
    createRelationship,
    service,
    updateRelationship,
    upsertRoleSuggestionUsage,
    upsertUsage,
  };
}

function customEdge(overrides: Partial<ExistingEdge> = {}): ExistingEdge {
  return {
    category: "custom",
    customType: "Побратими",
    directionality: "directed",
    id: REL_ID,
    sourceCharacterId: ALICE,
    sourceLabel: null,
    targetCharacterId: BOB,
    targetLabel: null,
    type: "custom",
    ...overrides,
  };
}

function hasEveryBookLink({
  bookIds,
  characterIds,
  links,
}: {
  bookIds: string[];
  characterIds: string[];
  links: BookLink[] | undefined;
}): boolean {
  if (links === undefined) {
    return true;
  }
  const linked = new Set(links.map((link) => `${link.bookId}:${link.characterId}`));
  return bookIds.every((bookId) =>
    characterIds.every((characterId) => linked.has(`${bookId}:${characterId}`)),
  );
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

function patchInput(overrides: Partial<UpdateCharacterRelationship>): UpdateCharacterRelationship {
  return { allowFamilyCycle: false, ...overrides };
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
      details: { severity: "conflict" },
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
    ).rejects.toMatchObject({
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      details: { severity: "warning" },
    });
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

describe("CharacterRelationshipsService create book membership", () => {
  it("R56 rejects with bookContextInvalid and writes nothing when one endpoint is missing from the state's book", async () => {
    const { createBookStates, createRelationship, service, upsertUsage } = createService({
      bookLinks: [{ bookId: BOOK_1, characterId: ALICE }],
    });

    await expect(
      service.create({
        input: baseInput({
          category: "custom",
          customType: "Побратими",
          initialBookStates: [bookState(BOOK_1)],
          type: "custom",
        }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid });
    expect(createRelationship).not.toHaveBeenCalled();
    expect(createBookStates).not.toHaveBeenCalled();
    expect(upsertUsage).not.toHaveBeenCalled();
  });

  it("R56 checks every initial state's book, not only the first", async () => {
    const { createRelationship, service } = createService({
      bookLinks: [
        { bookId: BOOK_1, characterId: ALICE },
        { bookId: BOOK_1, characterId: BOB },
        { bookId: BOOK_2, characterId: ALICE },
      ],
    });

    await expect(
      service.create({
        input: baseInput({ initialBookStates: [bookState(BOOK_1), bookState(BOOK_2)] }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid });
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("checks ownership before membership, so a foreign endpoint stays a not-found", async () => {
    const { service } = createService({ bookLinks: [], ownedCharacters: 1 });

    await expect(
      service.create({
        input: baseInput({ initialBookStates: [bookState(BOOK_1)] }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound });
  });

  it("checks both stored endpoints inside the create transaction", async () => {
    const { assertCharactersLinkedToBooks, service } = createService({
      bookLinks: [
        { bookId: BOOK_1, characterId: ALICE },
        { bookId: BOOK_1, characterId: BOB },
      ],
    });

    await service.create({
      input: baseInput({
        initialBookStates: [bookState(BOOK_1)],
        sourceCharacterId: BOB,
        targetCharacterId: ALICE,
      }),
      userId: USER_ID,
    });

    expect(assertCharactersLinkedToBooks).toHaveBeenCalledWith(
      expect.objectContaining({
        bookIds: [BOOK_1],
        characterIds: expect.arrayContaining([ALICE, BOB]),
        invalidCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      }),
      TX,
    );
  });

  it("keeps an empty initialBookStates valid without any book link", async () => {
    const { createRelationship, service } = createService({ bookLinks: [] });

    await service.create({ input: baseInput({ initialBookStates: [] }), userId: USER_ID });

    expect(createRelationship).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterRelationshipsService custom type dictionary on create", () => {
  it("T01 upserts the custom name once with its normalized key and directionality in the create transaction", async () => {
    const { service, upsertUsage } = createService();

    await service.create({
      input: baseInput({
        category: "custom",
        customType: "Старі Друзі",
        directionality: "directed",
        type: "custom",
      }),
      userId: USER_ID,
    });

    expect(upsertUsage).toHaveBeenCalledTimes(1);
    expect(upsertUsage).toHaveBeenCalledWith(
      {
        directionality: "directed",
        name: "Старі Друзі",
        normalizedName: "старі друзі",
        usedAt: expect.any(Date),
        userId: USER_ID,
      },
      TX,
    );
  });

  it("T08 folds case and inner whitespace into one normalized key", async () => {
    const { service, upsertUsage } = createService();

    await service.create({
      input: baseInput({
        category: "custom",
        customType: "  Старі   ДРУЗІ  ",
        directionality: "symmetric",
        type: "custom",
      }),
      userId: USER_ID,
    });

    expect(upsertUsage).toHaveBeenCalledWith(
      expect.objectContaining({ directionality: "symmetric", normalizedName: "старі друзі" }),
      TX,
    );
  });

  it("T02 leaves the dictionary alone for a standard type", async () => {
    const { service, upsertUsage } = createService();

    await service.create({ input: baseInput(), userId: USER_ID });

    expect(upsertUsage).not.toHaveBeenCalled();
  });

  it("T10 writes no dictionary entry when the custom edge is a duplicate", async () => {
    const { service, upsertUsage } = createService({
      duplicates: [{ customType: "побратими", id: "existing" }],
    });

    await expect(
      service.create({
        input: baseInput({ category: "custom", customType: "Побратими", type: "custom" }),
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.duplicate });
    expect(upsertUsage).not.toHaveBeenCalled();
  });
});

describe("CharacterRelationshipsService custom type dictionary on patch", () => {
  it("records the name with the edge's fixed directionality when a standard edge switches to custom", async () => {
    const { service, upsertUsage } = createService({
      existing: customEdge({
        category: "social",
        customType: null,
        directionality: "symmetric",
        type: "friend_of",
      }),
    });

    await service.update({
      input: patchInput({ category: "custom", customType: "Побратими", type: "custom" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        directionality: "symmetric",
        normalizedName: "побратими",
        userId: USER_ID,
      }),
      TX,
    );
  });

  it("records the new name when a custom edge is renamed", async () => {
    const { service, upsertUsage } = createService({ existing: customEdge() });

    await service.update({
      input: patchInput({ customType: "Названі брати" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertUsage).toHaveBeenCalledWith(
      expect.objectContaining({ directionality: "directed", normalizedName: "названі брати" }),
      TX,
    );
  });

  it("leaves the dictionary alone when the same custom name is sent again", async () => {
    const { service, upsertUsage } = createService({ existing: customEdge() });

    await service.update({
      input: patchInput({ customType: "Побратими" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertUsage).not.toHaveBeenCalled();
  });

  it("leaves the dictionary alone on an unrelated patch of a custom edge", async () => {
    const { service, upsertUsage } = createService({ existing: customEdge() });

    await service.update({
      input: patchInput({ isCanonical: true }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertUsage).not.toHaveBeenCalled();
  });

  it("leaves the dictionary alone when a custom edge switches to a standard type", async () => {
    const { service, upsertUsage } = createService({
      existing: customEdge({ directionality: "symmetric" }),
    });

    await service.update({
      input: patchInput({ category: "social", type: "friend_of" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertUsage).not.toHaveBeenCalled();
  });
});

describe("CharacterRelationshipsService role suggestions", () => {
  it("E02 upserts each newly sent role in the patch transaction, ordered by normalized key", async () => {
    const { service, upsertRoleSuggestionUsage } = createService({ existing: customEdge() });

    await service.update({
      input: patchInput({ sourceLabel: "Young  Apprentice", targetLabel: "Mentor" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertRoleSuggestionUsage).toHaveBeenCalledTimes(2);
    expect(upsertRoleSuggestionUsage).toHaveBeenNthCalledWith(
      1,
      { label: "Mentor", normalizedLabel: "mentor", usedAt: expect.any(Date), userId: USER_ID },
      TX,
    );
    expect(upsertRoleSuggestionUsage).toHaveBeenNthCalledWith(
      2,
      {
        label: "Young Apprentice",
        normalizedLabel: "young apprentice",
        usedAt: expect.any(Date),
        userId: USER_ID,
      },
      TX,
    );
  });

  it("E02 upserts only the side whose role changed", async () => {
    const { service, upsertRoleSuggestionUsage } = createService({
      existing: customEdge({ sourceLabel: "Mentor", targetLabel: "Pupil" }),
    });

    await service.update({
      input: patchInput({ sourceLabel: "Mentor", targetLabel: "Squire" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertRoleSuggestionUsage).toHaveBeenCalledTimes(1);
    expect(upsertRoleSuggestionUsage).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Squire", normalizedLabel: "squire" }),
      TX,
    );
  });

  it("E03 upserts nothing when a patch clears both roles", async () => {
    const { service, upsertRoleSuggestionUsage } = createService({
      existing: customEdge({ sourceLabel: "Mentor", targetLabel: "Pupil" }),
    });

    await service.update({
      input: patchInput({ sourceLabel: null, targetLabel: "" }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertRoleSuggestionUsage).not.toHaveBeenCalled();
  });

  it("upserts nothing on an unrelated patch of an edge that has roles", async () => {
    const { service, upsertRoleSuggestionUsage } = createService({
      existing: customEdge({ sourceLabel: "Mentor", targetLabel: "Pupil" }),
    });

    await service.update({
      input: patchInput({ isCanonical: true }),
      relationshipId: REL_ID,
      userId: USER_ID,
    });

    expect(upsertRoleSuggestionUsage).not.toHaveBeenCalled();
  });

  it("E09 upserts no role when the patch is rejected as a duplicate", async () => {
    const { service, upsertRoleSuggestionUsage } = createService({
      duplicates: [{ customType: "sworn kin", id: "other-edge" }],
      existing: customEdge(),
    });

    await expect(
      service.update({
        input: patchInput({ customType: "Sworn kin", sourceLabel: "Mentor" }),
        relationshipId: REL_ID,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: CHARACTER_RELATIONSHIP_ERROR_CODES.duplicate });
    expect(upsertRoleSuggestionUsage).not.toHaveBeenCalled();
  });

  it("writes no role suggestion when a relationship is created with roles", async () => {
    const { service, upsertRoleSuggestionUsage } = createService();

    await service.create({
      input: baseInput({ sourceLabel: "Mentor", targetLabel: "Pupil" }),
      userId: USER_ID,
    });

    expect(upsertRoleSuggestionUsage).not.toHaveBeenCalled();
  });
});
