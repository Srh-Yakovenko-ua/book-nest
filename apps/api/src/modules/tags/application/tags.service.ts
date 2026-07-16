import type {
  CreateTagInput,
  Nullable,
  Paginator,
  TagCatalogView,
  TagStatsView,
  TagType,
  TagView,
  TaxonomySearchPaginationQuery,
  UpdateTagInput,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { TagModel } from "../../../generated/prisma/models.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toTagCatalogView, toTagStatsView, toTagView } from "../domain/tag.mapper.js";
import { TagsRepository } from "../infrastructure/tags.repository.js";

type TagUpdateData = {
  color?: Nullable<string>;
  description?: Nullable<string>;
  name?: string;
  normalizedName?: string;
  type?: TagType;
};

const TAG_ALREADY_EXISTS_MESSAGE = "A tag with this name already exists";

@Injectable()
export class TagsService {
  constructor(
    private readonly tagsRepository: TagsRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create(userId: string, input: CreateTagInput): Promise<TagCatalogView> {
    const normalizedName = normalizeName(input.name);
    try {
      const created = await this.transactionRunner.run(async (tx) => {
        await this.tagsRepository.acquireCreateLock(userId, tx);
        const existing = await this.tagsRepository.findByNormalized(userId, normalizedName, tx);
        if (existing !== null) {
          throw new ConflictError(TAG_ALREADY_EXISTS_MESSAGE);
        }
        return this.tagsRepository.create(
          {
            color: input.color ?? null,
            description: input.description ?? null,
            name: input.name,
            normalizedName,
            type: input.type,
            userId,
          },
          tx,
        );
      });
      return toTagCatalogView(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(TAG_ALREADY_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  async delete(userId: string, tagId: string): Promise<void> {
    const deletedCount = await this.tagsRepository.deleteOwned(userId, tagId);
    if (deletedCount === 0) {
      throw new NotFoundError("Tag not found");
    }
  }

  async resolveOrCreateMany(
    userId: string,
    names: string[],
    client?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const uniqueNames = new Map<string, string>();
    for (const name of names) {
      const normalizedName = normalizeName(name);
      if (!uniqueNames.has(normalizedName)) {
        uniqueNames.set(normalizedName, name);
      }
    }

    const tagIds: string[] = [];
    for (const [normalizedName, name] of uniqueNames) {
      tagIds.push(await this.resolveOrCreate(userId, name, normalizedName, client));
    }

    await this.tagsRepository.touchLastUsed({ tagIds, usedAt: new Date(), userId }, client);

    return tagIds;
  }

  async search(userId: string, query: TaxonomySearchPaginationQuery): Promise<Paginator<TagView>> {
    const { pageNumber, pageSize, search } = query;

    const [tags, totalCount] = await Promise.all([
      this.tagsRepository.searchOwned({
        query: search,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
      }),
      this.tagsRepository.countOwned({ query: search, userId }),
    ]);

    return buildPaginator({
      items: tags.map(toTagView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async stats(userId: string): Promise<TagStatsView[]> {
    const [tags, counts] = await Promise.all([
      this.tagsRepository.listOwned(userId),
      this.tagsRepository.countBooksByTag(userId),
    ]);
    const countByTagId = new Map(counts.map((entry) => [entry.tagId, entry.count]));
    return tags.map((tag) => toTagStatsView({ booksCount: countByTagId.get(tag.id) ?? 0, tag }));
  }

  async update(userId: string, tagId: string, input: UpdateTagInput): Promise<TagCatalogView> {
    try {
      const updated = await this.transactionRunner.run(async (tx) => {
        await this.tagsRepository.acquireCreateLock(userId, tx);
        const current = await this.tagsRepository.findOwnedById(userId, tagId, tx);
        if (current === null) {
          throw new NotFoundError("Tag not found");
        }
        const data = await this.buildUpdateData({ current, input, tx, userId });
        return this.tagsRepository.update({ data, id: tagId, userId }, tx);
      });
      return toTagCatalogView(updated);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(TAG_ALREADY_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  private async buildUpdateData({
    current,
    input,
    tx,
    userId,
  }: {
    current: TagModel;
    input: UpdateTagInput;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<TagUpdateData> {
    const data: TagUpdateData = {};

    if (input.name !== undefined) {
      const normalizedName = normalizeName(input.name);
      if (normalizedName !== current.normalizedName) {
        const conflict = await this.tagsRepository.findByNormalizedExcluding(
          { excludeId: current.id, normalizedName, userId },
          tx,
        );
        if (conflict !== null) {
          throw new ConflictError(TAG_ALREADY_EXISTS_MESSAGE);
        }
      }
      data.name = input.name;
      data.normalizedName = normalizedName;
    }

    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.color !== undefined) {
      data.color = input.color;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }

    return data;
  }

  private async resolveOrCreate(
    userId: string,
    name: string,
    normalizedName: string,
    client?: Prisma.TransactionClient,
  ): Promise<string> {
    const existing = await this.tagsRepository.findByNormalized(userId, normalizedName, client);
    if (existing !== null) {
      return existing.id;
    }

    const created = await this.tagsRepository.upsertByNormalized(
      { name, normalizedName, userId },
      client,
    );
    return created.id;
  }
}
