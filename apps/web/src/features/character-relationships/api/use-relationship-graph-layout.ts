import {
  type CharacterGraphLayoutView,
  CharacterGraphLayoutViewSchema,
  type CharacterGraphPositions,
  type CharacterGraphViewport,
  type Nullable,
} from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CharacterGraphLayoutsControllerGetParams } from "@/shared/api/generated/model";

import { ApiError } from "@/lib/http-client";
import {
  characterGraphLayoutsControllerGet,
  characterGraphLayoutsControllerRemove,
  characterGraphLayoutsControllerSave,
} from "@/shared/api/generated/endpoints/character-graph-layouts/character-graph-layouts";

import type { RelationshipGraphLayoutKey } from "../model/relationship-graph-scope";

import { relationshipKeys } from "./relationship-keys";

const LAYOUT_MISSING_STATUS = 404;

export type RelationshipGraphLayoutSnapshot = {
  layoutVersion: string;
  positions: CharacterGraphPositions;
  viewport: CharacterGraphViewport;
};

export function useRelationshipGraphLayout(
  layoutKey: RelationshipGraphLayoutKey,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const queryKey = relationshipKeys.graphLayout(layoutKey);
  const params = toLayoutKeyParams(layoutKey);

  const layout = useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<Nullable<CharacterGraphLayoutView>> => {
      try {
        return CharacterGraphLayoutViewSchema.parse(
          await characterGraphLayoutsControllerGet(params, { signal }),
        );
      } catch (error) {
        if (isLayoutMissing(error)) return null;
        throw error;
      }
    },
    queryKey,
    retry: false,
  });

  const save = useMutation({
    mutationFn: async (
      snapshot: RelationshipGraphLayoutSnapshot,
    ): Promise<CharacterGraphLayoutView> =>
      CharacterGraphLayoutViewSchema.parse(
        await characterGraphLayoutsControllerSave({ ...layoutKey, ...snapshot }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  const remove = useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await characterGraphLayoutsControllerRemove(params);
      } catch (error) {
        if (!isLayoutMissing(error)) throw error;
      }
    },
    onSuccess: () => queryClient.setQueryData(queryKey, null),
  });

  return { layout, remove, save };
}

function isLayoutMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === LAYOUT_MISSING_STATUS;
}

function toLayoutKeyParams({
  contextBookId,
  mode,
  scopeId,
  scopeType,
}: RelationshipGraphLayoutKey): CharacterGraphLayoutsControllerGetParams {
  return { mode, scopeId, scopeType, ...(contextBookId === null ? {} : { contextBookId }) };
}
