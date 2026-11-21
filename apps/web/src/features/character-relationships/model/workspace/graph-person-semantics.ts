import type { CharacterGraphEdgeView, Nullable, RelationshipCategory } from "@app/shared";

import type { GraphConnection, GraphConnectionDirection } from "./graph-connections";

export const GRAPH_PERSON_LABELS = {
  maxRootPairs: 8,
} as const;

export type GraphCharacterReach = {
  neighbors: number;
  relationships: number;
};

export type GraphPairEntry = {
  connection: GraphConnection;
  firstId: string;
  involvesRoot: boolean;
  secondId: string;
};

export type GraphPairSemantics = {
  direction: GraphConnectionDirection;
  relationshipCount: number;
  singleEdge: Nullable<CharacterGraphEdgeView>;
  tone: GraphPairTone;
};

export type GraphPairTone = "masked" | "mixed" | RelationshipCategory;

export function filterGraphPairEntries({
  entries,
  nameOf,
  query,
}: {
  entries: readonly GraphPairEntry[];
  nameOf: (id: string) => string;
  query: string;
}): GraphPairEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return [...entries];
  return entries.filter((entry) =>
    [entry.firstId, entry.secondId].some((id) => nameOf(id).toLocaleLowerCase().includes(needle)),
  );
}

export function isMaskedGraphEdge(edge: CharacterGraphEdgeView): boolean {
  return edge.typeHidden || edge.type === null || edge.category === null;
}

export function toGraphCharacterReach({
  characterId,
  connections,
}: {
  characterId: string;
  connections: readonly GraphConnection[];
}): GraphCharacterReach {
  const neighbors = new Set<string>();
  let relationships = 0;
  for (const connection of connections) {
    const otherId = otherEndOf({ characterId, connection });
    if (otherId === null || otherId === characterId) continue;
    neighbors.add(otherId);
    relationships += connection.edgeIds.length;
  }
  return { neighbors: neighbors.size, relationships };
}

export function toGraphPairEntries({
  connections,
  nameOf,
  rootId,
}: {
  connections: readonly GraphConnection[];
  nameOf: (id: string) => string;
  rootId: Nullable<string>;
}): GraphPairEntry[] {
  return connections
    .map((connection): GraphPairEntry => {
      const involvesRoot =
        rootId !== null && (connection.sourceId === rootId || connection.targetId === rootId);
      if (involvesRoot) {
        const otherId = connection.sourceId === rootId ? connection.targetId : connection.sourceId;
        return { connection, firstId: rootId, involvesRoot, secondId: otherId };
      }
      const [firstId, secondId] =
        compareNames(nameOf(connection.sourceId), nameOf(connection.targetId)) <= 0
          ? [connection.sourceId, connection.targetId]
          : [connection.targetId, connection.sourceId];
      return { connection, firstId, involvesRoot, secondId };
    })
    .sort(
      (left, right) =>
        Number(right.involvesRoot) - Number(left.involvesRoot) ||
        (left.involvesRoot ? 0 : compareNames(nameOf(left.firstId), nameOf(right.firstId))) ||
        compareNames(nameOf(left.secondId), nameOf(right.secondId)) ||
        left.connection.id.localeCompare(right.connection.id),
    );
}

export function toGraphPairSemantics({
  connection,
  edgeById,
}: {
  connection: GraphConnection;
  edgeById: ReadonlyMap<string, CharacterGraphEdgeView>;
}): GraphPairSemantics {
  const edges = connection.edgeIds.flatMap((id) => {
    const edge = edgeById.get(id);
    return edge === undefined ? [] : [edge];
  });
  const isMasked =
    connection.hasMaskedSemantics || edges.length === 0 || edges.some(isMaskedGraphEdge);
  const [first] = edges;
  return {
    direction: connection.direction,
    relationshipCount: edges.length,
    singleEdge: !isMasked && edges.length === 1 && first !== undefined ? first : null,
    tone: isMasked ? "masked" : toVisibleTone({ direction: connection.direction, edges }),
  };
}

export function toGraphPairSemanticsById({
  connections,
  edges,
}: {
  connections: readonly GraphConnection[];
  edges: readonly CharacterGraphEdgeView[];
}): ReadonlyMap<string, GraphPairSemantics> {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge] as const));
  return new Map(
    connections.map(
      (connection) => [connection.id, toGraphPairSemantics({ connection, edgeById })] as const,
    ),
  );
}

export function toGraphPersonLabelPairIds({
  connections,
  rootId,
  semantics,
}: {
  connections: readonly GraphConnection[];
  rootId: string;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
}): ReadonlySet<string> {
  const rootPairs = connections.filter(
    (connection) => connection.sourceId === rootId || connection.targetId === rootId,
  );
  if (rootPairs.length > GRAPH_PERSON_LABELS.maxRootPairs) return new Set();
  return new Set(
    rootPairs
      .filter((connection) => semantics.get(connection.id)?.tone !== "masked")
      .map((connection) => connection.id),
  );
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function otherEndOf({
  characterId,
  connection,
}: {
  characterId: string;
  connection: GraphConnection;
}): Nullable<string> {
  if (connection.sourceId === characterId) return connection.targetId;
  if (connection.targetId === characterId) return connection.sourceId;
  return null;
}

function toVisibleTone({
  direction,
  edges,
}: {
  direction: GraphConnectionDirection;
  edges: readonly CharacterGraphEdgeView[];
}): GraphPairTone {
  const categories = new Set(edges.map((edge) => edge.category));
  const [category] = categories;
  if (categories.size !== 1 || category === undefined || category === null) return "mixed";
  return edges.length > 1 && direction.kind === "mixed" ? "mixed" : category;
}
