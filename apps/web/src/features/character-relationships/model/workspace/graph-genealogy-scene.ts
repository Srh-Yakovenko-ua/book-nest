import type {
  BookFamilyTreeView,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  Nullable,
} from "@app/shared";

import type { TreeEdgeEntry, TreeLineageLink, TreeOptions } from "./graph-tree-scene";

import { anchorTreeSideRelatives, toTreeEdgeEntries } from "./graph-tree-scene";

export const GENEALOGY_SCENE = {
  balancePasses: 8,
  dominantHouseShare: 1 / 3,
} as const;

export type GenealogyComponent = {
  houseId: Nullable<string>;
  id: string;
  memberIds: readonly string[];
  titleId: string;
};

export type GenealogyExpansion = {
  collapsedIds: ReadonlySet<string>;
};

export type GenealogyHouse = {
  id: string;
  memberIds: readonly string[];
  name: Nullable<string>;
  size: number;
};

export type GenealogyScene = {
  childCountById: ReadonlyMap<string, number>;
  collapsedIds: ReadonlySet<string>;
  componentIdById: ReadonlyMap<string, string>;
  components: readonly GenealogyComponent[];
  edges: CharacterGraphEdgeView[];
  entryByEdgeId: ReadonlyMap<string, TreeEdgeEntry>;
  generationById: ReadonlyMap<string, number>;
  hasConflicts: boolean;
  hasMultiLineLinks: boolean;
  hiddenCount: number;
  hiddenDescendantsById: ReadonlyMap<string, number>;
  houseIdById: ReadonlyMap<string, string>;
  houses: readonly GenealogyHouse[];
  lineage: readonly TreeLineageLink[];
  nodes: CharacterGraphNodeView[];
  reachableIds: ReadonlySet<string>;
  rootId: null;
  rowById: ReadonlyMap<string, number>;
  sideAnchorById: ReadonlyMap<string, string>;
};

export const EMPTY_GENEALOGY_EXPANSION: GenealogyExpansion = { collapsedIds: new Set() };

type LineageIndex = {
  childrenById: ReadonlyMap<string, readonly string[]>;
  parentsById: ReadonlyMap<string, readonly string[]>;
};

export function buildGenealogyScene({
  expansion,
  options,
  tree,
}: {
  expansion: GenealogyExpansion;
  options: TreeOptions;
  tree: BookFamilyTreeView;
}): GenealogyScene {
  const nodeById = new Map(tree.nodes.map((node) => [node.id, node] as const));
  const allLineage = tree.lineage
    .filter((link) => nodeById.has(link.parentId) && nodeById.has(link.childId))
    .map((link): TreeLineageLink => ({
      childId: link.childId,
      edgeId: link.relationshipId,
      kind: link.kind,
      parentId: link.parentId,
    }));
  const index = indexGenealogyLineage(allLineage);
  const collapsedIds = new Set(
    [...expansion.collapsedIds].filter((id) => (index.childrenById.get(id)?.length ?? 0) > 0),
  );
  const hiddenIds = toCollapsedHiddenIds({ collapsedIds, index });
  const isShown = (id: string) => !hiddenIds.has(id);
  const lineage = allLineage.filter((link) => isShown(link.parentId) && isShown(link.childId));
  const enabled = toTreeEdgeEntries({ edges: tree.edges, lineage: allLineage }).filter(
    (entry) => entry.kind !== "auxiliary" || options[entry.group],
  );
  const entries = enabled.filter(
    (entry) => isShown(entry.edge.source) && isShown(entry.edge.target),
  );
  const aligned = alignLineageComponents({
    entries: enabled,
    generationById: toGenealogyGenerations(allLineage),
  });
  const full = anchorWithSeeds({ entries: enabled, rows: aligned });
  const fullComponentIdById = toComponentIds({ entries: enabled, ids: [...full.rowById.keys()] });
  const fullRows = normalizeRows({ componentIdById: fullComponentIdById, rowById: full.rowById });
  const generationById = new Map(
    [...aligned.keys()].flatMap((id) => {
      const row = fullRows.get(id);
      return row === undefined || !isShown(id) ? [] : [[id, row] as const];
    }),
  );
  const { rowById: normalizedRows, sideAnchorById } = anchorWithSeeds({
    entries,
    rows: generationById,
  });
  const componentIdById = new Map(
    [...normalizedRows.keys()].map((id) => [id, fullComponentIdById.get(id) ?? id] as const),
  );
  const visibleEntries = entries.filter(
    (entry) => normalizedRows.has(entry.edge.source) && normalizedRows.has(entry.edge.target),
  );
  const nodes = tree.nodes.filter((node) => normalizedRows.has(node.id));
  const houseIds = new Set(tree.houses.map((house) => house.id));
  const houseIdById = new Map(
    nodes.flatMap((node) =>
      node.clusterId !== null && houseIds.has(node.clusterId)
        ? [[node.id, node.clusterId] as const]
        : [],
    ),
  );

  return {
    childCountById: new Map(
      [...index.childrenById].map(([id, children]) => [id, children.length] as const),
    ),
    collapsedIds,
    componentIdById,
    components: toComponents({
      componentIdById,
      generationById,
      houseIdById,
      index,
      nodeById,
    }),
    edges: visibleEntries.map((entry) => entry.edge),
    entryByEdgeId: new Map(visibleEntries.map((entry) => [entry.edge.id, entry] as const)),
    generationById,
    hasConflicts:
      tree.diagnostics.length > 0 || visibleEntries.some((entry) => entry.kind === "conflict"),
    hasMultiLineLinks: lineage.some(
      (link) =>
        (normalizedRows.get(link.childId) ?? 0) - (normalizedRows.get(link.parentId) ?? 0) > 1,
    ),
    hiddenCount: Math.max(0, fullRows.size - normalizedRows.size),
    hiddenDescendantsById: new Map(
      [...collapsedIds].flatMap((id) =>
        hiddenIds.has(id) ? [] : [[id, countHiddenDescendants({ hiddenIds, id, index })] as const],
      ),
    ),
    houseIdById,
    houses: tree.houses.map((house) => ({
      id: house.id,
      memberIds: nodes
        .filter((node) => houseIdById.get(node.id) === house.id)
        .map((node) => node.id),
      name: house.name,
      size: house.size,
    })),
    lineage,
    nodes,
    reachableIds: new Set(fullRows.keys()),
    rootId: null,
    rowById: normalizedRows,
    sideAnchorById: new Map([...sideAnchorById].filter(([sideId]) => normalizedRows.has(sideId))),
  };
}

export function indexGenealogyLineage(lineage: readonly TreeLineageLink[]): LineageIndex {
  const childrenById = new Map<string, string[]>();
  const parentsById = new Map<string, string[]>();
  for (const link of lineage) {
    const children = childrenById.get(link.parentId) ?? [];
    if (!children.includes(link.childId)) children.push(link.childId);
    childrenById.set(link.parentId, children);
    const parents = parentsById.get(link.childId) ?? [];
    if (!parents.includes(link.parentId)) parents.push(link.parentId);
    parentsById.set(link.childId, parents);
  }
  for (const list of [...childrenById.values(), ...parentsById.values()]) list.sort();
  return { childrenById, parentsById };
}

export function toCollapsedHiddenIds({
  collapsedIds,
  index,
}: {
  collapsedIds: ReadonlySet<string>;
  index: LineageIndex;
}): ReadonlySet<string> {
  const hidden = new Set<string>();
  if (collapsedIds.size === 0) return hidden;
  const unit = withCoParents({ collapsedIds, index });
  const descendants = new Set<string>();
  const queue = [...collapsedIds];
  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const childId of index.childrenById.get(current) ?? []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push(childId);
    }
  }
  const candidates = [...descendants].sort();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of candidates) {
      if (hidden.has(id)) continue;
      const parents = index.parentsById.get(id) ?? [];
      const blocked = parents.every((parentId) => unit.has(parentId) || hidden.has(parentId));
      if (parents.length === 0 || !blocked) continue;
      hidden.add(id);
      changed = true;
    }
  }
  return hidden;
}

export function toGenealogyGenerations(
  lineage: readonly TreeLineageLink[],
): ReadonlyMap<string, number> {
  const { childrenById, parentsById } = indexGenealogyLineage(lineage);
  const ids = [...new Set(lineage.flatMap((link) => [link.parentId, link.childId]))].sort();
  const order = toTopologicalOrder({ childrenById, ids, parentsById });
  const generation = new Map<string, number>();
  const known = (relatives: readonly string[]) =>
    relatives.flatMap((relativeId) => {
      const value = generation.get(relativeId);
      return value === undefined ? [] : [value];
    });
  for (const id of order) {
    const parents = known(parentsById.get(id) ?? []);
    generation.set(id, parents.length === 0 ? 0 : Math.max(...parents) + 1);
  }
  const hasChildren = (id: string) => (childrenById.get(id)?.length ?? 0) > 0;
  for (const id of [...order].reverse()) {
    const lines = known((childrenById.get(id) ?? []).filter(hasChildren));
    if (lines.length > 0) generation.set(id, Math.min(...lines) - 1);
  }
  for (const id of order) {
    if (hasChildren(id)) continue;
    const parents = known(parentsById.get(id) ?? []);
    if (parents.length > 0) generation.set(id, Math.max(...parents) + 1);
  }
  for (const id of order) {
    if ((parentsById.get(id)?.length ?? 0) > 0) continue;
    const children = known(childrenById.get(id) ?? []);
    if (children.length > 0) generation.set(id, Math.min(...children) - 1);
  }
  for (let pass = 0; pass < GENEALOGY_SCENE.balancePasses; pass += 1) {
    const sequence = pass % 2 === 0 ? [...order].reverse() : order;
    let changed = false;
    for (const id of sequence) {
      const next = toBalancedGeneration({ childrenById, generation, id, parentsById });
      if (next === null || next === generation.get(id)) continue;
      generation.set(id, next);
      changed = true;
    }
    if (!changed) break;
  }
  const componentIdById = toComponentIdsFromPairs({
    ids,
    pairs: lineage.map((link) => [link.parentId, link.childId] as const),
  });
  const minimumByComponent = new Map<string, number>();
  for (const [id, value] of generation) {
    const component = componentIdById.get(id) ?? id;
    minimumByComponent.set(component, Math.min(minimumByComponent.get(component) ?? value, value));
  }
  return new Map(
    [...generation].map(
      ([id, value]) =>
        [id, value - (minimumByComponent.get(componentIdById.get(id) ?? id) ?? 0)] as const,
    ),
  );
}

export function withCoParents({
  collapsedIds,
  index,
}: {
  collapsedIds: ReadonlySet<string>;
  index: LineageIndex;
}): ReadonlySet<string> {
  const unit = new Set(collapsedIds);
  for (const id of collapsedIds) {
    for (const childId of index.childrenById.get(id) ?? []) {
      for (const parentId of index.parentsById.get(childId) ?? []) unit.add(parentId);
    }
  }
  return unit;
}

function alignLineageComponents({
  entries,
  generationById,
}: {
  entries: readonly TreeEdgeEntry[];
  generationById: ReadonlyMap<string, number>;
}): ReadonlyMap<string, number> {
  const lineagePairs = entries.flatMap((entry) =>
    entry.kind === "lineage" ? [[entry.parentId, entry.childId] as const] : [],
  );
  const ids = [...generationById.keys()].sort();
  const componentIdById = toComponentIdsFromPairs({ ids, pairs: lineagePairs });
  const sizeByComponent = new Map<string, number>();
  for (const component of componentIdById.values()) {
    sizeByComponent.set(component, (sizeByComponent.get(component) ?? 0) + 1);
  }
  const bridges = entries
    .filter((entry) => entry.kind !== "lineage")
    .flatMap((entry) => {
      const { source, target } = entry.edge;
      const sourceComponent = componentIdById.get(source);
      const targetComponent = componentIdById.get(target);
      const sourceGeneration = generationById.get(source);
      const targetGeneration = generationById.get(target);
      if (
        sourceComponent === undefined ||
        targetComponent === undefined ||
        sourceGeneration === undefined ||
        targetGeneration === undefined ||
        sourceComponent === targetComponent
      ) {
        return [];
      }
      return [{ sourceComponent, sourceGeneration, targetComponent, targetGeneration }];
    });
  const seeds = [...sizeByComponent.keys()].sort(
    (left, right) =>
      (sizeByComponent.get(right) ?? 0) - (sizeByComponent.get(left) ?? 0) ||
      left.localeCompare(right),
  );
  const offsetByComponent = new Map<string, number>();
  for (const seed of seeds) {
    if (offsetByComponent.has(seed)) continue;
    offsetByComponent.set(seed, 0);
    const queue = [seed];
    while (queue.length > 0) {
      const current = queue.shift() ?? seed;
      const base = offsetByComponent.get(current) ?? 0;
      for (const bridge of bridges) {
        const forward = bridge.sourceComponent === current;
        const backward = bridge.targetComponent === current;
        if (!forward && !backward) continue;
        const other = forward ? bridge.targetComponent : bridge.sourceComponent;
        if (offsetByComponent.has(other)) continue;
        const delta = bridge.sourceGeneration - bridge.targetGeneration;
        offsetByComponent.set(other, forward ? base + delta : base - delta);
        queue.push(other);
      }
    }
  }
  return new Map(
    [...generationById].map(
      ([id, value]) =>
        [id, value + (offsetByComponent.get(componentIdById.get(id) ?? id) ?? 0)] as const,
    ),
  );
}

function anchorWithSeeds({
  entries,
  rows,
}: {
  entries: readonly TreeEdgeEntry[];
  rows: ReadonlyMap<string, number>;
}): { rowById: ReadonlyMap<string, number>; sideAnchorById: ReadonlyMap<string, string> } {
  const endpoints = [
    ...new Set(entries.flatMap((entry) => [entry.edge.source, entry.edge.target])),
  ].sort();
  const anchored = anchorTreeSideRelatives({ entries, generationById: rows });
  const pending = endpoints.filter((id) => !anchored.rowById.has(id));
  if (pending.length === 0) return anchored;
  const pendingIds = new Set(pending);
  const seeds = new Set(
    toComponentIdsFromPairs({
      ids: pending,
      pairs: entries.flatMap((entry) =>
        pendingIds.has(entry.edge.source) && pendingIds.has(entry.edge.target)
          ? [[entry.edge.source, entry.edge.target] as const]
          : [],
      ),
    }).values(),
  );
  const seeded = new Map(anchored.rowById);
  for (const seed of seeds) seeded.set(seed, 0);
  const completed = anchorTreeSideRelatives({ entries, generationById: seeded });
  return {
    rowById: completed.rowById,
    sideAnchorById: new Map([...anchored.sideAnchorById, ...completed.sideAnchorById]),
  };
}

function countDescendants({ id, index }: { id: string; index: LineageIndex }): number {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() ?? id;
    for (const childId of index.childrenById.get(current) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      queue.push(childId);
    }
  }
  return seen.size;
}

function countHiddenDescendants({
  hiddenIds,
  id,
  index,
}: {
  hiddenIds: ReadonlySet<string>;
  id: string;
  index: LineageIndex;
}): number {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() ?? id;
    for (const childId of index.childrenById.get(current) ?? []) {
      if (!hiddenIds.has(childId) || seen.has(childId)) continue;
      seen.add(childId);
      queue.push(childId);
    }
  }
  return seen.size;
}

function normalizeRows({
  componentIdById,
  rowById,
}: {
  componentIdById: ReadonlyMap<string, string>;
  rowById: ReadonlyMap<string, number>;
}): ReadonlyMap<string, number> {
  const minimumByComponent = new Map<string, number>();
  for (const [id, row] of rowById) {
    const component = componentIdById.get(id) ?? id;
    minimumByComponent.set(component, Math.min(minimumByComponent.get(component) ?? row, row));
  }
  return new Map(
    [...rowById].map(
      ([id, row]) =>
        [id, row - (minimumByComponent.get(componentIdById.get(id) ?? id) ?? 0)] as const,
    ),
  );
}

function toBalancedGeneration({
  childrenById,
  generation,
  id,
  parentsById,
}: {
  childrenById: ReadonlyMap<string, readonly string[]>;
  generation: ReadonlyMap<string, number>;
  id: string;
  parentsById: ReadonlyMap<string, readonly string[]>;
}): Nullable<number> {
  const valuesOf = (ids: readonly string[]) =>
    ids.flatMap((other) => {
      const value = generation.get(other);
      return value === undefined ? [] : [value];
    });
  const parents = valuesOf(parentsById.get(id) ?? []);
  const children = valuesOf(childrenById.get(id) ?? []);
  const desired = [
    ...parents.map((value) => value + 1),
    ...children.map((value) => value - 1),
  ].sort((left, right) => left - right);
  const median = desired[Math.floor((desired.length - 1) / 2)];
  if (median === undefined) return null;
  const lowest = parents.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...parents) + 1;
  const highest = children.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...children) - 1;
  if (lowest > highest) return null;
  return Math.min(Math.max(median, lowest), highest);
}

function toComponentIds({
  entries,
  ids,
}: {
  entries: readonly TreeEdgeEntry[];
  ids: readonly string[];
}): ReadonlyMap<string, string> {
  return toComponentIdsFromPairs({
    ids,
    pairs: entries.map((entry) => [entry.edge.source, entry.edge.target] as const),
  });
}

function toComponentIdsFromPairs({
  ids,
  pairs,
}: {
  ids: readonly string[];
  pairs: readonly (readonly [string, string])[];
}): ReadonlyMap<string, string> {
  const parent = new Map(ids.map((id) => [id, id] as const));
  const find = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current) ?? current;
    return current;
  };
  for (const [left, right] of pairs) {
    if (!parent.has(left) || !parent.has(right)) continue;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) continue;
    const [keep, drop] = leftRoot < rightRoot ? [leftRoot, rightRoot] : [rightRoot, leftRoot];
    parent.set(drop, keep);
  }
  return new Map(ids.map((id) => [id, find(id)] as const));
}

function toComponents({
  componentIdById,
  generationById,
  houseIdById,
  index,
  nodeById,
}: {
  componentIdById: ReadonlyMap<string, string>;
  generationById: ReadonlyMap<string, number>;
  houseIdById: ReadonlyMap<string, string>;
  index: LineageIndex;
  nodeById: ReadonlyMap<string, CharacterGraphNodeView>;
}): GenealogyComponent[] {
  const membersByComponent = new Map<string, string[]>();
  for (const [id, component] of componentIdById) {
    membersByComponent.set(component, [...(membersByComponent.get(component) ?? []), id]);
  }
  return [...membersByComponent]
    .map(([id, members]): GenealogyComponent => {
      const memberIds = [...members].sort();
      return {
        houseId: toDominantHouse({ houseIdById, memberIds }),
        id,
        memberIds,
        titleId: toTitleMember({ generationById, index, memberIds, nodeById }),
      };
    })
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.id.localeCompare(right.id),
    );
}

function toDominantHouse({
  houseIdById,
  memberIds,
}: {
  houseIdById: ReadonlyMap<string, string>;
  memberIds: readonly string[];
}): Nullable<string> {
  const countByHouse = new Map<string, number>();
  for (const id of memberIds) {
    const house = houseIdById.get(id);
    if (house !== undefined) countByHouse.set(house, (countByHouse.get(house) ?? 0) + 1);
  }
  const [best] = [...countByHouse].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  if (best === undefined) return null;
  return best[1] >= memberIds.length * GENEALOGY_SCENE.dominantHouseShare ? best[0] : null;
}

function toTitleMember({
  generationById,
  index,
  memberIds,
  nodeById,
}: {
  generationById: ReadonlyMap<string, number>;
  index: LineageIndex;
  memberIds: readonly string[];
  nodeById: ReadonlyMap<string, CharacterGraphNodeView>;
}): string {
  const ranked = memberIds
    .map((id) => ({
      descendants: countDescendants({ id, index }),
      generation: generationById.get(id) ?? Number.POSITIVE_INFINITY,
      id,
      name: nodeById.get(id)?.displayName ?? id,
    }))
    .sort(
      (left, right) =>
        left.generation - right.generation ||
        right.descendants - left.descendants ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    );
  return ranked[0]?.id ?? memberIds[0] ?? "";
}

function toTopologicalOrder({
  childrenById,
  ids,
  parentsById,
}: {
  childrenById: ReadonlyMap<string, readonly string[]>;
  ids: readonly string[];
  parentsById: ReadonlyMap<string, readonly string[]>;
}): string[] {
  const pending = new Map(ids.map((id) => [id, parentsById.get(id)?.length ?? 0] as const));
  const queue = ids.filter((id) => pending.get(id) === 0);
  const order: string[] = [];
  const placed = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() ?? "";
    order.push(id);
    placed.add(id);
    for (const childId of childrenById.get(id) ?? []) {
      const remaining = (pending.get(childId) ?? 0) - 1;
      pending.set(childId, remaining);
      if (remaining === 0) queue.push(childId);
    }
  }
  return [...order, ...ids.filter((id) => !placed.has(id))];
}
