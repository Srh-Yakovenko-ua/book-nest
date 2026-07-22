import type { CharacterMergePreviewView, CharacterMergeResultView } from "@app/shared";

import { CHARACTER_MERGE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { CharacterModel } from "../../../generated/prisma/models.js";
import type {
  CharacterMergePlan,
  CharacterMergePlanInput,
  RelationshipCandidate,
} from "../domain/character-merge.js";
import type {
  LoserAliasRow,
  LoserBookCharacterRow,
  LoserFormRow,
  LoserMembershipRow,
  SurvivorAliasKey,
  SurvivorMembershipKey,
} from "../infrastructure/character-merge.repository.js";

import {
  HEAVY_TRANSACTION_OPTIONS,
  TransactionRunner,
} from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import {
  buildCharacterMergePlan,
  buildSurvivorRelationshipKeys,
  computeRelationshipCandidates,
  membershipMergeKey,
} from "../domain/character-merge.js";
import { CharacterGroupsRepository } from "../infrastructure/character-groups.repository.js";
import { CharacterMergeRepository } from "../infrastructure/character-merge.repository.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

const log = createLogger("characters.merge");

type LoserRows = {
  loserAliases: LoserAliasRow[];
  loserBookCharacters: LoserBookCharacterRow[];
  loserForms: LoserFormRow[];
  loserMemberships: LoserMembershipRow[];
  loserRelationshipCandidates: RelationshipCandidate[];
  loserRelationshipLockKeys: string[];
  loserTagIds: string[];
  loserTheoryCount: number;
};

type SurvivorKeys = {
  survivorAliasKeys: SurvivorAliasKey[];
  survivorBookIds: string[];
  survivorFormKeys: string[];
  survivorMembershipKeys: SurvivorMembershipKey[];
  survivorRelationshipKeys: Set<string>;
  survivorTagIds: string[];
};

@Injectable()
export class CharacterMergeService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly mergeRepository: CharacterMergeRepository,
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly groupsRepository: CharacterGroupsRepository,
    private readonly mediaService: MediaService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async merge({
    characterId,
    otherId,
    userId,
  }: {
    characterId: string;
    otherId: string;
    userId: string;
  }): Promise<CharacterMergeResultView> {
    this.assertDistinct({ characterId, otherId });

    const result = await this.runMergeTransaction({ characterId, otherId, userId });

    await this.cleanupDroppedMedia({ mediaIds: result.droppedMediaIds, userId });

    return { counts: result.counts, loserId: result.loserId, survivor: result.survivor };
  }

  async preview({
    characterId,
    otherId,
    userId,
  }: {
    characterId: string;
    otherId: string;
    userId: string;
  }): Promise<CharacterMergePreviewView> {
    this.assertDistinct({ characterId, otherId });
    const { loser, survivor } = await this.resolveParties({ characterId, otherId, userId });

    const loserRows = await this.loadLoserRows({
      loserId: loser.id,
      survivorId: survivor.id,
      userId,
    });
    const survivorKeys = await this.loadSurvivorKeys({
      loserId: loser.id,
      survivorId: survivor.id,
      userId,
    });
    const plan = buildCharacterMergePlan(this.toPlanInput({ loser, loserRows, survivorKeys }));
    const hiddenCount = await this.mergeRepository.countHiddenLoserRecords({
      characterId: loser.id,
      userId,
    });

    return {
      counts: plan.counts,
      hasHiddenRecords: hiddenCount > 0,
      loser: { id: loser.id, name: loser.name },
      survivor: { id: survivor.id, name: survivor.name },
    };
  }

  private async acquireWriterLocks({
    loserRows,
    survivorId,
    tx,
  }: {
    loserRows: LoserRows;
    survivorId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    for (const key of loserRows.loserRelationshipLockKeys) {
      await this.relationshipsRepository.acquireRelationshipLock({ key }, tx);
    }
    const seenMembershipLocks = new Set<string>();
    for (const membership of loserRows.loserMemberships) {
      const lockKey = membershipMergeKey(membership);
      if (seenMembershipLocks.has(lockKey)) {
        continue;
      }
      seenMembershipLocks.add(lockKey);
      await this.groupsRepository.acquireMembershipLock(
        { bookId: membership.bookId, characterId: survivorId, groupId: membership.groupId },
        tx,
      );
    }
  }

  private async applyPlan({
    loserId,
    plan,
    survivorId,
    tx,
    userId,
  }: {
    loserId: string;
    plan: CharacterMergePlan;
    survivorId: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    await this.mergeRepository.deleteBookCharacters({ ids: plan.dropBookCharacterIds }, tx);
    await this.mergeRepository.repointBookCharacters(
      { ids: plan.repointBookCharacterIds, survivorId },
      tx,
    );
    await this.mergeRepository.deleteAliases({ ids: plan.dropAliasIds }, tx);
    await this.mergeRepository.repointAliases({ ids: plan.repointAliasIds, survivorId }, tx);
    await this.mergeRepository.deleteTags({ loserId, tagIds: plan.dropTagIds }, tx);
    await this.mergeRepository.repointTags({ loserId, survivorId, tagIds: plan.repointTagIds }, tx);
    await this.mergeRepository.deleteMemberships({ ids: plan.dropMembershipIds }, tx);
    await this.mergeRepository.repointMemberships(
      { ids: plan.repointMembershipIds, survivorId },
      tx,
    );
    await this.mergeRepository.deleteRelationships({ ids: plan.dropRelationshipIds }, tx);
    for (const repoint of plan.relationshipRepoints) {
      await this.mergeRepository.repointRelationship(repoint, tx);
    }
    await this.mergeRepository.deleteForms({ ids: plan.dropFormIds }, tx);
    await this.mergeRepository.repointForms({ ids: plan.repointFormIds, survivorId }, tx);
    await this.mergeRepository.repointTheories({ loserId, survivorId, userId }, tx);
  }

  private assertDistinct({ characterId, otherId }: { characterId: string; otherId: string }): void {
    if (characterId === otherId) {
      throw new BadRequestError("A character cannot be merged into itself", {
        code: CHARACTER_MERGE_ERROR_CODES.sameCharacter,
      });
    }
  }

  private async cleanupDroppedMedia({
    mediaIds,
    userId,
  }: {
    mediaIds: string[];
    userId: string;
  }): Promise<void> {
    for (const mediaId of mediaIds) {
      try {
        await this.mediaService.deleteIfUnreferenced({ id: mediaId, userId });
      } catch (error) {
        log.warn({ err: error, mediaId }, "failed to clean up dropped character media after merge");
      }
    }
  }

  private async loadLoserRows({
    loserId,
    survivorId,
    tx,
    userId,
  }: {
    loserId: string;
    survivorId: string;
    tx?: Prisma.TransactionClient;
    userId: string;
  }): Promise<LoserRows> {
    const [
      loserBookCharacters,
      loserAliases,
      loserTagIds,
      loserMemberships,
      loserRelationships,
      loserTheoryCount,
      loserForms,
    ] = await Promise.all([
      this.mergeRepository.findLoserBookCharacters({ characterId: loserId }, tx),
      this.mergeRepository.findLoserAliases({ characterId: loserId }, tx),
      this.mergeRepository.findLoserTagIds({ characterId: loserId }, tx),
      this.mergeRepository.findLoserMemberships({ characterId: loserId }, tx),
      this.mergeRepository.findLoserRelationships({ characterId: loserId, userId }, tx),
      this.mergeRepository.countLoserTheories({ characterId: loserId, userId }, tx),
      this.mergeRepository.findLoserForms({ characterId: loserId }, tx),
    ]);
    const { candidates, lockKeys } = computeRelationshipCandidates({
      loserId,
      loserRows: loserRelationships,
      survivorId,
      userId,
    });
    return {
      loserAliases,
      loserBookCharacters,
      loserForms,
      loserMemberships,
      loserRelationshipCandidates: candidates,
      loserRelationshipLockKeys: lockKeys,
      loserTagIds,
      loserTheoryCount,
    };
  }

  private async loadSurvivorKeys({
    loserId,
    survivorId,
    tx,
    userId,
  }: {
    loserId: string;
    survivorId: string;
    tx?: Prisma.TransactionClient;
    userId: string;
  }): Promise<SurvivorKeys> {
    const [
      survivorBookIds,
      survivorAliasKeys,
      survivorTagIds,
      survivorMembershipKeys,
      survivorRelationships,
      survivorFormKeys,
    ] = await Promise.all([
      this.mergeRepository.findSurvivorBookIds({ characterId: survivorId }, tx),
      this.mergeRepository.findSurvivorAliasKeys({ characterId: survivorId }, tx),
      this.mergeRepository.findSurvivorTagIds({ characterId: survivorId }, tx),
      this.mergeRepository.findSurvivorMembershipKeys({ characterId: survivorId }, tx),
      this.mergeRepository.findSurvivorRelationships({ loserId, survivorId, userId }, tx),
      this.mergeRepository.findSurvivorFormKeys({ characterId: survivorId }, tx),
    ]);
    return {
      survivorAliasKeys,
      survivorBookIds,
      survivorFormKeys,
      survivorMembershipKeys,
      survivorRelationshipKeys: buildSurvivorRelationshipKeys({
        rows: survivorRelationships,
        userId,
      }),
      survivorTagIds,
    };
  }

  private async resolveParties({
    characterId,
    otherId,
    tx,
    userId,
  }: {
    characterId: string;
    otherId: string;
    tx?: Prisma.TransactionClient;
    userId: string;
  }): Promise<{ loser: CharacterModel; survivor: CharacterModel }> {
    const [survivor, loser] = await Promise.all([
      this.charactersRepository.findOwnedCharacterBare({ characterId, userId }, tx),
      this.charactersRepository.findOwnedCharacterBare({ characterId: otherId, userId }, tx),
    ]);
    if (survivor === null || loser === null) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_MERGE_ERROR_CODES.notFound,
      });
    }
    return { loser, survivor };
  }

  private async runMergeTransaction({
    characterId,
    otherId,
    userId,
  }: {
    characterId: string;
    otherId: string;
    userId: string;
  }): Promise<{
    counts: CharacterMergeResultView["counts"];
    droppedMediaIds: string[];
    loserId: string;
    survivor: CharacterMergeResultView["survivor"];
  }> {
    try {
      return await this.transactionRunner.run(async (tx) => {
        await this.mergeRepository.acquireMergeLock({ userId }, tx);
        const { loser, survivor } = await this.resolveParties({ characterId, otherId, tx, userId });

        const loserRows = await this.loadLoserRows({
          loserId: loser.id,
          survivorId: survivor.id,
          tx,
          userId,
        });
        await this.acquireWriterLocks({ loserRows, survivorId: survivor.id, tx });
        const survivorKeys = await this.loadSurvivorKeys({
          loserId: loser.id,
          survivorId: survivor.id,
          tx,
          userId,
        });

        const plan = buildCharacterMergePlan(this.toPlanInput({ loser, loserRows, survivorKeys }));
        await this.applyPlan({ loserId: loser.id, plan, survivorId: survivor.id, tx, userId });

        const purged = await this.mergeRepository.hardDeleteCharacter(
          { characterId: loser.id, userId },
          tx,
        );
        if (purged === 0) {
          throw new NotFoundError("Character not found", {
            code: CHARACTER_MERGE_ERROR_CODES.notFound,
          });
        }

        return {
          counts: plan.counts,
          droppedMediaIds: plan.droppedMediaIds,
          loserId: loser.id,
          survivor: { id: survivor.id, name: survivor.name },
        };
      }, HEAVY_TRANSACTION_OPTIONS);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("Merge conflicted with a concurrent change", {
          code: CHARACTER_MERGE_ERROR_CODES.conflict,
        });
      }
      throw error;
    }
  }

  private toPlanInput({
    loser,
    loserRows,
    survivorKeys,
  }: {
    loser: CharacterModel;
    loserRows: LoserRows;
    survivorKeys: SurvivorKeys;
  }): CharacterMergePlanInput {
    return {
      loserAliases: loserRows.loserAliases,
      loserAvatarMediaId: loser.avatarMediaId,
      loserBookCharacters: loserRows.loserBookCharacters,
      loserForms: loserRows.loserForms,
      loserMemberships: loserRows.loserMemberships,
      loserTagIds: loserRows.loserTagIds,
      loserTheoryCount: loserRows.loserTheoryCount,
      relationshipCandidates: loserRows.loserRelationshipCandidates,
      survivorAliasKeys: survivorKeys.survivorAliasKeys,
      survivorBookIds: survivorKeys.survivorBookIds,
      survivorFormKeys: survivorKeys.survivorFormKeys,
      survivorMembershipKeys: survivorKeys.survivorMembershipKeys,
      survivorRelationshipKeys: survivorKeys.survivorRelationshipKeys,
      survivorTagIds: survivorKeys.survivorTagIds,
    };
  }
}
