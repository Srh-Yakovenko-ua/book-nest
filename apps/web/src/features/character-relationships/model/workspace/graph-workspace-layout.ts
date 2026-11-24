import type { RelationshipGraphPoint } from "../relationship-graph-layout";
import type { PersonScene } from "./graph-person-scene";

export const GRAPH_NODE_BOX = {
  character: { height: 112, width: 144 },
  cluster: { height: 96, width: 176 },
} as const;

export const PERSON_LAYOUT = {
  firstAngle: -Math.PI / 2,
  footprint: { height: 124, width: 132 },
  minRingRadius: 240,
  revision: "portrait-1",
  ringGap: 64,
  siblingGap: 20,
} as const;

export type GraphWorkspacePositions = ReadonlyMap<string, RelationshipGraphPoint>;

export function layoutPersonScene(scene: PersonScene): GraphWorkspacePositions {
  const positions = new Map<string, RelationshipGraphPoint>([[scene.rootId, { x: 0, y: 0 }]]);
  const angleById = new Map<string, number>([[scene.rootId, 0]]);
  const neighborsById = new Map<string, string[]>();
  for (const edge of scene.edges) {
    neighborsById.set(edge.source, [...(neighborsById.get(edge.source) ?? []), edge.target]);
    neighborsById.set(edge.target, [...(neighborsById.get(edge.target) ?? []), edge.source]);
  }
  const maxHop = Math.max(0, ...scene.nodes.map((node) => scene.hopById.get(node.id) ?? 0));
  let previousRadius = 0;

  for (let hop = 1; hop <= maxHop; hop += 1) {
    const ring = scene.nodes
      .map((node) => node.id)
      .filter((id) => scene.hopById.get(id) === hop)
      .map((id) => ({ desired: desiredAngle({ angleById, hop, id, neighborsById, scene }), id }))
      .sort((left, right) => left.desired - right.desired || left.id.localeCompare(right.id));
    if (ring.length === 0) continue;
    const arc = PERSON_LAYOUT.footprint.width + PERSON_LAYOUT.siblingGap;
    const radius = Math.max(
      PERSON_LAYOUT.minRingRadius,
      previousRadius + PERSON_LAYOUT.footprint.height + PERSON_LAYOUT.ringGap,
      (ring.length * arc) / (2 * Math.PI),
    );
    const minStep = arc / radius;
    const angles = spreadAngles({
      desired: ring.map((entry, index) =>
        hop === 1 ? PERSON_LAYOUT.firstAngle + (2 * Math.PI * index) / ring.length : entry.desired,
      ),
      minStep,
    });
    ring.forEach((entry, index) => {
      const angle = angles[index] ?? entry.desired;
      angleById.set(entry.id, angle);
      positions.set(entry.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    previousRadius = radius;
  }

  return positions;
}

function desiredAngle({
  angleById,
  hop,
  id,
  neighborsById,
  scene,
}: {
  angleById: ReadonlyMap<string, number>;
  hop: number;
  id: string;
  neighborsById: ReadonlyMap<string, readonly string[]>;
  scene: PersonScene;
}): number {
  const parentAngles = (neighborsById.get(id) ?? []).flatMap((neighbor) => {
    if (scene.hopById.get(neighbor) !== hop - 1) return [];
    const angle = angleById.get(neighbor);
    return angle === undefined ? [] : [angle];
  });
  if (parentAngles.length === 0) return 0;
  const x = parentAngles.reduce((sum, angle) => sum + Math.cos(angle), 0);
  const y = parentAngles.reduce((sum, angle) => sum + Math.sin(angle), 0);
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

function spreadAngles({
  desired,
  minStep,
}: {
  desired: readonly number[];
  minStep: number;
}): number[] {
  const angles = [...desired];
  for (let index = 1; index < angles.length; index += 1) {
    const previous = angles[index - 1] ?? 0;
    const current = angles[index] ?? 0;
    if (current - previous < minStep) angles[index] = previous + minStep;
  }
  return angles;
}
