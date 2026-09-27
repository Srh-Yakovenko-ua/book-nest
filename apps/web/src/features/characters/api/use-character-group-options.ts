import { PaginatedCharacterGroupSummarySchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CharacterGroupsControllerListParams } from "@/shared/api/generated/model";

import { characterGroupsControllerList } from "@/shared/api/generated/endpoints/character-groups/character-groups";

import { characterKeys } from "./character-keys";

const GROUP_OPTIONS_PAGE_SIZE = 50;

export function useCharacterGroupOptions(enabled: boolean) {
  const params: CharacterGroupsControllerListParams = { pageSize: GROUP_OPTIONS_PAGE_SIZE };

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      PaginatedCharacterGroupSummarySchema.parse(await characterGroupsControllerList(params)),
    queryKey: characterKeys.groupOptions(params),
  });
}
