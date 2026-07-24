import type {
  CatalogLocale,
  LibraryPublisherDetail,
  LibraryPublisherListItem,
  LibraryPublishersQuery,
  LibraryPublishersSummary,
  Nullable,
  Paginator,
  PublisherSearchPaginationQuery,
  PublisherView,
  UpdatePublisherInput,
} from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import {
  toLibraryPublisherDetail,
  toLibraryPublisherDetailFromModel,
  toLibraryPublisherListItem,
  toLibraryPublishersSummary,
} from "../domain/publisher-library.mapper.js";
import { toPublisherView } from "../domain/publisher.mapper.js";
import { PublishersRepository } from "../infrastructure/publishers.repository.js";

const CUSTOM_PUBLISHER_LOCALE = "uk";

type LibraryDetailInput = {
  locale: CatalogLocale;
  publisherId: string;
  userId: string;
};

type LibraryListInput = {
  query: LibraryPublishersQuery;
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

type ResolvePublisherInput = {
  id?: string;
  name?: string;
};

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
  ) {}

  async deleteCustom({ publisherId, userId }: OwnedPublisherInput): Promise<void> {
    const publisher = await this.publishersRepository.findById(publisherId);
    if (publisher === null) {
      throw new NotFoundError("Publisher not found");
    }
    if (publisher.userId === null) {
      throw new ForbiddenError();
    }
    if (publisher.userId !== userId) {
      throw new NotFoundError("Publisher not found");
    }

    await this.transactionRunner.run(async (tx) => {
      const linkedBooks = await this.publishersRepository.countBooks(publisherId, tx);
      if (linkedBooks > 0) {
        throw new ConflictError("Publisher still has linked books", {
          code: "PUBLISHER_HAS_BOOKS",
        });
      }
      const deleted = await this.publishersRepository.deleteWithNames(publisherId, tx);
      if (deleted === 0) {
        throw new NotFoundError("Publisher not found");
      }
    });
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
    const { geography, locale, order, pageNumber, pageSize, search, sort, source } = query;
    const filters = { geography, search, source, userId };
    const having = {
      hasBooksToBuy: query.hasBooksToBuy === true,
      hasRatedBooks: query.hasRatedBooks === true,
      hasSeries: query.hasSeries === true,
    };

    const [rows, totalCount] = await Promise.all([
      this.publishersRepository.aggregateLibrary({
        ...filters,
        ...having,
        locale,
        order,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.publishersRepository.countLibrary({ ...filters, ...having }),
    ]);

    return buildPaginator({
      items: rows.map(toLibraryPublisherListItem),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async librarySummary({ userId }: { userId: string }): Promise<LibraryPublishersSummary> {
    const [counts, priceTotals] = await Promise.all([
      this.publishersRepository.summaryCounts(userId),
      this.publishersRepository.summaryPriceTotals(userId),
    ]);
    return toLibraryPublishersSummary({ counts, priceTotals });
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

    const normalizedName = normalizeName(input.name);
    const existing = await this.publishersRepository.findByNormalized(
      userId,
      normalizedName,
      client,
    );
    if (existing !== null) {
      return existing.id;
    }

    const created = await this.publishersRepository.upsertByNormalized(
      {
        locale: CUSTOM_PUBLISHER_LOCALE,
        name: input.name,
        normalizedName,
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
    const publisher = await this.publishersRepository.findById(publisherId);
    if (publisher === null) {
      throw new NotFoundError("Publisher not found");
    }
    if (publisher.userId === null) {
      throw new ForbiddenError();
    }
    if (publisher.userId !== userId) {
      throw new NotFoundError("Publisher not found");
    }

    const rename =
      input.name === undefined
        ? undefined
        : { name: input.name, normalizedName: normalizeName(input.name) };

    if (rename !== undefined) {
      const existing = await this.publishersRepository.findByNormalized(
        userId,
        rename.normalizedName,
      );
      if (existing !== null && existing.id !== publisherId) {
        throw new ConflictError("A publisher with this name already exists", {
          code: "PUBLISHER_DUPLICATE_NAME",
        });
      }
    }

    const updated = await this.runCustomUpdate({ input, publisherId, rename });

    const stats = await this.publishersRepository.aggregateLibraryDetail({
      locale: CUSTOM_PUBLISHER_LOCALE,
      publisherId,
      userId,
    });
    return stats === null
      ? toLibraryPublisherDetailFromModel(updated)
      : toLibraryPublisherDetail(stats);
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
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("A publisher with this name already exists", {
            code: "PUBLISHER_DUPLICATE_NAME",
          }),
      });
    }
  }
}
