import type { CharacterGraphNodeView } from "@app/shared";

import type { NetworkBucket, NetworkIndex } from "./graph-network-index";

import { normalizeGenealogyQuery, rankGenealogyName } from "./graph-genealogy-navigation";

export type NetworkSearchResult =
  | { bucket: NetworkBucket; kind: "group" }
  | { bucketId: string; kind: "character"; node: CharacterGraphNodeView }
  | { kind: "blocked"; node: CharacterGraphNodeView };

type SearchMatch = { id: string; label: string; rank: number; result: NetworkSearchResult };

const NETWORK_SEARCH = {
  kindOrder: { blocked: 2, character: 1, group: 0 },
  limit: 30,
  locale: "uk",
} as const;

export function searchNetwork({
  blockedNodes,
  index,
  labelOf,
  query,
}: {
  blockedNodes: readonly CharacterGraphNodeView[];
  index: NetworkIndex;
  labelOf: (bucket: NetworkBucket) => string;
  query: string;
}): NetworkSearchResult[] {
  const needle = normalizeGenealogyQuery(query);
  if (needle.length === 0) return [];
  const groups = index.buckets.map((bucket): SearchMatch => {
    const label = labelOf(bucket);
    return {
      id: bucket.id,
      label,
      rank: rankNames({ names: [label], needle }),
      result: { bucket, kind: "group" },
    };
  });
  const characters = [...index.nodeById.values()].flatMap((node): SearchMatch[] => {
    const bucketId = index.bucketIdByNodeId.get(node.id);
    if (bucketId === undefined) return [];
    return [
      {
        id: node.id,
        label: node.displayName,
        rank: rankNames({ names: [node.displayName, node.name], needle }),
        result: { bucketId, kind: "character", node },
      },
    ];
  });
  const blocked = blockedNodes
    .filter((node) => !index.nodeById.has(node.id))
    .map((node): SearchMatch => ({
      id: node.id,
      label: node.displayName,
      rank: rankNames({ names: [node.displayName, node.name], needle }),
      result: { kind: "blocked", node },
    }));
  return [...groups, ...characters, ...blocked]
    .filter((match) => Number.isFinite(match.rank))
    .sort(compareSearchMatches)
    .slice(0, NETWORK_SEARCH.limit)
    .map((match) => match.result);
}

function compareSearchMatches(left: SearchMatch, right: SearchMatch): number {
  return (
    left.rank - right.rank ||
    NETWORK_SEARCH.kindOrder[left.result.kind] - NETWORK_SEARCH.kindOrder[right.result.kind] ||
    left.label.localeCompare(right.label, NETWORK_SEARCH.locale) ||
    left.id.localeCompare(right.id)
  );
}

function rankNames({ names, needle }: { names: readonly string[]; needle: string }): number {
  return Math.min(
    ...names.map((name) => rankGenealogyName({ name: normalizeGenealogyQuery(name), needle })),
  );
}
