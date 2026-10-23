import type {
  BookCharacterImportance,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterGraphView,
  Nullable,
} from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { NetworkGrouping } from "./graph-workspace-params";

import { comparePersonPriority, toDegrees } from "./graph-person-scene";

export const NETWORK_SCENE_BUDGET = {
  clusters: 12,
  membersPerCluster: 12,
  softVisibleMembers: 60,
} as const;

export type NetworkAggregate = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type NetworkBucket = {
  id: string;
  label: NetworkBucketLabel;
  memberIds: readonly string[];
};

export type NetworkBucketLabel =
  | { importance: Nullable<BookCharacterImportance>; kind: "importance" }
  | { index: number; kind: "fragment" }
  | { kind: "group"; name: Nullable<string> }
  | { kind: "ungrouped" };

export type NetworkExpansion = {
  expandedIds: ReadonlySet<string>;
  extraClusters: number;
  extraMembersById: ReadonlyMap<string, number>;
};

export type NetworkScene = {
  aggregates: NetworkAggregate[];
  buckets: NetworkBucket[];
  edges: CharacterGraphEdgeView[];
  effectiveGrouping: NetworkGrouping;
  hasMoreBuckets: boolean;
  moreMembersIds: ReadonlySet<string>;
  nodes: CharacterGraphNodeView[];
  overSoftLimit: boolean;
  shownMembersByBucket: ReadonlyMap<string, readonly string[]>;
  usedFallback: boolean;
};

export const EMPTY_NETWORK_EXPANSION: NetworkExpansion = {
  expandedIds: new Set(),
  extraClusters: 0,
  extraMembersById: new Map(),
};

const CLUSTER_ID = {
  prefix: "cluster",
  unassigned: "unassigned",
  ungrouped: "none",
} as const;

export function buildNetworkScene({
  expansion,
  graph,
  grouping,
}: {
  expansion: NetworkExpansion;
  graph: CharacterGraphView;
  grouping: NetworkGrouping;
}): NetworkScene {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const degreeById = toDegrees(graph.edges);
  const comparePriority = (left: string, right: string) =>
    comparePersonPriority({ degreeById, left, nodeById, right });
  const hasNamedGroups = graph.clusters.some((cluster) => cluster.kind === "group");
  const usedFallback = grouping === "group" && !hasNamedGroups;
  const effectiveGrouping: NetworkGrouping = usedFallback ? "components" : grouping;

  const buckets = toBuckets({ effectiveGrouping, graph })
    .map((bucket) => ({ ...bucket, memberIds: [...bucket.memberIds].sort(comparePriority) }))
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.id.localeCompare(right.id),
    );
  const bucketLimit = NETWORK_SCENE_BUDGET.clusters * (1 + expansion.extraClusters);
  const shownBuckets = buckets.slice(0, bucketLimit);
  const shownBucketIds = new Set(shownBuckets.map((bucket) => bucket.id));

  const bucketByNodeId = new Map<string, string>();
  for (const bucket of buckets) {
    for (const memberId of bucket.memberIds) bucketByNodeId.set(memberId, bucket.id);
  }

  const shownMembersByBucket = new Map<string, readonly string[]>();
  const moreMembersIds = new Set<string>();
  for (const bucket of shownBuckets) {
    if (!expansion.expandedIds.has(bucket.id)) continue;
    const limit =
      NETWORK_SCENE_BUDGET.membersPerCluster *
      (1 + (expansion.extraMembersById.get(bucket.id) ?? 0));
    shownMembersByBucket.set(bucket.id, bucket.memberIds.slice(0, limit));
    if (bucket.memberIds.length > limit) moreMembersIds.add(bucket.id);
  }
  const shownMemberIds = new Set([...shownMembersByBucket.values()].flat());

  const elementOf = (nodeId: string): Nullable<string> => {
    if (shownMemberIds.has(nodeId)) return nodeId;
    const bucketId = bucketByNodeId.get(nodeId);
    return bucketId !== undefined && shownBucketIds.has(bucketId) ? bucketId : null;
  };

  const edges: CharacterGraphEdgeView[] = [];
  const aggregates = new Map<string, NetworkAggregate>();
  for (const edge of graph.edges) {
    const source = elementOf(edge.source);
    const target = elementOf(edge.target);
    if (source === null || target === null || source === target) continue;
    if (source === edge.source && target === edge.target) {
      edges.push(edge);
      continue;
    }
    const [first, second] = source < target ? [source, target] : [target, source];
    const id = `aggregate:${first}:${second}`;
    if (!aggregates.has(id)) aggregates.set(id, { id, sourceId: first, targetId: second });
  }

  return {
    aggregates: [...aggregates.values()].sort((left, right) => left.id.localeCompare(right.id)),
    buckets: shownBuckets,
    edges,
    effectiveGrouping,
    hasMoreBuckets: buckets.length > shownBuckets.length,
    moreMembersIds,
    nodes: [...shownMemberIds]
      .map((id) => nodeById.get(id))
      .filter((node): node is CharacterGraphNodeView => node !== undefined),
    overSoftLimit: shownMemberIds.size > NETWORK_SCENE_BUDGET.softVisibleMembers,
    shownMembersByBucket,
    usedFallback,
  };
}

export function isNetworkClusterId(id: string): boolean {
  return id.startsWith(`${CLUSTER_ID.prefix}:`);
}

export function toggleNetworkCluster({
  bucketId,
  expansion,
}: {
  bucketId: string;
  expansion: NetworkExpansion;
}): NetworkExpansion {
  const expandedIds = new Set(expansion.expandedIds);
  if (expandedIds.has(bucketId)) {
    expandedIds.delete(bucketId);
  } else {
    expandedIds.add(bucketId);
  }
  return { ...expansion, expandedIds };
}

export function withMoreNetworkMembers({
  bucketId,
  expansion,
}: {
  bucketId: string;
  expansion: NetworkExpansion;
}): NetworkExpansion {
  const current = expansion.extraMembersById.get(bucketId) ?? 0;
  return {
    ...expansion,
    extraMembersById: new Map(expansion.extraMembersById).set(bucketId, current + 1),
  };
}

function clusterId(strategy: NetworkGrouping, key: string): string {
  return `${CLUSTER_ID.prefix}:${strategy}:${key}`;
}

function toBuckets({
  effectiveGrouping,
  graph,
}: {
  effectiveGrouping: NetworkGrouping;
  graph: CharacterGraphView;
}): NetworkBucket[] {
  switch (effectiveGrouping) {
    case "components":
      return toComponentBuckets(graph);
    case "group":
      return toGroupBuckets(graph);
    case "importance":
      return toImportanceBuckets(graph);
    default:
      return assertNever(effectiveGrouping);
  }
}

function toComponentBuckets(graph: CharacterGraphView): NetworkBucket[] {
  const parentById = new Map(graph.nodes.map((node) => [node.id, node.id]));
  const find = (id: string): string => {
    let current = id;
    let parent = parentById.get(current) ?? current;
    while (parent !== current) {
      const grandparent = parentById.get(parent) ?? parent;
      parentById.set(current, grandparent);
      current = parent;
      parent = grandparent;
    }
    return current;
  };
  for (const edge of graph.edges) {
    if (!parentById.has(edge.source) || !parentById.has(edge.target)) continue;
    const left = find(edge.source);
    const right = find(edge.target);
    if (left !== right) parentById.set(left < right ? right : left, left < right ? left : right);
  }
  const membersByRoot = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const root = find(node.id);
    membersByRoot.set(root, [...(membersByRoot.get(root) ?? []), node.id]);
  }
  return [...membersByRoot.values()]
    .map((memberIds) => ({ anchor: [...memberIds].sort()[0] ?? "", memberIds }))
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.anchor.localeCompare(right.anchor),
    )
    .map(({ anchor, memberIds }, index): NetworkBucket => ({
      id: clusterId("components", anchor),
      label: { index: index + 1, kind: "fragment" },
      memberIds,
    }));
}

function toGroupBuckets(graph: CharacterGraphView): NetworkBucket[] {
  const nameById = new Map(
    graph.clusters.flatMap((cluster) =>
      cluster.kind === "group" ? [[cluster.id, cluster.name] as const] : [],
    ),
  );
  const membersByKey = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const key =
      node.clusterId !== null && nameById.has(node.clusterId)
        ? node.clusterId
        : CLUSTER_ID.ungrouped;
    membersByKey.set(key, [...(membersByKey.get(key) ?? []), node.id]);
  }
  return [...membersByKey.entries()].map(([key, memberIds]): NetworkBucket => ({
    id: clusterId("group", key.toLowerCase()),
    label:
      key === CLUSTER_ID.ungrouped
        ? { kind: "ungrouped" }
        : { kind: "group", name: nameById.get(key) ?? null },
    memberIds,
  }));
}

function toImportanceBuckets(graph: CharacterGraphView): NetworkBucket[] {
  const membersByKey = new Map<
    string,
    { ids: string[]; importance: Nullable<BookCharacterImportance> }
  >();
  for (const node of graph.nodes) {
    const key = node.importance ?? CLUSTER_ID.unassigned;
    const current = membersByKey.get(key) ?? { ids: [], importance: node.importance };
    current.ids.push(node.id);
    membersByKey.set(key, current);
  }
  return [...membersByKey.entries()].map(([key, entry]): NetworkBucket => ({
    id: clusterId("importance", key),
    label: { importance: entry.importance, kind: "importance" },
    memberIds: entry.ids,
  }));
}
