import type {
  CharacterRelationshipCustomTypesQuery,
  PaginatedCharacterRelationshipCustomTypesView,
} from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { RelationshipCustomTypeFilter } from "../infrastructure/relationship-custom-types.repository.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { toRelationshipCustomTypeView } from "../domain/relationship-custom-type.mapper.js";
import { RelationshipCustomTypesRepository } from "../infrastructure/relationship-custom-types.repository.js";

@Injectable()
export class RelationshipCustomTypesService {
  constructor(private readonly customTypesRepository: RelationshipCustomTypesRepository) {}

  async list({
    query,
    userId,
  }: {
    query: CharacterRelationshipCustomTypesQuery;
    userId: string;
  }): Promise<PaginatedCharacterRelationshipCustomTypesView> {
    const filter: RelationshipCustomTypeFilter = {
      directionality: query.directionality,
      search: query.q === undefined ? undefined : normalizeName(query.q),
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.customTypesRepository.listOwned({
        filter,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.customTypesRepository.countOwned(filter),
    ]);

    return buildPaginator({
      items: rows.map((customType) => toRelationshipCustomTypeView(customType)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }
}
