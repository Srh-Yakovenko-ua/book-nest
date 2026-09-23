import type {
  PaginatedTagCatalog,
  TagsCatalogFacetsQuery,
  TagsCatalogFacetsView,
  TagsCatalogQuery,
  TagsSummaryView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { toTagCatalogListItem } from "../domain/tag.mapper.js";
import { buildTagsSummary } from "../domain/tags-summary.js";
import { TagsCatalogRepository } from "../infrastructure/tags-catalog.repository.js";

@Injectable()
export class TagsCatalogService {
  constructor(private readonly tagsCatalogRepository: TagsCatalogRepository) {}

  async facets({
    query,
    userId,
  }: {
    query: TagsCatalogFacetsQuery;
    userId: string;
  }): Promise<TagsCatalogFacetsView> {
    const quickCounts = await this.tagsCatalogRepository.countQuickFilters({
      criteria: query,
      userId,
    });
    return { quickCounts };
  }

  async list({
    query,
    userId,
  }: {
    query: TagsCatalogQuery;
    userId: string;
  }): Promise<PaginatedTagCatalog> {
    const { color, filter, pageNumber, pageSize, q, sort, type } = query;
    const { items, totalCount } = await this.tagsCatalogRepository.list({
      criteria: { color, q, type },
      filter,
      sort,
      userId,
      ...pageSlice({ pageNumber, pageSize }),
    });
    return buildPaginator({
      items: items.map(toTagCatalogListItem),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async summary({ userId }: { userId: string }): Promise<TagsSummaryView> {
    const [aggregate, entityCounts] = await Promise.all([
      this.tagsCatalogRepository.aggregateSummary(userId),
      this.tagsCatalogRepository.countTaggedEntities(userId),
    ]);
    return buildTagsSummary({ aggregate, entityCounts });
  }
}
