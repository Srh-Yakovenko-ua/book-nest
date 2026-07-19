import { CHARACTER_MERGE_ERROR_CODES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { MediaService } from "../../media/index.js";
import type { CharacterGroupsRepository } from "../infrastructure/character-groups.repository.js";
import type { CharacterMergeRepository } from "../infrastructure/character-merge.repository.js";
import type { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import type { CharactersRepository } from "../infrastructure/characters.repository.js";

import { ConflictError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { CharacterMergeService } from "./character-merge.service.js";

const USER = "11111111-1111-1111-1111-111111111111";
const SURVIVOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOSER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type PartyOverrides = { loser?: unknown; survivor?: unknown };

function createService(
  parties: PartyOverrides = { loser: party(LOSER, "media-loser"), survivor: party(SURVIVOR, null) },
  options: { repointError?: unknown } = {},
): {
  acquireMembershipLock: ReturnType<typeof vi.fn>;
  acquireMergeLock: ReturnType<typeof vi.fn>;
  acquireRelationshipLock: ReturnType<typeof vi.fn>;
  deleteIfUnreferenced: ReturnType<typeof vi.fn>;
  hardDeleteCharacter: ReturnType<typeof vi.fn>;
  service: CharacterMergeService;
} {
  const findOwnedCharacterBare = vi.fn(({ characterId }: { characterId: string }) =>
    Promise.resolve(characterId === SURVIVOR ? parties.survivor : parties.loser),
  );
  const charactersRepository = { findOwnedCharacterBare } as unknown as CharactersRepository;

  const acquireMergeLock = vi.fn().mockResolvedValue(undefined);
  const hardDeleteCharacter = vi.fn().mockResolvedValue(1);
  const mergeRepository = {
    acquireMergeLock,
    countHiddenLoserRecords: vi.fn().mockResolvedValue(0),
    countLoserTheories: vi.fn().mockResolvedValue(0),
    deleteAliases: vi.fn().mockResolvedValue(undefined),
    deleteBookCharacters: vi.fn().mockResolvedValue(undefined),
    deleteMemberships: vi.fn().mockResolvedValue(undefined),
    deleteRelationships: vi.fn().mockResolvedValue(undefined),
    deleteTags: vi.fn().mockResolvedValue(undefined),
    findLoserAliases: vi.fn().mockResolvedValue([]),
    findLoserBookCharacters: vi.fn().mockResolvedValue([]),
    findLoserMemberships: vi.fn().mockResolvedValue([]),
    findLoserRelationships: vi.fn().mockResolvedValue([]),
    findLoserTagIds: vi.fn().mockResolvedValue([]),
    findSurvivorAliasKeys: vi.fn().mockResolvedValue([]),
    findSurvivorBookIds: vi.fn().mockResolvedValue([]),
    findSurvivorMembershipKeys: vi.fn().mockResolvedValue([]),
    findSurvivorRelationships: vi.fn().mockResolvedValue([]),
    findSurvivorTagIds: vi.fn().mockResolvedValue([]),
    hardDeleteCharacter,
    repointAliases: vi.fn().mockResolvedValue(undefined),
    repointBookCharacters: vi.fn(() =>
      options.repointError === undefined
        ? Promise.resolve(undefined)
        : Promise.reject(options.repointError),
    ),
    repointMemberships: vi.fn().mockResolvedValue(undefined),
    repointRelationship: vi.fn().mockResolvedValue(undefined),
    repointTags: vi.fn().mockResolvedValue(undefined),
    repointTheories: vi.fn().mockResolvedValue(0),
  } as unknown as CharacterMergeRepository;

  const acquireRelationshipLock = vi.fn().mockResolvedValue(undefined);
  const relationshipsRepository = {
    acquireRelationshipLock,
  } as unknown as CharacterRelationshipsRepository;

  const acquireMembershipLock = vi.fn().mockResolvedValue(undefined);
  const groupsRepository = { acquireMembershipLock } as unknown as CharacterGroupsRepository;

  const deleteIfUnreferenced = vi.fn().mockResolvedValue(undefined);
  const mediaService = { deleteIfUnreferenced } as unknown as MediaService;

  const transactionRunner = {
    run: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as TransactionRunner;

  const service = new CharacterMergeService(
    charactersRepository,
    mergeRepository,
    relationshipsRepository,
    groupsRepository,
    mediaService,
    transactionRunner,
  );
  return {
    acquireMembershipLock,
    acquireMergeLock,
    acquireRelationshipLock,
    deleteIfUnreferenced,
    hardDeleteCharacter,
    service,
  };
}

function party(id: string, avatarMediaId: null | string): unknown {
  return { avatarMediaId, id, name: id === SURVIVOR ? "Survivor" : "Loser" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CharacterMergeService.merge guards", () => {
  it("rejects merging a character into itself before any work", async () => {
    const { acquireMergeLock, service } = createService();
    await expect(
      service.merge({ characterId: SURVIVOR, otherId: SURVIVOR, userId: USER }),
    ).rejects.toMatchObject({ code: CHARACTER_MERGE_ERROR_CODES.sameCharacter });
    expect(acquireMergeLock).not.toHaveBeenCalled();
  });

  it("returns 404-style not found when the loser is missing", async () => {
    const { hardDeleteCharacter, service } = createService({
      loser: null,
      survivor: party(SURVIVOR, null),
    });
    await expect(
      service.merge({ characterId: SURVIVOR, otherId: LOSER, userId: USER }),
    ).rejects.toMatchObject({ code: CHARACTER_MERGE_ERROR_CODES.notFound });
    expect(hardDeleteCharacter).not.toHaveBeenCalled();
  });
});

describe("CharacterMergeService.merge orchestration", () => {
  it("takes the merge lock, deletes the loser, and cleans up its avatar media", async () => {
    const { acquireMergeLock, deleteIfUnreferenced, hardDeleteCharacter, service } =
      createService();

    const result = await service.merge({ characterId: SURVIVOR, otherId: LOSER, userId: USER });

    expect(acquireMergeLock).toHaveBeenCalledWith({ userId: USER }, expect.anything());
    expect(hardDeleteCharacter).toHaveBeenCalledWith(
      { characterId: LOSER, userId: USER },
      expect.anything(),
    );
    expect(deleteIfUnreferenced).toHaveBeenCalledWith({ id: "media-loser", userId: USER });
    expect(result.loserId).toBe(LOSER);
    expect(result.survivor).toEqual({ id: SURVIVOR, name: "Survivor" });
  });
});

describe("CharacterMergeService.merge concurrency", () => {
  it("maps a unique-constraint violation from the repoint path to a 409 conflict", async () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "7.0.0",
      code: "P2002",
    });
    const { hardDeleteCharacter, service } = createService(
      { loser: party(LOSER, "media-loser"), survivor: party(SURVIVOR, null) },
      { repointError: uniqueViolation },
    );

    await expect(
      service.merge({ characterId: SURVIVOR, otherId: LOSER, userId: USER }),
    ).rejects.toMatchObject({ code: CHARACTER_MERGE_ERROR_CODES.conflict });
    await expect(
      service.merge({ characterId: SURVIVOR, otherId: LOSER, userId: USER }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(hardDeleteCharacter).not.toHaveBeenCalled();
  });
});

describe("CharacterMergeService.preview", () => {
  it("reports hidden records without mutating anything", async () => {
    const { hardDeleteCharacter, service } = createService();
    const preview = await service.preview({
      characterId: SURVIVOR,
      otherId: LOSER,
      userId: USER,
    });
    expect(preview.survivor).toEqual({ id: SURVIVOR, name: "Survivor" });
    expect(preview.loser).toEqual({ id: LOSER, name: "Loser" });
    expect(preview.hasHiddenRecords).toBe(false);
    expect(hardDeleteCharacter).not.toHaveBeenCalled();
  });
});
