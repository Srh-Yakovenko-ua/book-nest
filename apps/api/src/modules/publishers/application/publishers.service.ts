import type {
  CatalogLocale,
  Paginator,
  PublisherSearchPaginationQuery,
  PublisherView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { toPublisherView } from "../domain/publisher.mapper.js";
import { PublishersRepository } from "../infrastructure/publishers.repository.js";

const CUSTOM_PUBLISHER_LOCALE = "uk";

type RecentPublishersInput = {
  limit: number;
  locale: CatalogLocale;
  userId: string;
};

type ResolvePublisherInput = {
  id?: string;
  name?: string;
};

@Injectable()
export class PublishersService {
  constructor(private readonly publishersRepository: PublishersRepository) {}

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
  ): Promise<null | string> {
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
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
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
}
