"use client";

import "@xyflow/react/dist/base.css";

import type { CharacterGraphViewport, Nullable } from "@app/shared";

import {
  applyNodeChanges,
  type EdgeTypes,
  type FitViewOptions,
  type NodeChange,
  type NodeOrigin,
  type NodeTypes,
  ReactFlow,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type CSSProperties, useState } from "react";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { GraphConnection } from "../../model/workspace/graph-connections";
import type { NetworkAggregate } from "../../model/workspace/graph-network-scene";
import type {
  GraphSceneFlowEdge,
  GraphSceneFlowNode,
  GraphSceneValue,
} from "./graph-scene-context";
import type { GraphWorkspaceCanvasControlsProps } from "./graph-workspace-canvas-controls";

import { isNetworkClusterId } from "../../model/workspace/graph-network-scene";
import { GraphCharacterNode } from "./graph-character-node";
import { GraphClusterNode } from "./graph-cluster-node";
import { GraphAggregateEdge, GraphConnectionEdge } from "./graph-connection-edge";
import { GRAPH_SCENE_FLOW, GraphSceneContext } from "./graph-scene-context";
import { GraphWorkspaceCanvasControls } from "./graph-workspace-canvas-controls";

const WORKSPACE_CANVAS = {
  edgeTypes: {
    [GRAPH_SCENE_FLOW.aggregateEdge]: GraphAggregateEdge,
    [GRAPH_SCENE_FLOW.connectionEdge]: GraphConnectionEdge,
  },
  fitViewOptions: { maxZoom: 1, padding: 0.2 },
  maxZoom: 2,
  minZoom: 0.1,
  nodeOrigin: [0.5, 0.5],
  nodeTypes: {
    [GRAPH_SCENE_FLOW.characterNode]: GraphCharacterNode,
    [GRAPH_SCENE_FLOW.clusterNode]: GraphClusterNode,
  },
  style: { backgroundColor: "transparent" },
} satisfies {
  edgeTypes: EdgeTypes;
  fitViewOptions: FitViewOptions;
  maxZoom: number;
  minZoom: number;
  nodeOrigin: NodeOrigin;
  nodeTypes: NodeTypes;
  style: CSSProperties;
};

export type GraphWorkspaceCanvasProps = {
  aggregates: readonly NetworkAggregate[];
  connections: readonly GraphConnection[];
  controls: Omit<GraphWorkspaceCanvasControlsProps, "sceneKey" | "viewport">;
  layoutKey: string;
  onPaneClick: () => void;
  placementKey: string;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  sceneKey: string;
  value: GraphSceneValue;
  viewport: Nullable<CharacterGraphViewport>;
};

type SyncedNodes = {
  layoutKey: string;
  nodes: GraphSceneFlowNode[];
  placementKey: string;
};

export function GraphWorkspaceCanvas({
  aggregates,
  connections,
  controls,
  layoutKey,
  onPaneClick,
  placementKey,
  positions,
  sceneKey,
  value,
  viewport,
}: GraphWorkspaceCanvasProps) {
  const t = useTranslations("relationships.workspace.canvas");
  const { resolvedTheme } = useTheme();
  const [synced, setSynced] = useState<SyncedNodes>(() => ({
    layoutKey,
    nodes: reconcileNodes({ current: [], keepPlaced: false, positions }),
    placementKey,
  }));
  if (synced.layoutKey !== layoutKey || synced.placementKey !== placementKey) {
    setSynced({
      layoutKey,
      nodes: reconcileNodes({
        current: synced.nodes,
        keepPlaced: synced.placementKey === placementKey,
        positions,
      }),
      placementKey,
    });
  }

  const edges: GraphSceneFlowEdge[] = [
    ...aggregates.map((aggregate): GraphSceneFlowEdge => ({
      data: {},
      domAttributes: { "aria-hidden": true },
      focusable: false,
      id: aggregate.id,
      source: aggregate.sourceId,
      target: aggregate.targetId,
      type: GRAPH_SCENE_FLOW.aggregateEdge,
    })),
    ...connections.map((connection): GraphSceneFlowEdge => ({
      data: {},
      domAttributes: { "aria-hidden": true },
      focusable: false,
      id: connection.id,
      source: connection.sourceId,
      target: connection.targetId,
      type: GRAPH_SCENE_FLOW.connectionEdge,
    })),
  ];

  function changeNodes(changes: NodeChange<GraphSceneFlowNode>[]) {
    setSynced((current) => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) }));
  }

  return (
    <GraphSceneContext value={value}>
      <ReactFlow
        aria-label={t("label")}
        ariaLabelConfig={{
          "edge.a11yDescription.default": t("a11yEdge"),
          "node.a11yDescription.default": t("a11yNode"),
          "node.a11yDescription.keyboardDisabled": t("a11yNode"),
        }}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        deleteKeyCode={null}
        disableKeyboardA11y
        edges={edges}
        edgesFocusable={false}
        edgeTypes={WORKSPACE_CANVAS.edgeTypes}
        elementsSelectable={false}
        fitViewOptions={WORKSPACE_CANVAS.fitViewOptions}
        maxZoom={WORKSPACE_CANVAS.maxZoom}
        minZoom={WORKSPACE_CANVAS.minZoom}
        multiSelectionKeyCode={null}
        nodeOrigin={WORKSPACE_CANVAS.nodeOrigin}
        nodes={synced.nodes}
        nodesConnectable={false}
        nodesFocusable={false}
        nodeTypes={WORKSPACE_CANVAS.nodeTypes}
        onEdgeClick={(_event, edge) => {
          if (edge.type === GRAPH_SCENE_FLOW.aggregateEdge) {
            value.onAggregateOpen(edge.source, edge.target);
            return;
          }
          value.onConnectionOpen(edge.id);
        }}
        onNodesChange={changeNodes}
        onPaneClick={onPaneClick}
        selectionKeyCode={null}
        style={WORKSPACE_CANVAS.style}
      >
        <GraphWorkspaceCanvasControls {...controls} sceneKey={sceneKey} viewport={viewport} />
      </ReactFlow>
    </GraphSceneContext>
  );
}

function reconcileNodes({
  current,
  keepPlaced,
  positions,
}: {
  current: readonly GraphSceneFlowNode[];
  keepPlaced: boolean;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
}): GraphSceneFlowNode[] {
  const currentById = new Map(current.map((node) => [node.id, node]));
  return [...positions.entries()].map(([id, position]): GraphSceneFlowNode => {
    const previous = currentById.get(id);
    const type = isNetworkClusterId(id)
      ? GRAPH_SCENE_FLOW.clusterNode
      : GRAPH_SCENE_FLOW.characterNode;
    return previous === undefined
      ? { data: {}, id, position, type }
      : { ...previous, position: keepPlaced ? previous.position : position, type };
  });
}
