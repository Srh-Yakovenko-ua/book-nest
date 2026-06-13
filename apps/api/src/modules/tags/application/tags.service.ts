import type { Paginator, TagView, TaxonomySearchPaginationQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toTagView } from "../domain/tag.mapper.js";
import { TagsRepository } from "../infrastructure/tags.repository.js";

@Injectable()
export class TagsService {
  constructor(private readonly tagsRepository: TagsRepository) {}

  async resolveOrCreateMany(userId: string, names: string[]): Promise<string[]> {
    const uniqueNames = new Map<string, string>();
    for (const name of names) {
      const normalizedName = normalizeName(name);
      if (!uniqueNames.has(normalizedName)) {
        uniqueNames.set(normalizedName, name);
      }
    }

    const tagIds: string[] = [];
    for (const [normalizedName, name] of uniqueNames) {
      tagIds.push(await this.resolveOrCreate(userId, name, normalizedName));
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
  ): Promise<string> {
    const existing = await this.tagsRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return existing.id;
    }

    try {
      const created = await this.tagsRepository.create(userId, name, normalizedName);
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.tagsRepository.findByNormalized(userId, normalizedName);
      if (winner === null) {
        throw error;
      }
      return winner.id;
    }
  }
}
