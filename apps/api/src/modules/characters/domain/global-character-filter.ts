import type { CharactersListQuery } from "@app/shared";

import { normalizeSearch } from "@app/shared";

import type { GlobalCharacterFilter } from "../infrastructure/characters.repository.js";

export function toGlobalFilter({
  duplicateNormalizedNames,
  query,
  userId,
}: {
  duplicateNormalizedNames: string[] | undefined;
  query: CharactersListQuery;
  userId: string;
}): GlobalCharacterFilter {
  return {
    archived: query.archived ?? false,
    attitudes: query.attitude,
    bookId: query.bookId,
    contextBookId: query.contextBookId,
    duplicateNormalizedNames,
    favorite: query.favorite,
    genders: query.gender,
    groupIds: query.groupId,
    hasSpoilers: query.hasSpoilers,
    importances: query.importance,
    includeHiddenProfiles: query.includeHiddenProfiles ?? false,
    includeSpoilerSearch: query.includeSpoilerSearch ?? false,
    roleTypes: query.role,
    search: normalizeSearch(query.q),
    seriesId: query.seriesId,
    species: query.species,
    tagIds: query.tagId,
    userId,
  };
}
