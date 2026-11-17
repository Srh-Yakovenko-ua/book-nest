import type { CharacterGraphEdgeView, CharacterGraphNodeView, Nullable } from "@app/shared";

import { BookCharacterImportanceSchema } from "@app/shared";

export const PERSON_SCENE_BUDGET = {
  firstRing: 12,
  nextRings: 8,
  softVisibleLimit: 60,
} as const;

export type PersonBranchState = "collapsed" | "expanded";

export type PersonExpansion = {
  branches: ReadonlyMap<string, PersonBranchState>;
  extraByHop: ReadonlyMap<number, number>;
};

export type PersonScene = {
  edges: CharacterGraphEdgeView[];
  expandableIds: ReadonlySet<string>;
  hopById: ReadonlyMap<string, number>;
  moreByHop: ReadonlySet<number>;
  nodes: CharacterGraphNodeView[];
  overSoftLimit: boolean;
  rootId: string;
};

export const EMPTY_PERSON_EXPANSION: PersonExpansion = {
  branches: new Map(),
  extraByHop: new Map(),
};

export function buildPersonScene({
  edges,
  expansion,
  nodes,
  rootId,
}: {
  edges: readonly CharacterGraphEdgeView[];
  expansion: PersonExpansion;
  nodes: readonly CharacterGraphNodeView[];
  rootId: string;
}): Nullable<PersonScene> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeById.has(rootId)) return null;
  const adjacency = toAdjacency(edges);
  const hopById = toHopDistances({ adjacency, rootId });
  const degreeById = toDegrees(edges);
  const compare = (left: string, right: string) =>
    comparePersonPriority({ degreeById, left, nodeById, right });

  const visible = new Set<string>([rootId]);
  const moreByHop = new Set<number>();
  const maxHop = Math.max(0, ...hopById.values());

  for (let hop = 1; hop <= maxHop; hop += 1) {
    const offeredBy = new Map<string, string[]>();
    for (const [id, distance] of hopById) {
      if (distance !== hop) continue;
      const parents = (adjacency.get(id) ?? []).filter(
        (neighbor) =>
          visible.has(neighbor) &&
          hopById.get(neighbor) === hop - 1 &&
          expansion.branches.get(neighbor) !== "collapsed",
      );
      if (parents.length > 0) offeredBy.set(id, parents);
    }
    const candidates = [...offeredBy.keys()].sort(compare);
    const budget =
      (hop === 1 ? PERSON_SCENE_BUDGET.firstRing : PERSON_SCENE_BUDGET.nextRings) *
      (1 + (expansion.extraByHop.get(hop) ?? 0));
    let sampled = 0;
    for (const id of candidates) {
      const forced = (offeredBy.get(id) ?? []).some(
        (parent) => expansion.branches.get(parent) === "expanded",
      );
      if (forced) {
        visible.add(id);
      } else if (sampled < budget) {
        visible.add(id);
        sampled += 1;
      } else {
        moreByHop.add(hop);
      }
    }
  }

  const expandableIds = new Set(
    [...visible].filter((id) => {
      const hop = hopById.get(id) ?? 0;
      return (adjacency.get(id) ?? []).some(
        (neighbor) => hopById.get(neighbor) === hop + 1 && !visible.has(neighbor),
      );
    }),
  );

  return {
    edges: edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)),
    expandableIds,
    hopById,
    moreByHop,
    nodes: [...visible]
      .map((id) => nodeById.get(id))
      .filter((node): node is CharacterGraphNodeView => node !== undefined),
    overSoftLimit: visible.size > PERSON_SCENE_BUDGET.softVisibleLimit,
    rootId,
  };
}

export function comparePersonPriority({
  degreeById,
  left,
  nodeById,
  right,
}: {
  degreeById: ReadonlyMap<string, number>;
  left: string;
  nodeById: ReadonlyMap<string, CharacterGraphNodeView>;
  right: string;
}): number {
  const leftNode = nodeById.get(left);
  const rightNode = nodeById.get(right);
  return (
    importanceRank(leftNode) - importanceRank(rightNode) ||
    (degreeById.get(right) ?? 0) - (degreeById.get(left) ?? 0) ||
    (leftNode?.displayName ?? "").localeCompare(rightNode?.displayName ?? "") ||
    left.localeCompare(right)
  );
}

export function toAdjacency(
  edges: readonly CharacterGraphEdgeView[],
): ReadonlyMap<string, readonly string[]> {
  const adjacency = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    const neighbors = adjacency.get(from) ?? new Set<string>();
    neighbors.add(to);
    adjacency.set(from, neighbors);
  };
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }
  return new Map(
    [...adjacency.entries()].map(([id, neighbors]) => [id, [...neighbors].sort()] as const),
  );
}

export function toDegrees(edges: readonly CharacterGraphEdgeView[]): ReadonlyMap<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

export function withPersonBranch({
  expansion,
  nodeId,
  state,
}: {
  expansion: PersonExpansion;
  nodeId: string;
  state: PersonBranchState;
}): PersonExpansion {
  return { ...expansion, branches: new Map(expansion.branches).set(nodeId, state) };
}

export function withPersonMore({
  expansion,
  hop,
}: {
  expansion: PersonExpansion;
  hop: number;
}): PersonExpansion {
  const current = expansion.extraByHop.get(hop) ?? 0;
  return { ...expansion, extraByHop: new Map(expansion.extraByHop).set(hop, current + 1) };
}

function importanceRank(node: CharacterGraphNodeView | undefined): number {
  const options = BookCharacterImportanceSchema.options;
  if (node?.importance === undefined || node.importance === null) return options.length;
  return options.indexOf(node.importance);
}

function toHopDistances({
  adjacency,
  rootId,
}: {
  adjacency: ReadonlyMap<string, readonly string[]>;
  rootId: string;
}): ReadonlyMap<string, number> {
  const hopById = new Map<string, number>([[rootId, 0]]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const hop = hopById.get(id) ?? 0;
      for (const neighbor of adjacency.get(id) ?? []) {
        if (hopById.has(neighbor)) continue;
        hopById.set(neighbor, hop + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return hopById;
}
