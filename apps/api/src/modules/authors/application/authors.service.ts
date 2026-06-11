import type { AuthorView, Paginator, TaxonomySearchPaginationQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toAuthorView } from "../domain/author.mapper.js";
import { AuthorsRepository } from "../infrastructure/authors.repository.js";

type ResolveAuthorInput = {
  id?: string;
  name?: string;
};

@Injectable()
export class AuthorsService {
  constructor(private readonly authorsRepository: AuthorsRepository) {}

  async resolveOrCreate(userId: string, input: ResolveAuthorInput): Promise<string> {
    if (input.id !== undefined) {
      const author = await this.authorsRepository.findVisibleById(userId, input.id);
      if (author === null) {
        throw new NotFoundError("Author not found");
      }
      return author.id;
    }

    if (input.name === undefined) {
      throw new NotFoundError("Author not found");
    }

    const normalizedName = normalizeName(input.name);
    const existing = await this.authorsRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return existing.id;
    }

    try {
      const created = await this.authorsRepository.create(userId, input.name, normalizedName);
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.authorsRepository.findByNormalized(userId, normalizedName);
      if (winner === null) {
        throw error;
      }
      return winner.id;
    }
  }

  async search(
    userId: string,
    query: TaxonomySearchPaginationQuery,
  ): Promise<Paginator<AuthorView>> {
    const { pageNumber, pageSize, search } = query;

    const [authors, totalCount] = await Promise.all([
      this.authorsRepository.searchVisible({
        query: search,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
      }),
      this.authorsRepository.countVisible(userId, search),
    ]);

    return buildPaginator({
      items: authors.map(toAuthorView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }
}
