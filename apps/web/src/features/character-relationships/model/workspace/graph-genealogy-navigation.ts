import type { CharacterGraphNodeView } from "@app/shared";

import type { GenealogyExpansion } from "./graph-genealogy-scene";
import type { TreeLineageLink } from "./graph-tree-scene";

import { indexGenealogyLineage } from "./graph-genealogy-scene";

export const GENEALOGY_SEARCH = {
  limit: 8,
  maxQueryLength: 80,
} as const;

const SEARCH_RANK = {
  contains: 2,
  prefix: 0,
  wordPrefix: 1,
} as const;

export function normalizeGenealogyQuery(value: string): string {
  return value
    .slice(0, GENEALOGY_SEARCH.maxQueryLength)
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function revealGenealogyCharacter({
  expansion,
  id,
  lineage,
}: {
  expansion: GenealogyExpansion;
  id: string;
  lineage: readonly TreeLineageLink[];
}): GenealogyExpansion {
  if (expansion.collapsedIds.size === 0) return expansion;
  const { parentsById } = indexGenealogyLineage(lineage);
  const ancestors = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() ?? id;
    for (const parentId of parentsById.get(current) ?? []) {
      if (ancestors.has(parentId)) continue;
      ancestors.add(parentId);
      queue.push(parentId);
    }
  }
  const collapsedIds = new Set(
    [...expansion.collapsedIds].filter((collapsedId) => !ancestors.has(collapsedId)),
  );
  return collapsedIds.size === expansion.collapsedIds.size ? expansion : { collapsedIds };
}

export function searchGenealogyCharacters({
  nodes,
  query,
}: {
  nodes: readonly CharacterGraphNodeView[];
  query: string;
}): CharacterGraphNodeView[] {
  const needle = normalizeGenealogyQuery(query);
  if (needle.length === 0) return [];
  return nodes
    .flatMap((node) => {
      const rank = Math.min(
        rankName({ name: normalizeGenealogyQuery(node.displayName), needle }),
        rankName({ name: normalizeGenealogyQuery(node.name), needle }),
      );
      return Number.isFinite(rank) ? [{ node, rank }] : [];
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.node.displayName.localeCompare(right.node.displayName) ||
        left.node.id.localeCompare(right.node.id),
    )
    .slice(0, GENEALOGY_SEARCH.limit)
    .map((match) => match.node);
}

export function toggleGenealogyBranch({
  expansion,
  id,
}: {
  expansion: GenealogyExpansion;
  id: string;
}): GenealogyExpansion {
  const collapsedIds = new Set(expansion.collapsedIds);
  if (collapsedIds.has(id)) {
    collapsedIds.delete(id);
  } else {
    collapsedIds.add(id);
  }
  return { collapsedIds };
}

function rankName({ name, needle }: { name: string; needle: string }): number {
  if (name.startsWith(needle)) return SEARCH_RANK.prefix;
  if (name.split(" ").some((word) => word.startsWith(needle))) return SEARCH_RANK.wordPrefix;
  return name.includes(needle) ? SEARCH_RANK.contains : Number.POSITIVE_INFINITY;
}
