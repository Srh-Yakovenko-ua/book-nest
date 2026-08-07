import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CharacterRelationshipBookStateModel,
  CharacterRelationshipModel,
} from "../../../generated/prisma/models.js";
import type {
  UpdateBookStateData,
  UpdateRelationshipData,
} from "../domain/character-relationship-write.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

const detailsInclude = {
  bookStates: { orderBy: [{ createdAt: "asc" }] },
  sourceCharacter: { select: { hideProfileAsSpoiler: true, name: true } },
  targetCharacter: { select: { hideProfileAsSpoiler: true, name: true } },
} satisfies Prisma.CharacterRelationshipInclude;

const visibleEndpointWhere = {
  sourceCharacter: { hideProfileAsSpoiler: false },
  targetCharacter: { hideProfileAsSpoiler: false },
} satisfies Prisma.CharacterRelationshipWhereInput;

export type CreateBookStateData = UpdateBookStateData & {
  bookId: string;
  relationshipId: string;
};

export type CreateRelationshipData = {
  category: string;
  customType: Nullable<string>;
  directionality: string;
  isCanonical: boolean;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
  userId: string;
};

export type RelationshipAncestryEdge = {
  sourceCharacterId: string;
  targetCharacterId: string;
  type: string;
};

export type RelationshipDetailsRow = Prisma.CharacterRelationshipGetPayload<{
  include: typeof detailsInclude;
}>;

export type RelationshipDuplicateRow = {
  customType: Nullable<string>;
  id: string;
};

@Injectable()
export class CharacterRelationshipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireRelationshipLock(
    { key }: { key: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.characterRelationships, key }, client);
  }

  async countBookStates(
    { relationshipId }: { relationshipId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.characterRelationshipBookState.count({ where: { relationshipId } });
  }

  async createBookStates(
    rows: CreateBookStateData[],
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await client.characterRelationshipBookState.createMany({ data: rows });
  }

  createRelationship(
    data: CreateRelationshipData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterRelationshipModel> {
    return client.characterRelationship.create({ data });
  }

  async deleteBookState(
    { bookId, relationshipId }: { bookId: string; relationshipId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.characterRelationshipBookState.deleteMany({
      where: { bookId, relationshipId },
    });
    return result.count;
  }

  async deleteOwnedRelationship(
    { relationshipId, userId }: { relationshipId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.characterRelationship.deleteMany({
      where: { id: relationshipId, userId },
    });
    return result.count;
  }

  findDuplicateCandidates(
    {
      sourceCharacterId,
      targetCharacterId,
      type,
      userId,
    }: { sourceCharacterId: string; targetCharacterId: string; type: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<RelationshipDuplicateRow[]> {
    return client.characterRelationship.findMany({
      select: { customType: true, id: true },
      where: { sourceCharacterId, targetCharacterId, type, userId },
    });
  }

  findFamilyAncestryEdges(
    { excludeRelationshipId, userId }: { excludeRelationshipId?: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<RelationshipAncestryEdge[]> {
    return client.characterRelationship.findMany({
      select: { sourceCharacterId: true, targetCharacterId: true, type: true },
      where: {
        category: "family",
        id: excludeRelationshipId === undefined ? undefined : { not: excludeRelationshipId },
        userId,
      },
    });
  }

  findOwnedRelationshipBare(
    { relationshipId, userId }: { relationshipId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterRelationshipModel>> {
    return client.characterRelationship.findFirst({ where: { id: relationshipId, userId } });
  }

  findOwnedRelationshipDetails(
    { relationshipId, userId }: { relationshipId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<RelationshipDetailsRow>> {
    return client.characterRelationship.findFirst({
      include: detailsInclude,
      where: { id: relationshipId, userId },
    });
  }

  listRelationshipsInBooks({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<RelationshipDetailsRow[]> {
    if (bookIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.characterRelationship.findMany({
      include: {
        bookStates: { orderBy: [{ createdAt: "asc" }], where: { bookId: { in: bookIds } } },
        sourceCharacter: { select: { hideProfileAsSpoiler: true, name: true } },
        targetCharacter: { select: { hideProfileAsSpoiler: true, name: true } },
      },
      orderBy: [{ createdAt: "asc" }],
      where: {
        ...visibleEndpointWhere,
        bookStates: { some: { bookId: { in: bookIds } } },
        userId,
      },
    });
  }

  updateRelationship(
    {
      data,
      relationshipId,
      userId,
    }: { data: UpdateRelationshipData; relationshipId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return client.characterRelationship.updateMany({
      data,
      where: { id: relationshipId, userId },
    });
  }

  upsertBookState(
    {
      bookId,
      data,
      relationshipId,
    }: { bookId: string; data: UpdateBookStateData; relationshipId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterRelationshipBookStateModel> {
    return client.characterRelationshipBookState.upsert({
      create: { ...data, bookId, relationshipId },
      update: data,
      where: { relationshipId_bookId: { bookId, relationshipId } },
    });
  }
}
