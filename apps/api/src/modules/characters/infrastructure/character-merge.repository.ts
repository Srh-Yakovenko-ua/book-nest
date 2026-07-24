import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  LoserRelationshipRow,
  RelationshipRepoint,
  SurvivorRelationshipRow,
} from "../domain/character-merge.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

export type LoserAliasRow = {
  bookId: Nullable<string>;
  id: string;
  normalizedName: string;
  type: string;
};

export type LoserBookCharacterRow = {
  bookId: string;
  id: string;
  portraitMediaId: Nullable<string>;
  roleCount: number;
};

export type LoserFormRow = {
  id: string;
  normalizedName: string;
  portraitMediaId: Nullable<string>;
};

export type LoserMembershipRow = {
  bookId: Nullable<string>;
  groupId: string;
  id: string;
};

export type SurvivorAliasKey = {
  bookId: Nullable<string>;
  normalizedName: string;
  type: string;
};

export type SurvivorMembershipKey = {
  bookId: Nullable<string>;
  groupId: string;
};

@Injectable()
export class CharacterMergeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireMergeLock(
    { userId }: { userId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.characterMerge, key: `char-merge:${userId}` },
      client,
    );
  }

  async countHiddenLoserRecords(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const [aliases, memberships, theories, appearances, relationshipStates, forms] =
      await Promise.all([
        client.characterAlias.count({ where: { characterId, isSpoiler: true } }),
        client.characterGroupMembership.count({ where: { characterId, isSpoiler: true } }),
        client.characterTheory.count({ where: { characterId, isSpoiler: true, userId } }),
        client.bookCharacter.count({
          where: {
            characterId,
            OR: [
              { appearanceNotesIsSpoiler: true },
              { descriptionIsSpoiler: true },
              { displayNameIsSpoiler: true },
              { hidePresenceAsSpoiler: true },
              { personalImpressionIsSpoiler: true },
              { portraitIsSpoiler: true },
              { speciesOverrideIsSpoiler: true },
              { statusIsSpoiler: true },
              { roles: { some: { isSpoiler: true } } },
            ],
          },
        }),
        client.characterRelationshipBookState.count({
          where: {
            OR: [
              { hideRelationshipAsSpoiler: true },
              { isDescriptionSpoiler: true },
              { isTypeSpoiler: true },
            ],
            relationship: {
              OR: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }],
              userId,
            },
          },
        }),
        client.characterForm.count({ where: { characterId, isSpoiler: true } }),
      ]);
    return aliases + memberships + theories + appearances + relationshipStates + forms;
  }

  async countLoserTheories(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.characterTheory.count({ where: { characterId, userId } });
  }

  async deleteAliases(
    { ids }: { ids: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterAlias.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteBookCharacters(
    { ids }: { ids: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.bookCharacter.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteForms(
    { ids }: { ids: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterForm.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteMemberships(
    { ids }: { ids: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterGroupMembership.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteRelationships(
    { ids }: { ids: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterRelationship.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteTags(
    { loserId, tagIds }: { loserId: string; tagIds: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }
    await client.characterTag.deleteMany({
      where: { characterId: loserId, tagId: { in: tagIds } },
    });
  }

  async findLoserAliases(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoserAliasRow[]> {
    return client.characterAlias.findMany({
      orderBy: { createdAt: "asc" },
      select: { bookId: true, id: true, normalizedName: true, type: true },
      where: { characterId },
    });
  }

  async findLoserBookCharacters(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoserBookCharacterRow[]> {
    const rows = await client.bookCharacter.findMany({
      select: {
        _count: { select: { roles: true } },
        bookId: true,
        id: true,
        portraitMediaId: true,
      },
      where: { characterId },
    });
    return rows.map((row) => ({
      bookId: row.bookId,
      id: row.id,
      portraitMediaId: row.portraitMediaId,
      roleCount: row._count.roles,
    }));
  }

  findLoserForms(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoserFormRow[]> {
    return client.characterForm.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, normalizedName: true, portraitMediaId: true },
      where: { characterId },
    });
  }

  async findLoserMemberships(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoserMembershipRow[]> {
    return client.characterGroupMembership.findMany({
      orderBy: { createdAt: "asc" },
      select: { bookId: true, groupId: true, id: true },
      where: { characterId },
    });
  }

  async findLoserRelationships(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoserRelationshipRow[]> {
    return client.characterRelationship.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        customType: true,
        directionality: true,
        id: true,
        sourceCharacterId: true,
        sourceLabel: true,
        targetCharacterId: true,
        targetLabel: true,
        type: true,
      },
      where: {
        OR: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }],
        userId,
      },
    });
  }

  async findLoserTagIds(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.characterTag.findMany({
      select: { tagId: true },
      where: { characterId },
    });
    return rows.map((row) => row.tagId);
  }

  async findSurvivorAliasKeys(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SurvivorAliasKey[]> {
    return client.characterAlias.findMany({
      select: { bookId: true, normalizedName: true, type: true },
      where: { characterId },
    });
  }

  async findSurvivorBookIds(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.bookCharacter.findMany({
      select: { bookId: true },
      where: { characterId },
    });
    return rows.map((row) => row.bookId);
  }

  async findSurvivorFormKeys(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.characterForm.findMany({
      select: { normalizedName: true },
      where: { characterId },
    });
    return rows.map((row) => row.normalizedName);
  }

  async findSurvivorMembershipKeys(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SurvivorMembershipKey[]> {
    return client.characterGroupMembership.findMany({
      select: { bookId: true, groupId: true },
      where: { characterId },
    });
  }

  async findSurvivorRelationships(
    { loserId, survivorId, userId }: { loserId: string; survivorId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SurvivorRelationshipRow[]> {
    return client.characterRelationship.findMany({
      select: {
        customType: true,
        directionality: true,
        sourceCharacterId: true,
        targetCharacterId: true,
        type: true,
      },
      where: {
        AND: [
          { OR: [{ sourceCharacterId: survivorId }, { targetCharacterId: survivorId }] },
          { sourceCharacterId: { not: loserId } },
          { targetCharacterId: { not: loserId } },
        ],
        userId,
      },
    });
  }

  async findSurvivorTagIds(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.characterTag.findMany({
      select: { tagId: true },
      where: { characterId },
    });
    return rows.map((row) => row.tagId);
  }

  async hardDeleteCharacter(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.character.deleteMany({ where: { id: characterId, userId } });
    return result.count;
  }

  async repointAliases(
    { ids, survivorId }: { ids: string[]; survivorId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterAlias.updateMany({
      data: { characterId: survivorId },
      where: { id: { in: ids } },
    });
  }

  async repointBookCharacters(
    { ids, survivorId }: { ids: string[]; survivorId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.bookCharacter.updateMany({
      data: { characterId: survivorId },
      where: { id: { in: ids } },
    });
  }

  async repointForms(
    { ids, survivorId }: { ids: string[]; survivorId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterForm.updateMany({
      data: { characterId: survivorId },
      where: { id: { in: ids } },
    });
  }

  async repointMemberships(
    { ids, survivorId }: { ids: string[]; survivorId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await client.characterGroupMembership.updateMany({
      data: { characterId: survivorId },
      where: { id: { in: ids } },
    });
  }

  async repointRelationship(
    repoint: RelationshipRepoint,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.characterRelationship.update({
      data: {
        sourceCharacterId: repoint.sourceCharacterId,
        sourceLabel: repoint.sourceLabel,
        targetCharacterId: repoint.targetCharacterId,
        targetLabel: repoint.targetLabel,
      },
      where: { id: repoint.id },
    });
  }

  async repointTags(
    { loserId, survivorId, tagIds }: { loserId: string; survivorId: string; tagIds: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }
    await client.characterTag.updateMany({
      data: { characterId: survivorId },
      where: { characterId: loserId, tagId: { in: tagIds } },
    });
  }

  async repointTheories(
    { loserId, survivorId, userId }: { loserId: string; survivorId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.characterTheory.updateMany({
      data: { characterId: survivorId },
      where: { characterId: loserId, userId },
    });
    return result.count;
  }
}
