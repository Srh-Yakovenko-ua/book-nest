import type {
  AuthorBookSuggestionView,
  AuthorLookupResult,
  AuthorSearchPaginationQuery,
  AuthorView,
  BookAuthorReference,
  CatalogLocale,
  Paginator,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { AuthorModel } from "../../../generated/prisma/models.js";

import { BadGatewayError, NotFoundError } from "../../../core/exceptions/errors.js";
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

type RecentAuthorsInput = {
  limit: number;
  locale: CatalogLocale;
  userId: string;
};

type ResolveAuthorInput = {
  id?: string;
  name?: string;
};

type ResolveReferenceIdInput = {
  reference: BookAuthorReference;
  userId: string;
};

type ResolveReferencesInput = {
  references: BookAuthorReference[];
  userId: string;
};

type VisibleByIdsInput = {
  ids: string[];
  userId: string;
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
      throw new BadGatewayError("Could not fetch author from Open Library", {
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

  async recent({ limit, locale, userId }: RecentAuthorsInput): Promise<AuthorView[]> {
    const ids = await this.authorsRepository.recentAuthorIds({ limit, userId });
    if (ids.length === 0) {
      return [];
    }

    const authors = await this.authorsRepository.findVisibleByIdsWithNames({ ids, userId });
    const authorById = new Map(authors.map((author) => [author.id, author]));

    return ids.flatMap((id) => {
      const author = authorById.get(id);
      return author === undefined ? [] : [toAuthorView(author, locale)];
    });
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

    const created = await this.authorsRepository.upsertByNormalized({
      locale: CUSTOM_AUTHOR_LOCALE,
      name: input.name,
      normalizedName,
      userId,
    });
    return created.id;
  }

  async resolveReferences({
    references,
    userId,
  }: ResolveReferencesInput): Promise<{ id: string; name: string }[]> {
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const reference of references) {
      const authorId = await this.resolveReferenceId({ reference, userId });
      if (!seen.has(authorId)) {
        seen.add(authorId);
        orderedIds.push(authorId);
      }
    }

    const authors = await this.findVisibleByIds({ ids: orderedIds, userId });
    const nameById = new Map(authors.map((author) => [author.id, author.name]));
    return orderedIds.map((id) => ({ id, name: nameById.get(id) ?? "" }));
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

  private findVisibleByIds({
    ids,
    userId,
  }: VisibleByIdsInput): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.authorsRepository.findBaseByIds({ ids, userId });
  }

  private async resolveReferenceId({
    reference,
    userId,
  }: ResolveReferenceIdInput): Promise<string> {
    if ("id" in reference) {
      return this.resolveOrCreate(userId, { id: reference.id });
    }

    if ("openLibraryKey" in reference) {
      const materialized = await this.materializeFromOpenLibrary(reference.openLibraryKey);
      return materialized.id;
    }

    return this.resolveOrCreate(userId, { name: reference.name });
  }
}
