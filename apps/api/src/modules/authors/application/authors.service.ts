import type {
  AuthorBookSuggestionView,
  AuthorLookupResult,
  AuthorSearchPaginationQuery,
  AuthorView,
  Paginator,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { AuthorModel } from "../../../generated/prisma/models.js";

import { HttpError, NotFoundError } from "../../../core/exceptions/errors.js";
import { HTTP_STATUS } from "../../../core/http-status.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toAuthorView } from "../domain/author.mapper.js";
import { AuthorsRepository } from "../infrastructure/authors.repository.js";
import { OpenLibraryClient } from "../infrastructure/open-library.client.js";
import { WikidataClient } from "../infrastructure/wikidata.client.js";

const CUSTOM_AUTHOR_LOCALE = "uk";

type FindExistingGlobalAuthorInput = {
  normalizedName: string;
  openLibraryKey: string;
  wikidataId: null | string;
};

type ResolveAuthorInput = {
  id?: string;
  name?: string;
};

@Injectable()
export class AuthorsService {
  constructor(
    private readonly authorsRepository: AuthorsRepository,
    private readonly openLibraryClient: OpenLibraryClient,
    private readonly wikidataClient: WikidataClient,
  ) {}

  async listBookSuggestions(userId: string, authorId: string): Promise<AuthorBookSuggestionView[]> {
    const author = await this.authorsRepository.findVisibleById(userId, authorId);
    if (author === null) {
      throw new NotFoundError("Author not found");
    }

    if (author.openLibraryKey === null) {
      return [];
    }

    return this.openLibraryClient.getWorksByAuthor(author.openLibraryKey);
  }

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

  async materializeFromOpenLibrary(openLibraryKey: string): Promise<AuthorModel> {
    const existingByKey = await this.authorsRepository.findGlobalByOpenLibraryKey(openLibraryKey);
    if (existingByKey !== null) {
      return existingByKey;
    }

    const detail = await this.openLibraryClient.getAuthorByKey(openLibraryKey);
    if (detail === null) {
      throw new HttpError(HTTP_STATUS.BAD_GATEWAY, "Could not fetch author from Open Library", {
        code: "open_library_unavailable",
      });
    }

    const normalizedName = normalizeName(detail.name);

    if (detail.wikidataId !== null) {
      const existingByWikidata = await this.authorsRepository.findGlobalByWikidataId(
        detail.wikidataId,
      );
      if (existingByWikidata !== null) {
        return existingByWikidata;
      }
    }

    const facts =
      detail.wikidataId === null
        ? null
        : await this.wikidataClient.getAuthorFactsByQid(detail.wikidataId);

    try {
      return await this.authorsRepository.createGlobal(
        {
          bio: detail.bio,
          birthYear: detail.birthYear ?? facts?.birthYear ?? null,
          countryCode: facts?.countryCode ?? null,
          deathYear: facts?.deathYear ?? null,
          name: detail.name,
          normalizedName,
          openLibraryKey,
          photoUrl: detail.photoUrl,
          searchText: normalizedName,
          wikidataId: detail.wikidataId,
        },
        [{ isPrimary: true, locale: "en", name: detail.name, normalizedName }],
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.findExistingGlobalAuthor({
        normalizedName,
        openLibraryKey,
        wikidataId: detail.wikidataId,
      });
      if (winner === null) {
        throw error;
      }
      return winner;
    }
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
      const created = await this.authorsRepository.create(userId, {
        locale: CUSTOM_AUTHOR_LOCALE,
        name: input.name,
        normalizedName,
      });
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

  async search(userId: string, query: AuthorSearchPaginationQuery): Promise<Paginator<AuthorView>> {
    const { locale, pageNumber, pageSize, search } = query;

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
      items: authors.map((author) => toAuthorView(author, locale)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  private async findExistingGlobalAuthor({
    normalizedName,
    openLibraryKey,
    wikidataId,
  }: FindExistingGlobalAuthorInput): Promise<AuthorModel | null> {
    const byKey = await this.authorsRepository.findGlobalByOpenLibraryKey(openLibraryKey);
    if (byKey !== null) {
      return byKey;
    }

    if (wikidataId !== null) {
      const byWikidata = await this.authorsRepository.findGlobalByWikidataId(wikidataId);
      if (byWikidata !== null) {
        return byWikidata;
      }
    }

    return this.authorsRepository.findGlobalByNormalizedName(normalizedName);
  }
}
