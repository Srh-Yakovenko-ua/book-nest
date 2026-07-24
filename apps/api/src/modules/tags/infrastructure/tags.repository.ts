import type { Nullable, TagType } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { TagModel } from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

type CountTagsInput = {
  query: string | undefined;
  userId: string;
};

type CreateTagInput = {
  color: Nullable<string>;
  description: Nullable<string>;
  name: string;
  normalizedName: string;
  type: TagType;
  userId: string;
};

type SearchTagsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type TouchLastUsedInput = {
  tagIds: string[];
  usedAt: Date;
  userId: string;
};

type UpdateTagFields = {
  color?: Nullable<string>;
  description?: Nullable<string>;
  name?: string;
  normalizedName?: string;
  type?: TagType;
};

type UpsertTagInput = {
  name: string;
  normalizedName: string;
  userId: string;
};

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireCreateLock(userId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.tags, key: `tag:create:${userId}` },
      client,
    );
  }

  countBooksByTag(userId: string): Promise<{ count: number; tagId: string }[]> {
    return this.prisma.bookTag
      .groupBy({
        _count: { bookId: true },
        by: ["tagId"],
        where: { tag: { userId } },
      })
      .then((rows) => rows.map((row) => ({ count: row._count.bookId, tagId: row.tagId })));
  }

  countOwned({ query, userId }: CountTagsInput): Promise<number> {
    return this.prisma.tag.count({ where: buildOwnedWhere(userId, query) });
  }

  countOwnedByIds(
    { ids, userId }: { ids: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.tag.count({ where: { id: { in: ids }, userId } });
  }

  create(input: CreateTagInput, client: Prisma.TransactionClient = this.prisma): Promise<TagModel> {
    const { userId, ...data } = input;
    return client.tag.create({ data: { ...data, userId } });
  }

  deleteOwned(userId: string, id: string): Promise<number> {
    return this.prisma.tag.deleteMany({ where: { id, userId } }).then((result) => result.count);
  }

  findByNormalized(
    userId: string,
    normalizedName: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TagModel>> {
    return client.tag.findFirst({ where: { normalizedName, userId } });
  }

  findByNormalizedExcluding(
    {
      excludeId,
      normalizedName,
      userId,
    }: { excludeId: string; normalizedName: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TagModel>> {
    return client.tag.findFirst({ where: { id: { not: excludeId }, normalizedName, userId } });
  }

  findOwnedById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TagModel>> {
    return client.tag.findFirst({ where: { id, userId } });
  }

  listOwned(userId: string): Promise<TagModel[]> {
    return this.prisma.tag.findMany({ orderBy: { name: "asc" }, where: { userId } });
  }

  searchOwned({ query, skip, take, userId }: SearchTagsInput): Promise<TagModel[]> {
    return this.prisma.tag.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildOwnedWhere(userId, query),
    });
  }

  async touchLastUsed(
    { tagIds, usedAt, userId }: TouchLastUsedInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }
    await client.$executeRaw`UPDATE tags SET last_used_at = ${usedAt} WHERE id = ANY(${tagIds}::uuid[]) AND user_id = ${userId}::uuid`;
  }

  update(
    { data, id, userId }: { data: UpdateTagFields; id: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TagModel> {
    return client.tag.update({ data, where: { id, userId } });
  }

  upsertByNormalized(
    { name, normalizedName, userId }: UpsertTagInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TagModel> {
    return client.tag.upsert({
      create: { name, normalizedName, userId },
      update: { normalizedName },
      where: { userId_normalizedName: { normalizedName, userId } },
    });
  }
}

function buildOwnedWhere(userId: string, query: string | undefined): Prisma.TagWhereInput {
  if (query === undefined || query.length === 0) {
    return { userId };
  }

  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
    userId,
  };
}
