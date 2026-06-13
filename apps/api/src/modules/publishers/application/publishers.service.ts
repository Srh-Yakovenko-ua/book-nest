import type { Paginator, PublisherSearchPaginationQuery, PublisherView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toPublisherView } from "../domain/publisher.mapper.js";
import { PublishersRepository } from "../infrastructure/publishers.repository.js";

const CUSTOM_PUBLISHER_LOCALE = "uk";

type ResolvePublisherInput = {
  id?: string;
  name?: string;
};

@Injectable()
export class PublishersService {
  constructor(private readonly publishersRepository: PublishersRepository) {}

  async resolveOrCreate(userId: string, input: ResolvePublisherInput): Promise<null | string> {
    if (input.id !== undefined) {
      const publisher = await this.publishersRepository.findVisibleById(userId, input.id);
      if (publisher === null) {
        throw new NotFoundError("Publisher not found");
      }
      return publisher.id;
    }

    if (input.name === undefined) {
      return null;
    }

    const normalizedName = normalizeName(input.name);
    const existing = await this.publishersRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return existing.id;
    }

    try {
      const created = await this.publishersRepository.create(userId, {
        locale: CUSTOM_PUBLISHER_LOCALE,
        name: input.name,
        normalizedName,
      });
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.publishersRepository.findByNormalized(userId, normalizedName);
      if (winner === null) {
        throw error;
      }
      return winner.id;
    }
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
