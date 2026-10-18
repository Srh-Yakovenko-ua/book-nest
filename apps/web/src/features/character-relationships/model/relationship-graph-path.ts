import type { CharacterGraphNodeView, CharacterRelationshipPathView, Nullable } from "@app/shared";

import type { RelationshipGraphFilters } from "./relationship-graph-criteria";

export type RelationshipGraphEmphasis = "default" | "dimmed" | "path";

export type RelationshipGraphPathEndpoints = {
  fromId: Nullable<string>;
  toId: Nullable<string>;
};

export type RelationshipGraphPathQuery = RelationshipGraphPathEndpoints & {
  contextBookId: Nullable<string>;
  filters: RelationshipGraphFilters;
};

export type RelationshipGraphPathRequest = {
  contextBookId: string;
  filters: RelationshipGraphFilters;
  fromId: string;
  toId: string;
};

export type RelationshipGraphPathState =
  | {
      edgeIds: ReadonlySet<string>;
      kind: "found";
      nodeIds: ReadonlySet<string>;
      steps: CharacterGraphNodeView[];
    }
  | { kind: "error" }
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "sameCharacter" }
  | { kind: "unavailable" };

export const RELATIONSHIP_GRAPH_PATH = {
  emptyEndpoints: { fromId: null, toId: null },
} satisfies { emptyEndpoints: RelationshipGraphPathEndpoints };

export function toRelationshipGraphEmphasis({
  highlighted,
  id,
}: {
  highlighted: Nullable<ReadonlySet<string>>;
  id: string;
}): RelationshipGraphEmphasis {
  if (highlighted === null) return "default";
  return highlighted.has(id) ? "path" : "dimmed";
}

export function toRelationshipGraphPathRequest(
  query: RelationshipGraphPathQuery,
): Nullable<RelationshipGraphPathRequest> {
  const { contextBookId, filters, fromId, toId } = query;
  if (contextBookId === null || fromId === null || toId === null || fromId === toId) return null;
  return { contextBookId, filters, fromId, toId };
}

export function toRelationshipGraphPathState({
  path,
  query,
}: {
  path: { data: CharacterRelationshipPathView | undefined; isError: boolean };
  query: RelationshipGraphPathQuery;
}): RelationshipGraphPathState {
  if (query.contextBookId === null) return { kind: "unavailable" };
  if (query.fromId === null || query.toId === null) return { kind: "idle" };
  if (query.fromId === query.toId) return { kind: "sameCharacter" };
  if (path.isError) return { kind: "error" };
  if (path.data === undefined) return { kind: "loading" };
  if (!path.data.found) return { kind: "notFound" };
  return {
    edgeIds: new Set(path.data.edges.map((edge) => edge.id)),
    kind: "found",
    nodeIds: new Set(path.data.nodes.map((node) => node.id)),
    steps: path.data.nodes,
  };
}

export function toVisibleRelationshipGraphEndpoints({
  endpoints,
  nodeIds,
}: {
  endpoints: RelationshipGraphPathEndpoints;
  nodeIds: ReadonlySet<string>;
}): RelationshipGraphPathEndpoints {
  return {
    fromId: endpoints.fromId !== null && nodeIds.has(endpoints.fromId) ? endpoints.fromId : null,
    toId: endpoints.toId !== null && nodeIds.has(endpoints.toId) ? endpoints.toId : null,
  };
}
