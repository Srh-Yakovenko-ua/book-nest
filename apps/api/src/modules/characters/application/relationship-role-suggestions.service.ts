import type {
  CharacterRelationshipRoleSuggestionsQuery,
  PaginatedCharacterRelationshipRoleSuggestionsView,
} from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { RelationshipRoleSuggestionFilter } from "../infrastructure/relationship-role-suggestions.repository.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { toRelationshipRoleSuggestionView } from "../domain/relationship-role-suggestion.mapper.js";
import { RelationshipRoleSuggestionsRepository } from "../infrastructure/relationship-role-suggestions.repository.js";

@Injectable()
export class RelationshipRoleSuggestionsService {
  constructor(private readonly roleSuggestionsRepository: RelationshipRoleSuggestionsRepository) {}

  async list({
    query,
    userId,
  }: {
    query: CharacterRelationshipRoleSuggestionsQuery;
    userId: string;
  }): Promise<PaginatedCharacterRelationshipRoleSuggestionsView> {
    const filter: RelationshipRoleSuggestionFilter = {
      search: query.q === undefined ? undefined : normalizeName(query.q),
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.roleSuggestionsRepository.listOwned({
        filter,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.roleSuggestionsRepository.countOwned(filter),
    ]);

    return buildPaginator({
      items: rows.map((roleSuggestion) => toRelationshipRoleSuggestionView(roleSuggestion)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }
}
