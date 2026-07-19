import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CharacterRelationshipBookStateModel,
  CharacterRelationshipModel,
} from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const detailsInclude = {
  bookStates: { orderBy: [{ createdAt: "asc" }] },
  sourceCharacter: { select: { name: true } },
  targetCharacter: { select: { name: true } },
} satisfies Prisma.CharacterRelationshipInclude;

export type CreateBookStateData = {
  bookId: string;
  description: Nullable<string>;
  endedAudioSeconds: Nullable<number>;
  endedChapter: Nullable<string>;
  endedPage: Nullable<number>;
  hideRelationshipAsSpoiler: boolean;
  intensity: Nullable<string>;
  introducedAudioSeconds: Nullable<number>;
  introducedChapter: Nullable<string>;
  introducedPage: Nullable<number>;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
  relationshipId: string;
  status: string;
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

export type UpdateBookStateData = Omit<CreateBookStateData, "bookId" | "relationshipId">;

export type UpdateRelationshipData = {
  category?: string;
  customType?: Nullable<string>;
  directionality?: string;
  isCanonical?: boolean;
  sourceCharacterId?: string;
  sourceLabel?: Nullable<string>;
  targetCharacterId?: string;
  targetLabel?: Nullable<string>;
  type?: string;
};

@Injectable()
export class CharacterRelationshipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireRelationshipLock(
    { key }: { key: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  async countBookStates(
    { relationshipId }: { relationshipId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.characterRelationshipBookState.count({ where: { relationshipId } });
  }

  async countOwnedCharacters(
    { characterIds, userId }: { characterIds: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.character.count({
      where: { deletedAt: null, id: { in: characterIds }, userId },
    });
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
        sourceCharacter: { select: { name: true } },
        targetCharacter: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }],
      where: { bookStates: { some: { bookId: { in: bookIds } } }, userId },
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
