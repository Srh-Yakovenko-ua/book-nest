import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserRelationshipRoleSuggestionModel } from "../../../generated/prisma/models.js";

import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

export type RelationshipRoleSuggestionFilter = {
  search: string | undefined;
  userId: string;
};

export type RelationshipRoleSuggestionRow = Pick<
  UserRelationshipRoleSuggestionModel,
  "id" | "label"
>;

export type RelationshipRoleSuggestionUsage = {
  label: string;
  normalizedLabel: string;
  usedAt: Date;
  userId: string;
};

const relationshipRoleSuggestionSelect = {
  id: true,
  label: true,
} satisfies Prisma.UserRelationshipRoleSuggestionSelect;

@Injectable()
export class RelationshipRoleSuggestionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countOwned(filter: RelationshipRoleSuggestionFilter): Promise<number> {
    return this.prisma.userRelationshipRoleSuggestion.count({
      where: buildRelationshipRoleSuggestionWhere(filter),
    });
  }

  listOwned({
    filter,
    skip,
    take,
  }: {
    filter: RelationshipRoleSuggestionFilter;
    skip: number;
    take: number;
  }): Promise<RelationshipRoleSuggestionRow[]> {
    return this.prisma.userRelationshipRoleSuggestion.findMany({
      orderBy: [{ lastUsedAt: "desc" }, { id: "asc" }],
      select: relationshipRoleSuggestionSelect,
      skip,
      take,
      where: buildRelationshipRoleSuggestionWhere(filter),
    });
  }

  async upsertUsage(
    { label, normalizedLabel, usedAt, userId }: RelationshipRoleSuggestionUsage,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.$executeRaw`
      INSERT INTO user_relationship_role_suggestions
        (id, user_id, label, normalized_label, created_at, updated_at, last_used_at)
      VALUES
        (${randomUUID()}::uuid, ${userId}::uuid, ${label}, ${normalizedLabel}, ${usedAt}, ${usedAt}, ${usedAt})
      ON CONFLICT (user_id, normalized_label) DO UPDATE
      SET last_used_at = GREATEST(user_relationship_role_suggestions.last_used_at, EXCLUDED.last_used_at),
          updated_at = EXCLUDED.updated_at
    `;
  }
}

function buildRelationshipRoleSuggestionWhere({
  search,
  userId,
}: RelationshipRoleSuggestionFilter): Prisma.UserRelationshipRoleSuggestionWhereInput {
  const where: Prisma.UserRelationshipRoleSuggestionWhereInput = { userId };
  if (search !== undefined) {
    where.normalizedLabel = { contains: escapeLikePattern(search), mode: "insensitive" };
  }
  return where;
}
