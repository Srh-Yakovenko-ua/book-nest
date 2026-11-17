import type {
  BookDetailsView,
  CharacterGraphView,
  FamilyTreeGraphView,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import type { BookCharacterGraphControllerGetParams } from "@/shared/api/generated/model";

import { assertNever } from "@/lib/assert-never";

import type { GraphWorkspaceParams } from "./graph-workspace-params";

export type GraphReaderKey = {
  currentPage: Nullable<number>;
  finishedAt: Nullable<string>;
  readingStatus: string;
};

export type GraphWorkspaceFilters = {
  categories: RelationshipCategory[];
  types: RelationshipType[];
};

export type GraphWorkspacePathRequest = GraphWorkspaceFilters & {
  fromId: string;
  kind: "path";
  toId: string;
};

export type GraphWorkspaceSceneData =
  { graph: CharacterGraphView; kind: "graph" } | { kind: "tree"; tree: FamilyTreeGraphView };

export type GraphWorkspaceSceneRequest =
  | { ancestors: number; descendants: number; focusCharacterId: string; kind: "tree" }
  | {
      depth: number;
      filters: GraphWorkspaceFilters;
      focusCharacterId: string;
      kind: "person";
    }
  | { filters: GraphWorkspaceFilters; kind: "network" };

export function toBookGraphRequestParams(
  request: GraphWorkspaceSceneRequest,
): BookCharacterGraphControllerGetParams {
  switch (request.kind) {
    case "network":
      return { clusterBy: "group", mode: "all", ...toFilterParams(request.filters) };
    case "person":
      return {
        depth: request.depth,
        focusCharacterId: request.focusCharacterId,
        mode: "all",
        ...toFilterParams(request.filters),
      };
    case "tree":
      return {
        ancestors: request.ancestors,
        descendants: request.descendants,
        focusCharacterId: request.focusCharacterId,
        projection: "family_tree",
      };
    default:
      return assertNever(request);
  }
}

export function toGraphReaderKey(book: BookDetailsView): GraphReaderKey {
  return {
    currentPage: book.readingProgress?.currentPage ?? null,
    finishedAt: book.readingProgress?.finishedAt ?? null,
    readingStatus: book.readingStatus,
  };
}

export function toGraphWorkspacePathRequest(
  params: GraphWorkspaceParams,
): Nullable<GraphWorkspacePathRequest> {
  if (!params.path || params.from === null || params.to === null || params.from === params.to) {
    return null;
  }
  return {
    categories: params.categories,
    fromId: params.from,
    kind: "path",
    toId: params.to,
    types: params.types,
  };
}

export function toGraphWorkspaceSceneRequest(
  params: GraphWorkspaceParams,
): Nullable<GraphWorkspaceSceneRequest> {
  if (params.path) return null;
  const filters = { categories: params.categories, types: params.types };
  switch (params.view) {
    case "network":
      return { filters, kind: "network" };
    case "person":
      return params.characterId === null
        ? null
        : { depth: params.depth, filters, focusCharacterId: params.characterId, kind: "person" };
    case "tree":
      return params.characterId === null
        ? null
        : {
            ancestors: params.treeUp,
            descendants: params.treeDown,
            focusCharacterId: params.characterId,
            kind: "tree",
          };
    default:
      return assertNever(params.view);
  }
}

function toFilterParams(filters: GraphWorkspaceFilters) {
  return {
    ...(filters.categories.length === 0 ? {} : { categories: filters.categories }),
    ...(filters.types.length === 0 ? {} : { relationshipTypes: filters.types }),
  };
}
