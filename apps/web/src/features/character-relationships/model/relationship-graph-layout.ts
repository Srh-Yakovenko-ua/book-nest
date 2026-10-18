import type {
  CharacterGraphClusterView,
  CharacterGraphNodeView,
  CharacterGraphPositions,
  Nullable,
} from "@app/shared";

export type RelationshipGraphPlacement = { id: string; position: RelationshipGraphPoint };

export type RelationshipGraphPoint = { x: number; y: number };

export type RelationshipGraphPositionMap = Readonly<Record<string, RelationshipGraphPoint>>;

type LayoutGroup = { key: string; nodes: CharacterGraphNodeView[]; rank: number };

type RingIsland = { points: RelationshipGraphPlacement[]; radius: number };

const AUTO_LAYOUT = {
  focusRank: -1,
  fullTurn: 2 * Math.PI,
  islandGap: 160,
  islandPadding: 100,
  nodeArc: 180,
  origin: { x: 0, y: 0 },
  ringGap: 140,
  startAngle: -Math.PI / 2,
  unclusteredKey: "",
  unclusteredRank: Number.MAX_SAFE_INTEGER,
} as const;

export function computeRelationshipGraphAutoLayout({
  clusters,
  focusCharacterId,
  nodes,
}: {
  clusters: CharacterGraphClusterView[];
  focusCharacterId: Nullable<string>;
  nodes: CharacterGraphNodeView[];
}): RelationshipGraphPositionMap {
  const islands = toLayoutGroups({ clusters, focusCharacterId, nodes }).map((group) =>
    toRingIsland(
      [...group.nodes].sort((left, right) => compareProminence({ focusCharacterId, left, right })),
    ),
  );
  return packIslands(islands);
}

export function resolveRelationshipGraphPlacements({
  auto,
  nodes,
  saved,
}: {
  auto: RelationshipGraphPositionMap;
  nodes: CharacterGraphNodeView[];
  saved: Nullable<CharacterGraphPositions>;
}): RelationshipGraphPlacement[] {
  return nodes.map((node) => ({
    id: node.id,
    position: saved?.[node.id] ?? auto[node.id] ?? { ...AUTO_LAYOUT.origin },
  }));
}

function compareProminence({
  focusCharacterId,
  left,
  right,
}: {
  focusCharacterId: Nullable<string>;
  left: CharacterGraphNodeView;
  right: CharacterGraphNodeView;
}): number {
  if (left.id === focusCharacterId) return -1;
  if (right.id === focusCharacterId) return 1;
  if (left.degree !== right.degree) return right.degree - left.degree;
  return compareText(left.name, right.name) || compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function packIslands(islands: RingIsland[]): RelationshipGraphPositionMap {
  const columns = Math.max(1, Math.ceil(Math.sqrt(islands.length)));
  const positions: Record<string, RelationshipGraphPoint> = {};
  let rowTop = 0;

  for (let rowStart = 0; rowStart < islands.length; rowStart += columns) {
    const row = islands.slice(rowStart, rowStart + columns);
    const rowRadius = Math.max(...row.map((island) => island.radius));
    let islandLeft = 0;

    for (const island of row) {
      const center = { x: islandLeft + island.radius, y: rowTop + rowRadius };
      for (const point of island.points) {
        positions[point.id] = {
          x: center.x + point.position.x,
          y: center.y + point.position.y,
        };
      }
      islandLeft += island.radius * 2 + AUTO_LAYOUT.islandGap;
    }

    rowTop += rowRadius * 2 + AUTO_LAYOUT.islandGap;
  }

  return positions;
}

function toLayoutGroups({
  clusters,
  focusCharacterId,
  nodes,
}: {
  clusters: CharacterGraphClusterView[];
  focusCharacterId: Nullable<string>;
  nodes: CharacterGraphNodeView[];
}): LayoutGroup[] {
  const clusterRank = new Map(clusters.map((cluster, index) => [cluster.id, index]));
  const groups = new Map<string, LayoutGroup>();

  for (const node of nodes) {
    const key = node.clusterId ?? AUTO_LAYOUT.unclusteredKey;
    const group = groups.get(key) ?? {
      key,
      nodes: [],
      rank: clusterRank.get(key) ?? AUTO_LAYOUT.unclusteredRank,
    };
    group.nodes.push(node);
    if (node.id === focusCharacterId) group.rank = AUTO_LAYOUT.focusRank;
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (left, right) => left.rank - right.rank || compareText(left.key, right.key),
  );
}

function toRingIsland(nodes: CharacterGraphNodeView[]): RingIsland {
  const [center, ...rest] = nodes;
  if (center === undefined) return { points: [], radius: 0 };

  const points: RelationshipGraphPlacement[] = [
    { id: center.id, position: { ...AUTO_LAYOUT.origin } },
  ];
  let ring = 0;
  let placed = 0;

  while (placed < rest.length) {
    ring += 1;
    const radius = ring * AUTO_LAYOUT.ringGap;
    const capacity = Math.max(1, Math.floor((AUTO_LAYOUT.fullTurn * radius) / AUTO_LAYOUT.nodeArc));
    const ringNodes = rest.slice(placed, placed + capacity);
    const step = AUTO_LAYOUT.fullTurn / ringNodes.length;
    const twist = ring % 2 === 0 ? 0 : step / 2;

    ringNodes.forEach((node, slot) => {
      const angle = AUTO_LAYOUT.startAngle + twist + step * slot;
      points.push({
        id: node.id,
        position: {
          x: Math.round(radius * Math.cos(angle)),
          y: Math.round(radius * Math.sin(angle)),
        },
      });
    });
    placed += ringNodes.length;
  }

  return { points, radius: ring * AUTO_LAYOUT.ringGap + AUTO_LAYOUT.islandPadding };
}
