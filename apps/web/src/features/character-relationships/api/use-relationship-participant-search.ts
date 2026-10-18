import type { Nullable } from "@app/shared";

import {
  PaginatedBookCharacterRosterSchema,
  PaginatedCharacterGlobalSummarySchema,
} from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  bookCharactersControllerList,
  charactersControllerList,
} from "@/shared/api/generated/endpoints/characters/characters";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

import { relationshipKeys } from "./relationship-keys";

export const RELATIONSHIP_PARTICIPANT_SEARCH = {
  minQueryLength: 2,
  pageSize: 20,
  sort: "name",
} as const;

type UseRelationshipParticipantSearchArgs = {
  bookId: Nullable<string>;
  enabled: boolean;
  excludedIds: readonly string[];
  query: string;
};

export function useRelationshipParticipantSearch({
  bookId,
  enabled,
  excludedIds,
  query,
}: UseRelationshipParticipantSearchArgs) {
  const isSearching = query.length >= RELATIONSHIP_PARTICIPANT_SEARCH.minQueryLength;
  const search = isSearching ? query : undefined;
  const searchKey = search ?? "";

  const bookRoster = useQuery({
    enabled: enabled && bookId !== null,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<RelationshipParticipant[]> => {
      if (bookId === null) return [];
      const page = PaginatedBookCharacterRosterSchema.parse(
        await bookCharactersControllerList(
          bookId,
          {
            pageNumber: 1,
            pageSize: RELATIONSHIP_PARTICIPANT_SEARCH.pageSize,
            search,
            sort: RELATIONSHIP_PARTICIPANT_SEARCH.sort,
          },
          { signal },
        ),
      );
      return page.items.map((item) => ({
        avatarUrl: (item.portrait ?? item.avatar)?.urls.thumb ?? null,
        id: item.characterId,
        name: item.displayName ?? item.name,
      }));
    },
    queryKey: relationshipKeys.participants({ bookId, pool: "book", query: searchKey }),
  });

  const allCharacters = useQuery({
    enabled: enabled && (isSearching || bookId === null),
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<RelationshipParticipant[]> => {
      const page = PaginatedCharacterGlobalSummarySchema.parse(
        await charactersControllerList(
          {
            pageNumber: 1,
            pageSize: RELATIONSHIP_PARTICIPANT_SEARCH.pageSize,
            q: search,
            sort: RELATIONSHIP_PARTICIPANT_SEARCH.sort,
          },
          { signal },
        ),
      );
      return page.items.map((item) => ({
        avatarUrl: item.avatar?.urls.thumb ?? null,
        id: item.id,
        name: item.name,
      }));
    },
    queryKey: relationshipKeys.participants({ bookId: null, pool: "global", query: searchKey }),
  });

  const excluded = new Set(excludedIds);
  const bookMatches = (bookRoster.data ?? []).filter((character) => !excluded.has(character.id));
  const listed = new Set([...excluded, ...bookMatches.map((character) => character.id)]);
  const otherMatches = (allCharacters.data ?? []).filter((character) => !listed.has(character.id));

  return {
    bookMatches,
    isError: bookRoster.isError || allCharacters.isError,
    isFetching: bookRoster.isFetching || allCharacters.isFetching,
    isSearching,
    otherMatches,
  };
}
