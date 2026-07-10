import type { Paginator, TagView, TaxonomySearchPaginationQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toTagView } from "../domain/tag.mapper.js";
import { TagsRepository } from "../infrastructure/tags.repository.js";

@Injectable()
export class TagsService {
  constructor(private readonly tagsRepository: TagsRepository) {}

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

    try {
      const created = await this.tagsRepository.create(userId, name, normalizedName, client);
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.tagsRepository.findByNormalized(userId, normalizedName, client);
      if (winner === null) {
        throw error;
      }
      return winner.id;
    }
  }
}
