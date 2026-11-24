import type { Nullable, RelationshipCategory } from "@app/shared";

import type { GraphConnection } from "./graph-connections";
import type {
  NetworkAggregateLink,
  NetworkBucket,
  NetworkIndex,
  NetworkLinkPair,
} from "./graph-network-index";

import { toNetworkAggregateLinks } from "./graph-network-index";

export const NETWORK_SCENE_BUDGET = {
  clusters: 12,
  focusMembers: 12,
  focusNeighbors: 10,
} as const;

export type NetworkExpansion = { extraClusters: number; focus: NetworkFocusExpansion };

export type NetworkFocusExpansion = {
  bucketId: Nullable<string>;
  pages: number;
  revealedIds: readonly string[];
};

export type NetworkScene =
  | {
      bucket: NetworkBucket;
      connections: readonly GraphConnection[];
      hasMoreMembers: boolean;
      hiddenMemberCount: number;
      hiddenNeighborCount: number;
      kind: "focus";
      links: readonly NetworkAggregateLink[];
      memberIds: readonly string[];
      neighbors: readonly NetworkBucket[];
    }
  | {
      buckets: readonly NetworkBucket[];
      hasMoreBuckets: boolean;
      hiddenBucketCount: number;
      kind: "overview";
      links: readonly NetworkAggregateLink[];
    };

type FocusPairTally = {
  connectionIds: ReadonlySet<string>;
  linkPairs: readonly NetworkLinkPair[];
  neighborPairs: ReadonlyMap<string, { shown: number; total: number }>;
};

export const EMPTY_NETWORK_EXPANSION: NetworkExpansion = {
  extraClusters: 0,
  focus: { bucketId: null, pages: 0, revealedIds: [] },
};

export function buildNetworkScene({
  expansion,
  focusBucketId,
  index,
}: {
  expansion: NetworkExpansion;
  focusBucketId: Nullable<string>;
  index: NetworkIndex;
}): NetworkScene {
  const bucket = focusBucketId === null ? undefined : index.bucketById.get(focusBucketId);
  if (bucket === undefined) return buildOverviewScene({ expansion, index });
  return buildFocusScene({ bucket, expansion, index });
}

export function summarizeNetworkLink({
  index,
  link,
}: {
  index: NetworkIndex;
  link: NetworkAggregateLink;
}): {
  categories: readonly { category: RelationshipCategory; count: number }[];
  hasMaskedDetails: boolean;
} {
  const countByCategory = new Map<RelationshipCategory, number>();
  let hasMaskedDetails = false;
  for (const connectionId of link.connectionIds) {
    for (const edgeId of index.connectionById.get(connectionId)?.edgeIds ?? []) {
      const edge = index.edgeById.get(edgeId);
      if (edge === undefined) continue;
      if (edge.typeHidden || edge.category === null) {
        hasMaskedDetails = true;
        continue;
      }
      countByCategory.set(edge.category, (countByCategory.get(edge.category) ?? 0) + 1);
    }
  }
  return {
    categories: [...countByCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort(
        (left, right) => right.count - left.count || left.category.localeCompare(right.category),
      ),
    hasMaskedDetails,
  };
}

export function toNetworkLinkExplore({
  bucketId,
  index,
  link,
}: {
  bucketId: string;
  index: NetworkIndex;
  link: NetworkAggregateLink;
}): Nullable<{ bucketId: string; revealIds: readonly string[] }> {
  if (bucketId !== link.sourceId && bucketId !== link.targetId) return null;
  const bucket = index.bucketById.get(bucketId);
  if (bucket === undefined) return null;
  const pairsByMemberId = new Map<string, number>();
  for (const connectionId of link.connectionIds) {
    const connection = index.connectionById.get(connectionId);
    if (connection === undefined) continue;
    for (const nodeId of [connection.sourceId, connection.targetId]) {
      if (index.bucketIdByNodeId.get(nodeId) !== bucketId) continue;
      pairsByMemberId.set(nodeId, (pairsByMemberId.get(nodeId) ?? 0) + 1);
    }
  }
  const revealIds = bucket.memberIds
    .map((id, order) => ({ id, order, pairs: pairsByMemberId.get(id) ?? 0 }))
    .filter((member) => member.pairs > 0)
    .sort((left, right) => right.pairs - left.pairs || left.order - right.order)
    .slice(0, NETWORK_SCENE_BUDGET.focusMembers)
    .map((member) => member.id);
  return { bucketId, revealIds };
}

export function withMoreNetworkMembers(expansion: NetworkExpansion): NetworkExpansion {
  return { ...expansion, focus: { ...expansion.focus, pages: expansion.focus.pages + 1 } };
}

export function withNetworkFocus({
  bucketId,
  expansion,
  revealIds = [],
}: {
  bucketId: Nullable<string>;
  expansion: NetworkExpansion;
  revealIds?: readonly string[];
}): NetworkExpansion {
  const isSameBucket = expansion.focus.bucketId === bucketId;
  const focus: NetworkFocusExpansion = isSameBucket
    ? expansion.focus
    : { bucketId, pages: 0, revealedIds: [] };
  const knownIds = new Set(focus.revealedIds);
  const addedIds: string[] = [];
  for (const id of revealIds) {
    if (knownIds.has(id)) continue;
    knownIds.add(id);
    addedIds.push(id);
  }
  if (isSameBucket && addedIds.length === 0) return expansion;
  return { ...expansion, focus: { ...focus, revealedIds: [...focus.revealedIds, ...addedIds] } };
}

function buildFocusScene({
  bucket,
  expansion,
  index,
}: {
  bucket: NetworkBucket;
  expansion: NetworkExpansion;
  index: NetworkIndex;
}): NetworkScene {
  const memberIds = toShownMemberIds({ bucket, expansion, index });
  const tally = tallyFocusPairs({ bucket, index, shownIds: new Set(memberIds) });
  const rankedNeighbors = [...tally.neighborPairs.entries()]
    .sort(
      ([leftId, left], [rightId, right]) =>
        right.shown - left.shown || right.total - left.total || leftId.localeCompare(rightId),
    )
    .flatMap(([bucketId]) => {
      const neighbor = index.bucketById.get(bucketId);
      return neighbor === undefined ? [] : [neighbor];
    });
  const neighbors = rankedNeighbors.slice(0, NETWORK_SCENE_BUDGET.focusNeighbors);
  const neighborIds = new Set(neighbors.map((neighbor) => neighbor.id));
  const hiddenMemberCount = bucket.memberIds.length - memberIds.length;
  return {
    bucket,
    connections: [...tally.connectionIds]
      .sort((left, right) => left.localeCompare(right))
      .flatMap((connectionId) => {
        const connection = index.connectionById.get(connectionId);
        return connection === undefined ? [] : [connection];
      }),
    hasMoreMembers: hiddenMemberCount > 0,
    hiddenMemberCount,
    hiddenNeighborCount: rankedNeighbors.length - neighbors.length,
    kind: "focus",
    links: toNetworkAggregateLinks(tally.linkPairs.filter((pair) => neighborIds.has(pair.rightId))),
    memberIds,
    neighbors,
  };
}

function buildOverviewScene({
  expansion,
  index,
}: {
  expansion: NetworkExpansion;
  index: NetworkIndex;
}): NetworkScene {
  const buckets = index.buckets.slice(
    0,
    NETWORK_SCENE_BUDGET.clusters * (1 + expansion.extraClusters),
  );
  const shownIds = new Set(buckets.map((bucket) => bucket.id));
  const hiddenBucketCount = index.buckets.length - buckets.length;
  return {
    buckets,
    hasMoreBuckets: hiddenBucketCount > 0,
    hiddenBucketCount,
    kind: "overview",
    links: index.bucketLinks.filter(
      (link) => shownIds.has(link.sourceId) && shownIds.has(link.targetId),
    ),
  };
}

function tallyFocusPairs({
  bucket,
  index,
  shownIds,
}: {
  bucket: NetworkBucket;
  index: NetworkIndex;
  shownIds: ReadonlySet<string>;
}): FocusPairTally {
  const connectionIds = new Set<string>();
  const linkPairs: NetworkLinkPair[] = [];
  const neighborPairs = new Map<string, { shown: number; total: number }>();
  for (const memberId of bucket.memberIds) {
    const isShown = shownIds.has(memberId);
    for (const connectionId of index.connectionIdsByNodeId.get(memberId) ?? []) {
      const connection = index.connectionById.get(connectionId);
      if (connection === undefined) continue;
      const otherId = connection.sourceId === memberId ? connection.targetId : connection.sourceId;
      const otherBucketId = index.bucketIdByNodeId.get(otherId);
      if (otherBucketId === undefined) continue;
      if (otherBucketId === bucket.id) {
        if (isShown && shownIds.has(otherId)) connectionIds.add(connectionId);
        continue;
      }
      const pairs = neighborPairs.get(otherBucketId) ?? { shown: 0, total: 0 };
      neighborPairs.set(otherBucketId, {
        shown: pairs.shown + (isShown ? 1 : 0),
        total: pairs.total + 1,
      });
      if (!isShown) continue;
      linkPairs.push({ connection, leftId: memberId, rightId: otherBucketId });
    }
  }
  return { connectionIds, linkPairs, neighborPairs };
}

function toShownMemberIds({
  bucket,
  expansion,
  index,
}: {
  bucket: NetworkBucket;
  expansion: NetworkExpansion;
  index: NetworkIndex;
}): string[] {
  const focus =
    expansion.focus.bucketId === bucket.id ? expansion.focus : EMPTY_NETWORK_EXPANSION.focus;
  const memberIds = bucket.memberIds.slice(
    0,
    NETWORK_SCENE_BUDGET.focusMembers * (1 + focus.pages),
  );
  const shownIds = new Set(memberIds);
  for (const id of focus.revealedIds) {
    if (shownIds.has(id) || index.bucketIdByNodeId.get(id) !== bucket.id) continue;
    shownIds.add(id);
    memberIds.push(id);
  }
  return memberIds;
}
