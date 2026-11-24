import type {
  BookCharacterImportance,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterGraphView,
  Nullable,
} from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { GraphConnection } from "./graph-connections";
import type { NetworkGrouping } from "./graph-workspace-params";

import { toGraphConnections } from "./graph-connections";

export type NetworkAggregateLink = {
  connectionIds: readonly string[];
  edgeCount: number;
  id: string;
  pairCount: number;
  sourceId: string;
  targetId: string;
};

export type NetworkBucket = {
  id: string;
  key: string;
  label: NetworkBucketLabel;
  memberIds: readonly string[];
};

export type NetworkBucketLabel =
  | { importance: Nullable<BookCharacterImportance>; kind: "importance" }
  | { index: number; kind: "fragment" }
  | { kind: "group"; name: Nullable<string> }
  | { kind: "ungrouped" };

export type NetworkBucketSummary = {
  externalPairCount: number;
  internalPairCount: number;
  linkedBucketCount: number;
};

export type NetworkIndex = {
  bucketById: ReadonlyMap<string, NetworkBucket>;
  bucketIdByNodeId: ReadonlyMap<string, string>;
  bucketLinks: readonly NetworkAggregateLink[];
  buckets: readonly NetworkBucket[];
  connectionById: ReadonlyMap<string, GraphConnection>;
  connectionIdsByNodeId: ReadonlyMap<string, readonly string[]>;
  connections: readonly GraphConnection[];
  edgeById: ReadonlyMap<string, CharacterGraphEdgeView>;
  effectiveGrouping: NetworkGrouping;
  grouping: NetworkGrouping;
  isImportanceUnknown: boolean;
  isSingleComponent: boolean;
  nodeById: ReadonlyMap<string, CharacterGraphNodeView>;
  summaryByBucketId: ReadonlyMap<string, NetworkBucketSummary>;
  totals: { characters: number; groups: number; pairs: number; relations: number };
  usedFallback: boolean;
};

export type NetworkLinkPair = { connection: GraphConnection; leftId: string; rightId: string };

type BucketDraft = { key: string; label: NetworkBucketLabel; memberIds: string[] };

type LinkDraft = { connections: GraphConnection[]; firstId: string; id: string; secondId: string };

type PairTally = {
  externalPairsByNodeId: ReadonlyMap<string, number>;
  internalPairsByBucketId: ReadonlyMap<string, number>;
  linkPairs: readonly NetworkLinkPair[];
};

const NETWORK_INDEX = {
  aggregatePrefix: "aggregate",
  clusterPrefix: "cluster",
  nameLocale: "uk",
  unassignedKey: "unassigned",
  ungroupedKey: "none",
} as const;

export function buildNetworkIndex({
  graph,
  grouping,
}: {
  graph: CharacterGraphView;
  grouping: NetworkGrouping;
}): NetworkIndex {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const connections = toGraphConnections(graph.edges);
  const connectionIdsByNodeId = toConnectionIdsByNodeId(connections);
  const usedFallback =
    grouping === "group" && !graph.clusters.some((cluster) => cluster.kind === "group");
  const effectiveGrouping: NetworkGrouping = usedFallback ? "components" : grouping;
  const drafts = toBucketDrafts({ effectiveGrouping, graph });
  const bucketIdByNodeId = new Map<string, string>();
  for (const draft of drafts) {
    const bucketId = toNetworkBucketId({ grouping: effectiveGrouping, key: draft.key });
    for (const memberId of draft.memberIds) bucketIdByNodeId.set(memberId, bucketId);
  }
  const tally = tallyPairs({ bucketIdByNodeId, connections });
  const compareMembers = toMemberComparator({
    connectionIdsByNodeId,
    externalPairsByNodeId: tally.externalPairsByNodeId,
    nodeById,
  });
  const buckets = drafts
    .map((draft): NetworkBucket => ({
      id: toNetworkBucketId({ grouping: effectiveGrouping, key: draft.key }),
      key: draft.key,
      label: draft.label,
      memberIds: [...draft.memberIds].sort(compareMembers),
    }))
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.id.localeCompare(right.id),
    );
  const bucketLinks = toNetworkAggregateLinks(tally.linkPairs);

  return {
    bucketById: new Map(buckets.map((bucket) => [bucket.id, bucket])),
    bucketIdByNodeId,
    bucketLinks,
    buckets,
    connectionById: new Map(connections.map((connection) => [connection.id, connection])),
    connectionIdsByNodeId,
    connections,
    edgeById: new Map(graph.edges.map((edge) => [edge.id, edge])),
    effectiveGrouping,
    grouping,
    isImportanceUnknown:
      effectiveGrouping === "importance" &&
      graph.nodes.length > 0 &&
      graph.nodes.every(
        (node) =>
          node.importance === null || node.importance === BOOK_CHARACTER_UNSPECIFIED.importance,
      ),
    isSingleComponent: effectiveGrouping === "components" && buckets.length === 1,
    nodeById,
    summaryByBucketId: toBucketSummaries({
      bucketLinks,
      buckets,
      internalPairsByBucketId: tally.internalPairsByBucketId,
    }),
    totals: {
      characters: graph.nodes.length,
      groups: buckets.length,
      pairs: connections.length,
      relations: countEdges(connections),
    },
    usedFallback,
  };
}

export function isNetworkClusterId(id: string): boolean {
  return id.startsWith(`${NETWORK_INDEX.clusterPrefix}:`);
}

export function toNetworkAggregateLinks(pairs: readonly NetworkLinkPair[]): NetworkAggregateLink[] {
  const draftById = new Map<string, LinkDraft>();
  for (const { connection, leftId, rightId } of pairs) {
    const [firstId, secondId] = leftId < rightId ? [leftId, rightId] : [rightId, leftId];
    const id = `${NETWORK_INDEX.aggregatePrefix}:${firstId}:${secondId}`;
    const draft: LinkDraft = draftById.get(id) ?? { connections: [], firstId, id, secondId };
    draft.connections.push(connection);
    draftById.set(id, draft);
  }
  return [...draftById.values()]
    .map((draft): NetworkAggregateLink => ({
      connectionIds: draft.connections
        .map((connection) => connection.id)
        .sort((left, right) => left.localeCompare(right)),
      edgeCount: countEdges(draft.connections),
      id: draft.id,
      pairCount: draft.connections.length,
      sourceId: draft.firstId,
      targetId: draft.secondId,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function toNetworkBucketId({
  grouping,
  key,
}: {
  grouping: NetworkGrouping;
  key: string;
}): string {
  return `${NETWORK_INDEX.clusterPrefix}:${grouping}:${key}`;
}

function countEdges(connections: readonly GraphConnection[]): number {
  return connections.reduce((sum, connection) => sum + connection.edgeIds.length, 0);
}

function tallyPairs({
  bucketIdByNodeId,
  connections,
}: {
  bucketIdByNodeId: ReadonlyMap<string, string>;
  connections: readonly GraphConnection[];
}): PairTally {
  const externalPairsByNodeId = new Map<string, number>();
  const internalPairsByBucketId = new Map<string, number>();
  const linkPairs: NetworkLinkPair[] = [];
  for (const connection of connections) {
    const sourceBucketId = bucketIdByNodeId.get(connection.sourceId);
    const targetBucketId = bucketIdByNodeId.get(connection.targetId);
    if (sourceBucketId === undefined || targetBucketId === undefined) continue;
    if (sourceBucketId === targetBucketId) {
      internalPairsByBucketId.set(
        sourceBucketId,
        (internalPairsByBucketId.get(sourceBucketId) ?? 0) + 1,
      );
      continue;
    }
    for (const nodeId of [connection.sourceId, connection.targetId]) {
      externalPairsByNodeId.set(nodeId, (externalPairsByNodeId.get(nodeId) ?? 0) + 1);
    }
    linkPairs.push({ connection, leftId: sourceBucketId, rightId: targetBucketId });
  }
  return { externalPairsByNodeId, internalPairsByBucketId, linkPairs };
}

function toBucketDrafts({
  effectiveGrouping,
  graph,
}: {
  effectiveGrouping: NetworkGrouping;
  graph: CharacterGraphView;
}): BucketDraft[] {
  switch (effectiveGrouping) {
    case "components":
      return toComponentDrafts(graph);
    case "group":
      return toGroupDrafts(graph);
    case "importance":
      return toImportanceDrafts(graph);
    default:
      return assertNever(effectiveGrouping);
  }
}

function toBucketSummaries({
  bucketLinks,
  buckets,
  internalPairsByBucketId,
}: {
  bucketLinks: readonly NetworkAggregateLink[];
  buckets: readonly NetworkBucket[];
  internalPairsByBucketId: ReadonlyMap<string, number>;
}): Map<string, NetworkBucketSummary> {
  const externalPairs = new Map<string, number>();
  const linkedBuckets = new Map<string, number>();
  for (const link of bucketLinks) {
    for (const bucketId of [link.sourceId, link.targetId]) {
      externalPairs.set(bucketId, (externalPairs.get(bucketId) ?? 0) + link.pairCount);
      linkedBuckets.set(bucketId, (linkedBuckets.get(bucketId) ?? 0) + 1);
    }
  }
  return new Map(
    buckets.map((bucket): [string, NetworkBucketSummary] => [
      bucket.id,
      {
        externalPairCount: externalPairs.get(bucket.id) ?? 0,
        internalPairCount: internalPairsByBucketId.get(bucket.id) ?? 0,
        linkedBucketCount: linkedBuckets.get(bucket.id) ?? 0,
      },
    ]),
  );
}

function toComponentDrafts(graph: CharacterGraphView): BucketDraft[] {
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
    const members = membersByRoot.get(root) ?? [];
    members.push(node.id);
    membersByRoot.set(root, members);
  }
  return [...membersByRoot.values()]
    .map((memberIds) => ({
      anchor: memberIds.reduce((lowest, id) => (id < lowest ? id : lowest)),
      memberIds,
    }))
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.anchor.localeCompare(right.anchor),
    )
    .map(({ anchor, memberIds }, index): BucketDraft => ({
      key: anchor.toLowerCase(),
      label: { index: index + 1, kind: "fragment" },
      memberIds,
    }));
}

function toConnectionIdsByNodeId(connections: readonly GraphConnection[]): Map<string, string[]> {
  const idsByNodeId = new Map<string, string[]>();
  for (const connection of connections) {
    for (const nodeId of [connection.sourceId, connection.targetId]) {
      const ids = idsByNodeId.get(nodeId) ?? [];
      ids.push(connection.id);
      idsByNodeId.set(nodeId, ids);
    }
  }
  return idsByNodeId;
}

function toGroupDrafts(graph: CharacterGraphView): BucketDraft[] {
  const nameById = new Map<string, Nullable<string>>();
  for (const cluster of graph.clusters) {
    if (cluster.kind === "group") nameById.set(cluster.id, cluster.name);
  }
  const draftByKey = new Map<string, BucketDraft>();
  for (const node of graph.nodes) {
    const groupId = node.clusterId !== null && nameById.has(node.clusterId) ? node.clusterId : null;
    const key = groupId === null ? NETWORK_INDEX.ungroupedKey : groupId.toLowerCase();
    const draft: BucketDraft = draftByKey.get(key) ?? {
      key,
      label:
        groupId === null
          ? { kind: "ungrouped" }
          : { kind: "group", name: nameById.get(groupId) ?? null },
      memberIds: [],
    };
    draft.memberIds.push(node.id);
    draftByKey.set(key, draft);
  }
  return [...draftByKey.values()];
}

function toImportanceDrafts(graph: CharacterGraphView): BucketDraft[] {
  const draftByKey = new Map<string, BucketDraft>();
  for (const node of graph.nodes) {
    const key = node.importance ?? NETWORK_INDEX.unassignedKey;
    const draft: BucketDraft = draftByKey.get(key) ?? {
      key,
      label: { importance: node.importance, kind: "importance" },
      memberIds: [],
    };
    draft.memberIds.push(node.id);
    draftByKey.set(key, draft);
  }
  return [...draftByKey.values()];
}

function toMemberComparator({
  connectionIdsByNodeId,
  externalPairsByNodeId,
  nodeById,
}: {
  connectionIdsByNodeId: ReadonlyMap<string, readonly string[]>;
  externalPairsByNodeId: ReadonlyMap<string, number>;
  nodeById: ReadonlyMap<string, CharacterGraphNodeView>;
}): (left: string, right: string) => number {
  const pairsOf = (id: string) => connectionIdsByNodeId.get(id)?.length ?? 0;
  const externalPairsOf = (id: string) => externalPairsByNodeId.get(id) ?? 0;
  const nameOf = (id: string) => nodeById.get(id)?.displayName ?? "";
  return (left, right) =>
    pairsOf(right) - pairsOf(left) ||
    externalPairsOf(right) - externalPairsOf(left) ||
    nameOf(left).localeCompare(nameOf(right), NETWORK_INDEX.nameLocale) ||
    left.localeCompare(right);
}
