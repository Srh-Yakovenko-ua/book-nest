import type { Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";
import type { GraphConnection } from "./graph-connections";
import type { TreePairSemantics } from "./graph-tree-pairs";
import type { TreeScene } from "./graph-tree-scene";

export const TREE_LAYOUT = {
  gap: { member: 28, unit: 64 },
  node: {
    default: { height: 64, width: 212 },
    root: { height: 84, width: 272 },
  },
  passes: 6,
  revision: "family-1",
  rowStep: 152,
} as const;

export type TreeLayout = {
  arcPairIds: ReadonlySet<string>;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  rows: readonly TreeLayoutRow[];
};

export type TreeLayoutRow = {
  generation: Nullable<number>;
  row: number;
  y: number;
};

export function layoutTreeScene({
  connections,
  pairs,
  scene,
}: {
  connections: readonly GraphConnection[];
  pairs: ReadonlyMap<string, TreePairSemantics>;
  scene: TreeScene;
}): TreeLayout {
  const visibleIds = scene.nodes.map((node) => node.id).sort();
  const parentsById = new Map<string, string[]>();
  const childrenById = new Map<string, string[]>();
  for (const link of scene.lineage) {
    if (!scene.rowById.has(link.parentId) || !scene.rowById.has(link.childId)) continue;
    parentsById.set(link.childId, [...(parentsById.get(link.childId) ?? []), link.parentId]);
    childrenById.set(link.parentId, [...(childrenById.get(link.parentId) ?? []), link.childId]);
  }
  const units = toUnits({ childrenById, connections, pairs, scene, visibleIds });
  const rowNumbers = [...new Set(visibleIds.map((id) => scene.rowById.get(id) ?? 0))].sort(
    (left, right) => left - right,
  );
  const order = new Map<number, string[]>(
    rowNumbers.map((row) => [
      row,
      visibleIds
        .filter((id) => (scene.rowById.get(id) ?? 0) === row)
        .sort((left, right) => Number(right === scene.rootId) - Number(left === scene.rootId)),
    ]),
  );
  const indexOf = new Map<string, number>();
  const syncIndexes = (row: number) =>
    (order.get(row) ?? []).forEach((id, index) => indexOf.set(id, index));
  rowNumbers.forEach(syncIndexes);

  for (let pass = 0; pass < TREE_LAYOUT.passes; pass += 1) {
    const downward = pass % 2 === 0;
    for (const row of downward ? rowNumbers : [...rowNumbers].reverse()) {
      const relativesOf = (id: string) =>
        (downward ? parentsById.get(id) : childrenById.get(id)) ?? [];
      order.set(
        row,
        orderRow({
          ids: order.get(row) ?? [],
          indexOf,
          relativesOf,
          scene,
          units,
        }),
      );
      syncIndexes(row);
    }
  }

  const xById = new Map<string, number>();
  for (const row of rowNumbers) {
    placeRow({ desired: new Map(), ids: order.get(row) ?? [], rootId: scene.rootId, units, xById });
  }
  for (let pass = 0; pass < TREE_LAYOUT.passes; pass += 1) {
    const downward = pass % 2 === 0;
    for (const row of downward ? rowNumbers : [...rowNumbers].reverse()) {
      const ids = order.get(row) ?? [];
      const desired = new Map<string, number>();
      for (const id of ids) {
        const relatives = (downward ? parentsById.get(id) : childrenById.get(id)) ?? [];
        const anchor = scene.sideAnchorById.get(id);
        const points = (anchor === undefined ? relatives : [anchor]).flatMap((relativeId) => {
          const x = xById.get(relativeId);
          return x === undefined ? [] : [x];
        });
        if (points.length > 0 && anchor === undefined) desired.set(id, mean(points));
      }
      placeRow({ desired, ids, rootId: scene.rootId, units, xById });
    }
  }

  const rootX = xById.get(scene.rootId) ?? 0;
  const rootRow = scene.rowById.get(scene.rootId) ?? 0;
  const positions = new Map<string, RelationshipGraphPoint>(
    visibleIds.map((id) => [
      id,
      {
        x: Math.round((xById.get(id) ?? 0) - rootX),
        y: ((scene.rowById.get(id) ?? 0) - rootRow) * TREE_LAYOUT.rowStep,
      },
    ]),
  );

  return {
    arcPairIds: toArcPairIds({ connections, indexOf, pairs, scene }),
    positions,
    rows: rowNumbers.map((row) => ({
      generation: (order.get(row) ?? []).some((id) => scene.generationById.get(id) === row)
        ? row
        : null,
      row,
      y: (row - rootRow) * TREE_LAYOUT.rowStep,
    })),
  };
}

export function toTreeNodeBox(isRoot: boolean): { height: number; width: number } {
  return isRoot ? TREE_LAYOUT.node.root : TREE_LAYOUT.node.default;
}

function isSiblingSide({ id, scene }: { id: string; scene: TreeScene }): boolean {
  const anchor = scene.sideAnchorById.get(id);
  return scene.edges.some((edge) => {
    const entry = scene.entryByEdgeId.get(edge.id);
    return (
      entry?.kind === "auxiliary" &&
      entry.group === "siblings" &&
      ((edge.source === id && edge.target === anchor) ||
        (edge.target === id && edge.source === anchor))
    );
  });
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function orderRow({
  ids,
  indexOf,
  relativesOf,
  scene,
  units,
}: {
  ids: readonly string[];
  indexOf: ReadonlyMap<string, number>;
  relativesOf: (id: string) => readonly string[];
  scene: TreeScene;
  units: ReadonlyMap<string, number>;
}): string[] {
  const centerOf = (id: string): number => {
    const anchor = scene.sideAnchorById.get(id);
    if (anchor !== undefined) return indexOf.get(anchor) ?? indexOf.get(id) ?? 0;
    const indexes = relativesOf(id).flatMap((relativeId) => {
      const index = indexOf.get(relativeId);
      return index === undefined ? [] : [index];
    });
    return indexes.length === 0 ? (indexOf.get(id) ?? 0) : mean(indexes);
  };
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const unit = units.get(id) ?? -1;
    groups.set(unit, [...(groups.get(unit) ?? []), id]);
  }
  return [...groups.values()]
    .map((members) => {
      const core = members
        .filter((id) => !scene.sideAnchorById.has(id))
        .map((id) => ({ center: centerOf(id), id }))
        .sort((left, right) => left.center - right.center || left.id.localeCompare(right.id))
        .map((entry) => entry.id);
      const sides = members.filter((id) => scene.sideAnchorById.has(id)).sort();
      const arranged = core.flatMap((id) => {
        const attached = sides.filter((sideId) => scene.sideAnchorById.get(sideId) === id);
        const before = attached.filter((sideId) => isSiblingSide({ id: sideId, scene }));
        const after = attached.filter((sideId) => !isSiblingSide({ id: sideId, scene }));
        return [...before, id, ...after];
      });
      const rest = sides.filter((id) => !arranged.includes(id));
      const ordered = [...arranged, ...rest];
      return {
        center: mean(members.map(centerOf)),
        first: ordered[0] ?? "",
        ordered,
        rootFirst: members.includes(scene.rootId),
      };
    })
    .sort(
      (left, right) =>
        left.center - right.center ||
        Number(right.rootFirst) - Number(left.rootFirst) ||
        left.first.localeCompare(right.first),
    )
    .flatMap((group) => group.ordered);
}

function placeRow({
  desired,
  ids,
  rootId,
  units,
  xById,
}: {
  desired: ReadonlyMap<string, number>;
  ids: readonly string[];
  rootId: string;
  units: ReadonlyMap<string, number>;
  xById: Map<string, number>;
}): void {
  if (ids.length === 0) return;
  const widthOf = (id: string) =>
    (id === rootId ? TREE_LAYOUT.node.root : TREE_LAYOUT.node.default).width;
  const separation = ids.map((id, index) => {
    const next = ids[index + 1];
    if (next === undefined) return 0;
    const gap = units.get(id) === units.get(next) ? TREE_LAYOUT.gap.member : TREE_LAYOUT.gap.unit;
    return (widthOf(id) + widthOf(next)) / 2 + gap;
  });
  const packed: number[] = [];
  ids.forEach((_, index) => {
    const previous = packed[index - 1];
    packed.push(previous === undefined ? 0 : previous + (separation[index - 1] ?? 0));
  });
  const packedCenter = ((packed[0] ?? 0) + (packed.at(-1) ?? 0)) / 2;
  const current = ids.map((id, index) => xById.get(id) ?? (packed[index] ?? 0) - packedCenter);

  const unitTargets = new Map<number, { offsets: number[]; targets: number[] }>();
  ids.forEach((id, index) => {
    const target = desired.get(id);
    if (target === undefined) return;
    const unit = units.get(id) ?? -1;
    const entry = unitTargets.get(unit) ?? { offsets: [], targets: [] };
    entry.targets.push(target);
    entry.offsets.push(packed[index] ?? 0);
    unitTargets.set(unit, entry);
  });
  const wanted = ids.map((id, index) => {
    const entry = unitTargets.get(units.get(id) ?? -1);
    if (entry === undefined || entry.targets.length === 0) return current[index] ?? 0;
    return mean(entry.targets) - mean(entry.offsets) + (packed[index] ?? 0);
  });

  const left: number[] = [];
  wanted.forEach((value, index) => {
    const previous = left[index - 1];
    left.push(
      previous === undefined ? value : Math.max(value, previous + (separation[index - 1] ?? 0)),
    );
  });
  const right: number[] = new Array<number>(wanted.length).fill(0);
  for (let index = wanted.length - 1; index >= 0; index -= 1) {
    const value = wanted[index] ?? 0;
    const next = right[index + 1];
    right[index] =
      index === wanted.length - 1 || next === undefined
        ? value
        : Math.min(value, next - (separation[index] ?? 0));
  }
  ids.forEach((id, index) => {
    xById.set(id, ((left[index] ?? 0) + (right[index] ?? 0)) / 2);
  });
}

function toArcPairIds({
  connections,
  indexOf,
  pairs,
  scene,
}: {
  connections: readonly GraphConnection[];
  indexOf: ReadonlyMap<string, number>;
  pairs: ReadonlyMap<string, TreePairSemantics>;
  scene: TreeScene;
}): ReadonlySet<string> {
  return new Set(
    connections
      .filter((connection) => {
        const pair = pairs.get(connection.id);
        if (pair === undefined || pair.lineage !== null) return false;
        const sameRow =
          scene.rowById.get(connection.sourceId) === scene.rowById.get(connection.targetId);
        const distance = Math.abs(
          (indexOf.get(connection.sourceId) ?? 0) - (indexOf.get(connection.targetId) ?? 0),
        );
        return sameRow && distance > 1;
      })
      .map((connection) => connection.id),
  );
}

function toUnits({
  childrenById,
  connections,
  pairs,
  scene,
  visibleIds,
}: {
  childrenById: ReadonlyMap<string, readonly string[]>;
  connections: readonly GraphConnection[];
  pairs: ReadonlyMap<string, TreePairSemantics>;
  scene: TreeScene;
  visibleIds: readonly string[];
}): ReadonlyMap<string, number> {
  const parent = new Map(visibleIds.map((id) => [id, id] as const));
  const find = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current) ?? current;
    return current;
  };
  const join = (left: string, right: string) => {
    if (scene.rowById.get(left) !== scene.rowById.get(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [keep, drop] = leftRoot < rightRoot ? [leftRoot, rightRoot] : [rightRoot, leftRoot];
    parent.set(drop, keep);
  };
  for (const connection of connections) {
    const style = pairs.get(connection.id)?.style;
    if (style === "marriages" || style === "exUnions")
      join(connection.sourceId, connection.targetId);
  }
  const parentsByChild = new Map<string, string[]>();
  for (const [parentId, children] of childrenById) {
    for (const childId of children) {
      parentsByChild.set(childId, [...(parentsByChild.get(childId) ?? []), parentId]);
    }
  }
  for (const parents of parentsByChild.values()) {
    const [first, ...rest] = parents;
    if (first !== undefined) rest.forEach((other) => join(first, other));
  }
  for (const [sideId, anchorId] of scene.sideAnchorById) join(sideId, anchorId);
  const unitIndex = new Map<string, number>();
  return new Map(
    visibleIds.map((id) => {
      const root = find(id);
      const index = unitIndex.get(root) ?? unitIndex.size;
      unitIndex.set(root, index);
      return [id, index] as const;
    }),
  );
}
