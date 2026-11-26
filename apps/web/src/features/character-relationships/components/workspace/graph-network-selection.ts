import type { Nullable } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { NetworkAggregateLink } from "../../model/workspace/graph-network-index";
import type { NetworkScene } from "../../model/workspace/graph-network-scene";
import type { GraphPersonEmphasis } from "../../model/workspace/graph-person-emphasis";
import type {
  GraphNetworkPresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";

import { toGraphPersonEmphasis } from "../../model/workspace/graph-person-emphasis";

export function isNetworkSelectionLive({
  network,
  selection,
}: {
  network: GraphNetworkPresentation;
  selection: NonNullable<GraphSceneSelection>;
}): boolean {
  const { index, scene } = network;
  switch (selection.kind) {
    case "aggregate":
      return [...index.bucketLinks, ...scene.links].some((link) => link.id === selection.id);
    case "character":
      return index.nodeById.has(selection.id);
    case "connection":
      return index.connectionById.has(selection.id);
    case "members":
      return index.bucketById.has(selection.id);
    default:
      return assertNever(selection);
  }
}

export function toNetworkEmphasis({
  aggregates,
  presentation,
  scene,
  selection,
}: {
  aggregates: ReadonlyMap<string, NetworkAggregateLink>;
  presentation: GraphWorkspacePresentation;
  scene: NetworkScene;
  selection: GraphSceneSelection;
}): Nullable<GraphPersonEmphasis> {
  if (selection === null) return null;
  if (selection.kind === "aggregate") {
    const link = aggregates.get(selection.id);
    if (link === undefined) return null;
    return {
      characterIds: new Set([link.sourceId, link.targetId]),
      connectionIds: new Set([link.id]),
    };
  }
  if (selection.kind === "connection") {
    return toGraphPersonEmphasis({ connections: presentation.connections, focus: selection });
  }
  if (selection.kind !== "character" || !presentation.characters.has(selection.id)) return null;
  const base = toGraphPersonEmphasis({ connections: presentation.connections, focus: selection });
  const memberLinks = scene.links.filter(
    (link) => link.sourceId === selection.id || link.targetId === selection.id,
  );
  return {
    characterIds: new Set([
      ...(base?.characterIds ?? []),
      ...memberLinks.flatMap((link) => [link.sourceId, link.targetId]),
    ]),
    connectionIds: new Set([...(base?.connectionIds ?? []), ...memberLinks.map((link) => link.id)]),
  };
}

export function toNetworkSelectionIds({
  aggregates,
  sceneValue,
  selection,
}: {
  aggregates: ReadonlyMap<string, NetworkAggregateLink>;
  sceneValue: GraphSceneValue;
  selection: GraphSceneSelection;
}): readonly string[] {
  if (selection === null) return [];
  switch (selection.kind) {
    case "aggregate": {
      const link = aggregates.get(selection.id);
      return link === undefined ? [] : [link.sourceId, link.targetId];
    }
    case "character":
      return sceneValue.characters.has(selection.id) ? [selection.id] : [];
    case "connection": {
      const connection = sceneValue.connections.get(selection.id);
      return connection === undefined ? [] : [connection.sourceId, connection.targetId];
    }
    case "members":
      return [];
    default:
      return assertNever(selection);
  }
}
