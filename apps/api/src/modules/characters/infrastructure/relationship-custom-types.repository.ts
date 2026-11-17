import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserRelationshipCustomTypeModel } from "../../../generated/prisma/models.js";

import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

export type RelationshipCustomTypeFilter = {
  directionality: string | undefined;
  search: string | undefined;
  userId: string;
};

export type RelationshipCustomTypeRow = Pick<
  UserRelationshipCustomTypeModel,
  "directionality" | "id" | "name"
>;

export type RelationshipCustomTypeUsage = {
  directionality: string;
  name: string;
  normalizedName: string;
  usedAt: Date;
  userId: string;
};

const relationshipCustomTypeSelect = {
  directionality: true,
  id: true,
  name: true,
} satisfies Prisma.UserRelationshipCustomTypeSelect;

@Injectable()
export class RelationshipCustomTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countOwned(filter: RelationshipCustomTypeFilter): Promise<number> {
    return this.prisma.userRelationshipCustomType.count({
      where: buildRelationshipCustomTypeWhere(filter),
    });
  }

  listOwned({
    filter,
    skip,
    take,
  }: {
    filter: RelationshipCustomTypeFilter;
    skip: number;
    take: number;
  }): Promise<RelationshipCustomTypeRow[]> {
    return this.prisma.userRelationshipCustomType.findMany({
      orderBy: [{ lastUsedAt: "desc" }, { id: "asc" }],
      select: relationshipCustomTypeSelect,
      skip,
      take,
      where: buildRelationshipCustomTypeWhere(filter),
    });
  }

  async upsertUsage(
    { directionality, name, normalizedName, usedAt, userId }: RelationshipCustomTypeUsage,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.$executeRaw`
      INSERT INTO user_relationship_custom_types
        (id, user_id, name, normalized_name, directionality, created_at, updated_at, last_used_at)
      VALUES
        (${randomUUID()}::uuid, ${userId}::uuid, ${name}, ${normalizedName}, ${directionality}, ${usedAt}, ${usedAt}, ${usedAt})
      ON CONFLICT (user_id, normalized_name, directionality) DO UPDATE
      SET last_used_at = GREATEST(user_relationship_custom_types.last_used_at, EXCLUDED.last_used_at),
          updated_at = EXCLUDED.updated_at
    `;
  }
}

function buildRelationshipCustomTypeWhere({
  directionality,
  search,
  userId,
}: RelationshipCustomTypeFilter): Prisma.UserRelationshipCustomTypeWhereInput {
  const where: Prisma.UserRelationshipCustomTypeWhereInput = { userId };
  if (directionality !== undefined) {
    where.directionality = directionality;
  }
  if (search !== undefined) {
    where.normalizedName = { contains: escapeLikePattern(search), mode: "insensitive" };
  }
  return where;
}
