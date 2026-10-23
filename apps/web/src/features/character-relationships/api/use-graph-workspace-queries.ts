import {
  type CharacterDetailsView,
  CharacterDetailsViewSchema,
  CharacterGraphViewSchema,
  type CharacterRelationshipPathView,
  CharacterRelationshipPathViewSchema,
  FamilyTreeGraphViewSchema,
  type Nullable,
} from "@app/shared";
import { skipToken, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/http-client";
import {
  bookCharacterGraphControllerGet,
  characterRelationshipsControllerFindPath,
} from "@/shared/api/generated/endpoints/character-relationships/character-relationships";
import { bookCharactersControllerGetById } from "@/shared/api/generated/endpoints/characters/characters";

import type { RelationshipParticipant } from "../model/relationship-form-schema";
import type {
  GraphReaderKey,
  GraphWorkspacePathRequest,
  GraphWorkspaceSceneData,
  GraphWorkspaceSceneRequest,
} from "../model/workspace/graph-workspace-request";

import { toBookGraphRequestParams } from "../model/workspace/graph-workspace-request";
import { relationshipKeys } from "./relationship-keys";

const GRAPH_WORKSPACE_QUERY = {
  clientErrorStatusMax: 499,
  clientErrorStatusMin: 400,
  staleTimeMs: 0,
  transientRetries: 1,
  windowFocusRefetch: "always",
} as const;

const EMPTY_READER: GraphReaderKey = { currentPage: null, finishedAt: null, readingStatus: "" };

const EMPTY_PATH_REQUEST: GraphWorkspacePathRequest = {
  categories: [],
  fromId: "",
  kind: "path",
  toId: "",
  types: [],
};

export type GraphWorkspaceEndpoint =
  { kind: "unavailable" } | { kind: "valid"; participant: RelationshipParticipant };

type GraphWorkspaceQueryScope = {
  bookId: string;
  reader: Nullable<GraphReaderKey>;
};

export function isGraphWorkspaceNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useGraphWorkspaceEndpoint({
  bookId,
  characterId,
  reader,
}: GraphWorkspaceQueryScope & { characterId: Nullable<string> }) {
  const ready = reader !== null && characterId !== null;
  return useQuery({
    queryFn: ready
      ? async ({ signal }): Promise<GraphWorkspaceEndpoint> =>
          loadEndpoint({ bookId, characterId, signal })
      : skipToken,
    queryKey: relationshipKeys.workspace({
      bookId,
      reader: reader ?? EMPTY_READER,
      request: { characterId: characterId ?? "", kind: "endpoint" },
    }),
    refetchOnWindowFocus: GRAPH_WORKSPACE_QUERY.windowFocusRefetch,
    retry: retryTransientOnly,
    staleTime: GRAPH_WORKSPACE_QUERY.staleTimeMs,
  });
}

export function useGraphWorkspacePath({
  bookId,
  reader,
  request,
}: GraphWorkspaceQueryScope & { request: Nullable<GraphWorkspacePathRequest> }) {
  return useQuery({
    queryFn:
      reader === null || request === null
        ? skipToken
        : async ({ signal }): Promise<CharacterRelationshipPathView> =>
            CharacterRelationshipPathViewSchema.parse(
              await characterRelationshipsControllerFindPath(
                {
                  contextBookId: bookId,
                  fromId: request.fromId,
                  mode: "all",
                  toId: request.toId,
                  ...(request.categories.length === 0 ? {} : { categories: request.categories }),
                  ...(request.types.length === 0 ? {} : { relationshipTypes: request.types }),
                },
                { signal },
              ),
            ),
    queryKey: relationshipKeys.workspace({
      bookId,
      reader: reader ?? EMPTY_READER,
      request: request ?? EMPTY_PATH_REQUEST,
    }),
    refetchOnWindowFocus: GRAPH_WORKSPACE_QUERY.windowFocusRefetch,
    retry: retryTransientOnly,
    staleTime: GRAPH_WORKSPACE_QUERY.staleTimeMs,
  });
}

export function useGraphWorkspaceScene({
  bookId,
  reader,
  request,
}: GraphWorkspaceQueryScope & { request: Nullable<GraphWorkspaceSceneRequest> }) {
  return useQuery({
    queryFn:
      reader === null || request === null
        ? skipToken
        : async ({ signal }): Promise<GraphWorkspaceSceneData> => {
            const response = await bookCharacterGraphControllerGet(
              bookId,
              toBookGraphRequestParams(request),
              { signal },
            );
            return request.kind === "tree"
              ? { kind: "tree", tree: FamilyTreeGraphViewSchema.parse(response) }
              : { graph: CharacterGraphViewSchema.parse(response), kind: "graph" };
          },
    queryKey: relationshipKeys.workspace({
      bookId,
      reader: reader ?? EMPTY_READER,
      request: request ?? { filters: { categories: [], types: [] }, kind: "network" },
    }),
    refetchOnWindowFocus: GRAPH_WORKSPACE_QUERY.windowFocusRefetch,
    retry: retryTransientOnly,
    staleTime: GRAPH_WORKSPACE_QUERY.staleTimeMs,
  });
}

async function loadEndpoint({
  bookId,
  characterId,
  signal,
}: {
  bookId: string;
  characterId: string;
  signal: AbortSignal;
}): Promise<GraphWorkspaceEndpoint> {
  try {
    const details = CharacterDetailsViewSchema.parse(
      await bookCharactersControllerGetById(bookId, characterId, undefined, { signal }),
    );
    return { kind: "valid", participant: toEndpointParticipant({ bookId, details }) };
  } catch (error) {
    if (isGraphWorkspaceNotFound(error)) return { kind: "unavailable" };
    throw error;
  }
}

function retryTransientOnly(failureCount: number, error: unknown): boolean {
  const isClientError =
    error instanceof ApiError &&
    error.status >= GRAPH_WORKSPACE_QUERY.clientErrorStatusMin &&
    error.status <= GRAPH_WORKSPACE_QUERY.clientErrorStatusMax;
  return !isClientError && failureCount < GRAPH_WORKSPACE_QUERY.transientRetries;
}

function toEndpointParticipant({
  bookId,
  details,
}: {
  bookId: string;
  details: CharacterDetailsView;
}): RelationshipParticipant {
  const appearance = details.appearances.find((entry) => entry.bookId === bookId);
  const displayName = appearance?.displayName?.trim() ?? "";
  const media = appearance?.portrait ?? details.avatar;
  return {
    avatarUrl: media?.urls.thumb ?? null,
    id: details.id,
    name: displayName.length > 0 ? displayName : details.name,
  };
}
