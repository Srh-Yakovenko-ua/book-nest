import type {
  CatalogLocale,
  LibraryPublisherDetail,
  LibraryPublisherListItem,
  LibraryPublisherOverview,
  LibraryPublishersQuery,
  LibraryPublishersQuickCounts,
  LibraryPublishersQuickCountsQuery,
  LibraryPublishersSummary,
  Nullable,
  Paginator,
  PublisherDuplicateCandidate,
  PublisherMatchKind,
  PublisherMergeResult,
  PublisherSearchPaginationQuery,
  PublisherView,
  UpdatePublisherInput,
} from "@app/shared";

import {
  normalizeName,
  PUBLISHER_MERGE_ERROR_CODES,
  PUBLISHER_NAME_ERROR_CODES,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { PublisherWithNames } from "../infrastructure/publishers.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import {
  isForeignKeyConstraintError,
  rethrowUniqueConstraintAs,
} from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { toLibraryPublisherCriteria } from "../domain/publisher-library-criteria.js";
import {
  toLibraryPublisherDetail,
  toLibraryPublisherListItem,
  toLibraryPublishersSummary,
} from "../domain/publisher-library.mapper.js";
import {
  buildPublisherMatchVariants,
  comparePublisherCandidates,
  PUBLISHER_MATCH_TUNING,
  scoreStrongMatch,
} from "../domain/publisher-name-matching.js";
import { toLibraryPublisherOverview } from "../domain/publisher-overview.mapper.js";
import { toPublisherDuplicateCandidate, toPublisherView } from "../domain/publisher.mapper.js";
import { PublisherOverviewRepository } from "../infrastructure/publisher-overview.repository.js";
import { PublishersRepository } from "../infrastructure/publishers.repository.js";

const CUSTOM_PUBLISHER_LOCALE = "uk";

const RELIABLE_MATCH_SCORE = 1;

type DuplicateCandidatesInput = {
  excludePublisherId?: string;
  locale: CatalogLocale;
  name: string;
  userId: string;
};

type LibraryDetailInput = {
  locale: CatalogLocale;
  publisherId: string;
  userId: string;
};

type LibraryListInput = {
  query: LibraryPublishersQuery;
  userId: string;
};

type LibraryQuickCountsInput = {
  query: LibraryPublishersQuickCountsQuery;
  userId: string;
};

type LibrarySummaryInput = {
  locale: CatalogLocale;
  userId: string;
};

type MergeCustomInput = {
  sourcePublisherId: string;
  targetPublisherId: string;
  userId: string;
};

type OwnedPublisherInput = {
  publisherId: string;
  userId: string;
};

type RecentPublishersInput = {
  limit: number;
  locale: CatalogLocale;
  userId: string;
};

type ReliableMatch = {
  matchedNormalizedName: string;
  matchKind: PublisherMatchKind;
  publisher: PublisherWithNames;
};

type ResolvePublisherInput = {
  id?: string;
  name?: string;
};

type ScoredCandidate = PublisherDuplicateCandidate & { score: number };

type UpdateCustomInput = {
  input: UpdatePublisherInput;
  publisherId: string;
  userId: string;
};

@Injectable()
export class PublishersService {
  constructor(
    private readonly publishersRepository: PublishersRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly publisherOverviewRepository: PublisherOverviewRepository,
    private readonly mediaService: MediaService,
  ) {}

  async deleteCustom({ publisherId, userId }: OwnedPublisherInput): Promise<void> {
    await this.loadOwnedCustom({ publisherId, userId });

    await this.transactionRunner.run(async (tx) => {
      const linkedBooks = await this.publishersRepository.countBooks(publisherId, tx);
      if (linkedBooks > 0) {
        throw publisherHasBooksError();
      }

      let deleted: number;
      try {
        deleted = await this.publishersRepository.deleteWithNames(publisherId, tx);
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          throw publisherHasBooksError();
        }
        throw error;
      }

      if (deleted === 0) {
        throw new NotFoundError("Publisher not found");
      }
    });
  }

  async duplicateCandidates({
    excludePublisherId,
    locale,
    name,
    userId,
  }: DuplicateCandidatesInput): Promise<PublisherDuplicateCandidate[]> {
    const variants = buildPublisherMatchVariants(name);

    const [reliable, strongRows] = await Promise.all([
      this.reliableMatches({ name, userId }),
      this.publishersRepository.findStrongCandidates({ userId, variants }),
    ]);

    const reliableIds = new Set(reliable.map((match) => match.publisher.id));

    const reliableCandidates = reliable.map(({ matchedNormalizedName, matchKind, publisher }) => ({
      ...toPublisherDuplicateCandidate({ locale, matchedNormalizedName, matchKind, publisher }),
      score: RELIABLE_MATCH_SCORE,
    }));

    const strongCandidates = strongRows
      .filter((publisher) => !reliableIds.has(publisher.id))
      .map((publisher) => ({
        ...toPublisherDuplicateCandidate({ locale, matchKind: "strong", publisher }),
        score: scoreStrongMatch({ candidateNames: toCandidateNames(publisher), variants }),
      }))
      .filter((candidate) => candidate.score >= PUBLISHER_MATCH_TUNING.minimumStrongSimilarity)
      .sort(comparePublisherCandidates)
      .slice(0, PUBLISHER_MATCH_TUNING.strongSuggestionLimit);

    return [...reliableCandidates, ...strongCandidates]
      .filter((candidate) => candidate.id !== excludePublisherId)
      .sort(comparePublisherCandidates)
      .map(toCandidateView);
  }

  async libraryDetail({
    locale,
    publisherId,
    userId,
  }: LibraryDetailInput): Promise<LibraryPublisherDetail> {
    const row = await this.publishersRepository.aggregateLibraryDetail({
      locale,
      publisherId,
      userId,
    });
    if (row === null) {
      throw new NotFoundError("Publisher not found");
    }
    return toLibraryPublisherDetail(row);
  }

  async libraryList({
    query,
    userId,
  }: LibraryListInput): Promise<Paginator<LibraryPublisherListItem>> {
    const { filter, locale, order, pageNumber, pageSize, sort } = query;
    const criteria = { ...toLibraryPublisherCriteria({ query, userId }), filter };

    const [rows, totalCount] = await Promise.all([
      this.publishersRepository.aggregateLibrary({
        ...criteria,
        locale,
        order,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.publishersRepository.countLibrary(criteria),
    ]);

    return buildPaginator({
      items: rows.map(toLibraryPublisherListItem),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async libraryOverview({
    publisherId,
    userId,
  }: OwnedPublisherInput): Promise<LibraryPublisherOverview> {
    const publisher = await this.publishersRepository.findVisibleById(userId, publisherId);
    if (publisher === null) {
      throw new NotFoundError("Publisher not found");
    }

    const scope = { publisherId, userId };
    const [latestBook, activeReading, wishlist, series] = await Promise.all([
      this.publisherOverviewRepository.latestBook(scope),
      this.publisherOverviewRepository.activeReading(scope),
      this.publisherOverviewRepository.wishlist(scope),
      this.publisherOverviewRepository.series(scope),
    ]);

    return toLibraryPublisherOverview({
      buildCover: (asset) => this.mediaService.buildViewOrNull(asset),
      rows: { activeReading, latestBook, series, wishlist },
    });
  }

  libraryQuickCounts({
    query,
    userId,
  }: LibraryQuickCountsInput): Promise<LibraryPublishersQuickCounts> {
    return this.publishersRepository.countLibraryQuickFilters(
      toLibraryPublisherCriteria({ query, userId }),
    );
  }

  async librarySummary({ locale, userId }: LibrarySummaryInput): Promise<LibraryPublishersSummary> {
    const [counts, insights, priceTotals] = await Promise.all([
      this.publishersRepository.summaryCounts(userId),
      this.publishersRepository.summaryInsights({ locale, userId }),
      this.publishersRepository.summaryPriceTotals(userId),
    ]);
    return toLibraryPublishersSummary({ counts, insights, priceTotals });
  }

  async mergeCustom({
    sourcePublisherId,
    targetPublisherId,
    userId,
  }: MergeCustomInput): Promise<PublisherMergeResult> {
    if (sourcePublisherId === targetPublisherId) {
      throw new BadRequestError("A publisher cannot be merged into itself", {
        code: PUBLISHER_MERGE_ERROR_CODES.samePublisher,
      });
    }

    const movedBooksCount = await this.transactionRunner.run(async (tx) => {
      await this.loadOwnedCustom({ publisherId: sourcePublisherId, userId }, tx);

      const target = await this.publishersRepository.findVisibleById(userId, targetPublisherId, tx);
      if (target === null) {
        throw new NotFoundError("Publisher not found");
      }

      const reassignedBooks = await this.publishersRepository.reassignBooks(
        { sourcePublisherId, targetPublisherId, userId },
        tx,
      );

      let deleted: number;
      try {
        deleted = await this.publishersRepository.deleteWithNames(sourcePublisherId, tx);
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          throw publisherHasBooksError();
        }
        throw error;
      }

      if (deleted === 0) {
        throw new NotFoundError("Publisher not found");
      }

      return reassignedBooks;
    });

    return { movedBooksCount, targetPublisherId };
  }

  async recent({ limit, locale, userId }: RecentPublishersInput): Promise<PublisherView[]> {
    const ids = await this.publishersRepository.recentPublisherIds({ limit, userId });
    if (ids.length === 0) {
      return [];
    }

    const publishers = await this.publishersRepository.findVisibleByIds({ ids, userId });
    const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]));

    return ids.flatMap((id) => {
      const publisher = publisherById.get(id);
      return publisher === undefined ? [] : [toPublisherView(publisher, locale)];
    });
  }

  async resolveOrCreate(
    userId: string,
    input: ResolvePublisherInput,
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<string>> {
    if (input.id !== undefined) {
      const publisher = await this.publishersRepository.findVisibleById(userId, input.id, client);
      if (publisher === null) {
        throw new NotFoundError("Publisher not found");
      }
      return publisher.id;
    }

    if (input.name === undefined) {
      return null;
    }

    const matches = await this.reliableMatches({ name: input.name, userId }, client);
    if (matches.length > 1) {
      throw new ConflictError("Several publishers already match this name", {
        code: PUBLISHER_NAME_ERROR_CODES.ambiguousName,
        details: { publisherIds: matches.map((match) => match.publisher.id) },
      });
    }

    const single = matches[0];
    if (single !== undefined) {
      return single.publisher.id;
    }

    const created = await this.publishersRepository.upsertByNormalized(
      {
        locale: CUSTOM_PUBLISHER_LOCALE,
        name: input.name,
        normalizedName: normalizeName(input.name),
        userId,
      },
      client,
    );
    return created.id;
  }

  async search(
    userId: string,
    query: PublisherSearchPaginationQuery,
  ): Promise<Paginator<PublisherView>> {
    const { locale, pageNumber, pageSize, search } = query;

    const [publishers, totalCount] = await Promise.all([
      this.publishersRepository.searchVisible({
        query: search,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.publishersRepository.countVisible(userId, search),
    ]);

    return buildPaginator({
      items: publishers.map((publisher) => toPublisherView(publisher, locale)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async updateCustom({
    input,
    publisherId,
    userId,
  }: UpdateCustomInput): Promise<LibraryPublisherDetail> {
    await this.loadOwnedCustom({ publisherId, userId });

    const rename =
      input.name === undefined
        ? undefined
        : { name: input.name, normalizedName: normalizeName(input.name) };

    if (rename !== undefined) {
      const matches = await this.reliableMatches({ name: rename.name, userId });
      const taken = matches.some((match) => match.publisher.id !== publisherId);
      if (taken) {
        throw publisherDuplicateNameError();
      }
    }

    await this.runCustomUpdate({ input, publisherId, rename });

    return this.libraryDetail({ locale: CUSTOM_PUBLISHER_LOCALE, publisherId, userId });
  }

  private async loadOwnedCustom(
    { publisherId, userId }: OwnedPublisherInput,
    client?: Prisma.TransactionClient,
  ): Promise<PublisherModel> {
    const publisher = await this.publishersRepository.findById(publisherId, client);
    if (publisher === null) {
      throw new NotFoundError("Publisher not found");
    }
    if (publisher.userId === null) {
      throw new ForbiddenError();
    }
    if (publisher.userId !== userId) {
      throw new NotFoundError("Publisher not found");
    }
    return publisher;
  }

  private async reliableMatches(
    { name, userId }: { name: string; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<ReliableMatch[]> {
    const normalizedName = normalizeName(name);
    const rows = await this.publishersRepository.findNameMatches(
      { normalizedName, userId },
      client,
    );

    return rows.map((publisher) => ({
      matchedNormalizedName: normalizedName,
      matchKind: publisher.normalizedName === normalizedName ? "exact" : "alias",
      publisher,
    }));
  }

  private async runCustomUpdate({
    input,
    publisherId,
    rename,
  }: {
    input: UpdatePublisherInput;
    publisherId: string;
    rename?: { name: string; normalizedName: string };
  }): Promise<PublisherModel> {
    try {
      return await this.transactionRunner.run(async (tx) => {
        const row = await this.publishersRepository.updateCustom(
          {
            countryCode: input.countryCode,
            foundedYear: input.foundedYear,
            id: publisherId,
            rename,
            websiteUrl: input.websiteUrl,
          },
          tx,
        );
        if (rename !== undefined) {
          await this.publishersRepository.updatePrimaryName(
            { name: rename.name, normalizedName: rename.normalizedName, publisherId },
            tx,
          );
        }
        return row;
      });
    } catch (error) {
      rethrowUniqueConstraintAs({ error, toError: publisherDuplicateNameError });
    }
  }
}

function publisherDuplicateNameError(): ConflictError {
  return new ConflictError("A publisher with this name already exists", {
    code: PUBLISHER_NAME_ERROR_CODES.duplicateName,
  });
}

function publisherHasBooksError(): ConflictError {
  return new ConflictError("Publisher still has linked books", { code: "PUBLISHER_HAS_BOOKS" });
}

function toCandidateNames(publisher: PublisherWithNames): string[] {
  return [publisher.name, ...publisher.names.map((publisherName) => publisherName.name)];
}

function toCandidateView({
  id,
  isCustom,
  matchedName,
  matchKind,
  name,
}: ScoredCandidate): PublisherDuplicateCandidate {
  return { id, isCustom, matchedName, matchKind, name };
}
