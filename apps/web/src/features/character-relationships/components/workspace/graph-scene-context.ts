"use client";

import type { Nullable } from "@app/shared";
import type { Edge, Node } from "@xyflow/react";

import { createContext, use } from "react";

import type { GraphConnection } from "../../model/workspace/graph-connections";
import type {
  GraphPresentationCharacter,
  GraphPresentationCluster,
} from "../../model/workspace/graph-workspace-presentation";

export const GRAPH_SCENE_FLOW = {
  aggregateEdge: "aggregate",
  characterNode: "workspace-character",
  clusterNode: "workspace-cluster",
  connectionEdge: "connection",
} as const;

export type GraphSceneFlowEdge = Edge<
  GraphSceneEdgeData,
  typeof GRAPH_SCENE_FLOW.aggregateEdge | typeof GRAPH_SCENE_FLOW.connectionEdge
>;

export type GraphSceneFlowNode = Node<
  Record<string, never>,
  typeof GRAPH_SCENE_FLOW.characterNode | typeof GRAPH_SCENE_FLOW.clusterNode
>;

export type GraphSceneSelection =
  null | { id: string; kind: "character" } | { id: string; kind: "connection" };

export type GraphSceneValue = {
  characters: ReadonlyMap<string, GraphPresentationCharacter>;
  clusters: ReadonlyMap<string, GraphPresentationCluster>;
  connections: ReadonlyMap<string, GraphConnection>;
  onAggregateOpen: (sourceId: string, targetId: string) => void;
  onBranchToggle: (characterId: string) => void;
  onCharacterOpen: (characterId: string) => void;
  onClusterMore: (bucketId: string) => void;
  onClusterToggle: (bucketId: string) => void;
  onConnectionOpen: (connectionId: string) => void;
  selection: GraphSceneSelection;
};

type GraphSceneEdgeData = Record<string, never>;

export const GraphSceneContext = createContext<Nullable<GraphSceneValue>>(null);

export function useGraphScene(): GraphSceneValue {
  const value = use(GraphSceneContext);
  if (value === null) throw new Error("GraphSceneContext is not provided");
  return value;
}
