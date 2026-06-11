import type {
  AuthorLookupResult,
  AuthorView,
  Paginator,
  TaxonomySearchPaginationQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toAuthorView } from "../domain/author.mapper.js";
import { AuthorsRepository } from "../infrastructure/authors.repository.js";
import { OpenLibraryClient } from "../infrastructure/open-library.client.js";

type ResolveAuthorInput = {
  id?: string;
  name?: string;
};

@Injectable()
export class AuthorsService {
  constructor(
    private readonly authorsRepository: AuthorsRepository,
    private readonly openLibraryClient: OpenLibraryClient,
  ) {}

  async lookup(userId: string, query: string): Promise<AuthorLookupResult[]> {
    const candidates = await this.openLibraryClient.searchAuthors(query);
    if (candidates.length === 0) {
      return [];
    }

    const matches = await this.authorsRepository.findExistingByLookup({
      normalizedNames: candidates.map((candidate) => normalizeName(candidate.name)),
      openLibraryKeys: candidates.map((candidate) => candidate.key),
      userId,
    });

    const existingKeys = new Set(
      matches.map((match) => match.openLibraryKey).filter((key): key is string => key !== null),
    );
    const existingNames = new Set(matches.map((match) => match.normalizedName));

    return candidates.map((candidate) => ({
      birthYear: candidate.birthYear,
      inDb: existingKeys.has(candidate.key) || existingNames.has(normalizeName(candidate.name)),
      name: candidate.name,
      openLibraryKey: candidate.key,
      photoUrl: candidate.photoUrl,
      source: "open_library",
    }));
  }

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
