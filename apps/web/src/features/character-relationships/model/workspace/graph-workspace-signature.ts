import type {
  CharacterGraphLayoutView,
  CharacterGraphPositions,
  CharacterGraphViewport,
  Nullable,
} from "@app/shared";

import { CHARACTER_GRAPH_LAYOUT_POSITIONS_MAX } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";
import type { GraphReaderKey } from "./graph-workspace-request";

const SIGNATURE = {
  fnvOffsets: [0x811c9dc5, 0x01000193],
  fnvPrime: 0x01000193,
  hexRadix: 16,
  hexWidth: 8,
  layoutRevision: 1,
  prefix: "workspace",
} as const;

export type GraphWorkspaceLayoutRestore = {
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  viewport: Nullable<CharacterGraphViewport>;
};

export function toGraphLayoutVersion({
  bookId,
  nodeIds,
  reader,
  sceneKey,
}: {
  bookId: string;
  nodeIds: readonly string[];
  reader: GraphReaderKey;
  sceneKey: string;
}): string {
  const signature = toStableHash(
    JSON.stringify([
      SIGNATURE.layoutRevision,
      bookId,
      reader.currentPage,
      reader.finishedAt,
      reader.readingStatus,
      sceneKey,
      [...nodeIds].sort(),
    ]),
  );
  return `${SIGNATURE.prefix}:${SIGNATURE.layoutRevision}:${signature}`;
}

export function toGraphSceneKey(parts: readonly unknown[]): string {
  return toStableHash(JSON.stringify(parts));
}

export function toRestoredGraphLayout({
  allowedIds,
  layout,
  layoutVersion,
}: {
  allowedIds: ReadonlySet<string>;
  layout: Nullable<CharacterGraphLayoutView>;
  layoutVersion: string;
}): Nullable<GraphWorkspaceLayoutRestore> {
  if (layout === null || layout.layoutVersion !== layoutVersion) return null;
  const positions = new Map(Object.entries(layout.positions).filter(([id]) => allowedIds.has(id)));
  return { positions, viewport: layout.viewport };
}

export function toSavedGraphPositions({
  allowedIds,
  positions,
}: {
  allowedIds: ReadonlySet<string>;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
}): CharacterGraphPositions {
  return Object.fromEntries(
    [...positions.entries()]
      .filter(([id]) => allowedIds.has(id))
      .slice(0, CHARACTER_GRAPH_LAYOUT_POSITIONS_MAX)
      .map(([id, point]) => [id, { x: Math.round(point.x), y: Math.round(point.y) }] as const),
  );
}

function toStableHash(value: string): string {
  return SIGNATURE.fnvOffsets
    .map((offset) => {
      let hash: number = offset;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, SIGNATURE.fnvPrime);
      }
      return (hash >>> 0).toString(SIGNATURE.hexRadix).padStart(SIGNATURE.hexWidth, "0");
    })
    .join("");
}
