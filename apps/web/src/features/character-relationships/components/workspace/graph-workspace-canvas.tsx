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
import type { GraphPersonFocus } from "../../model/workspace/graph-person-emphasis";
import type { GraphPersonCanvasScene } from "./graph-person-scene-context";
import type {
  GraphSceneFlowEdge,
  GraphSceneFlowNode,
  GraphSceneValue,
} from "./graph-scene-context";
import type { GraphWorkspaceCanvasControlsProps } from "./graph-workspace-canvas-controls";

import { isNetworkClusterId } from "../../model/workspace/graph-network-scene";
import { toGraphPersonEmphasis } from "../../model/workspace/graph-person-emphasis";
import { GraphCharacterNode } from "./graph-character-node";
import { GraphClusterNode } from "./graph-cluster-node";
import { GraphAggregateEdge, GraphConnectionEdge } from "./graph-connection-edge";
import { GraphPersonCameraFollow } from "./graph-person-camera-follow";
import { GraphPersonEdge } from "./graph-person-edge";
import { GraphPersonMiniMap, withGraphPersonMiniMapCover } from "./graph-person-mini-map";
import { GraphPersonNode } from "./graph-person-node";
import { GraphPersonRings } from "./graph-person-rings";
import { GraphPersonSceneContext } from "./graph-person-scene-context";
import { GRAPH_SCENE_FLOW, GraphSceneContext } from "./graph-scene-context";
import { GraphWorkspaceCanvasControls } from "./graph-workspace-canvas-controls";

const WORKSPACE_CANVAS = {
  edgeTypes: {
    [GRAPH_SCENE_FLOW.aggregateEdge]: GraphAggregateEdge,
    [GRAPH_SCENE_FLOW.connectionEdge]: GraphConnectionEdge,
    [GRAPH_SCENE_FLOW.personEdge]: GraphPersonEdge,
  },
  fitViewOptions: { maxZoom: 1, padding: 0.2 },
  maxZoom: 2,
  minZoom: 0.1,
  nodeOrigin: [0.5, 0.5],
  nodeTypes: {
    [GRAPH_SCENE_FLOW.characterNode]: GraphCharacterNode,
    [GRAPH_SCENE_FLOW.clusterNode]: GraphClusterNode,
    [GRAPH_SCENE_FLOW.personNode]: GraphPersonNode,
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
  person: Nullable<GraphPersonCanvasScene>;
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
  person,
  placementKey,
  positions,
  sceneKey,
  value,
  viewport,
}: GraphWorkspaceCanvasProps) {
  const t = useTranslations("relationships.workspace.canvas");
  const { resolvedTheme } = useTheme();
  const [focus, setFocus] = useState<GraphPersonFocus>(null);
  const isPerson = person !== null;
  const [synced, setSynced] = useState<SyncedNodes>(() => ({
    layoutKey,
    nodes: reconcileNodes({ current: [], isPerson, keepPlaced: false, positions }),
    placementKey,
  }));
  if (synced.layoutKey !== layoutKey || synced.placementKey !== placementKey) {
    setSynced({
      layoutKey,
      nodes: reconcileNodes({
        current: synced.nodes,
        isPerson,
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
      type: isPerson ? GRAPH_SCENE_FLOW.personEdge : GRAPH_SCENE_FLOW.connectionEdge,
    })),
  ];
  const personValue =
    person === null
      ? null
      : {
          ...person,
          emphasis: toGraphPersonEmphasis({
            connections,
            focus: toLiveFocus({ focus, value }) ?? value.selection,
          }),
          onFocusChange: setFocus,
        };

  function changeNodes(changes: NodeChange<GraphSceneFlowNode>[]) {
    setSynced((current) => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) }));
  }

  return (
    <GraphSceneContext value={value}>
      <GraphPersonSceneContext value={personValue}>
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
          preventScrolling={!isPerson}
          selectionKeyCode={null}
          style={WORKSPACE_CANVAS.style}
          zoomOnScroll={!isPerson}
        >
          {person === null ? null : (
            <>
              <GraphPersonRings />
              <GraphPersonCameraFollow
                cover={
                  person.miniMap?.isOpen ? withGraphPersonMiniMapCover(person.cover) : person.cover
                }
              />
              {person.miniMap?.isOpen ? <GraphPersonMiniMap /> : null}
            </>
          )}
          <GraphWorkspaceCanvasControls {...controls} sceneKey={sceneKey} viewport={viewport} />
        </ReactFlow>
      </GraphPersonSceneContext>
    </GraphSceneContext>
  );
}

function reconcileNodes({
  current,
  isPerson,
  keepPlaced,
  positions,
}: {
  current: readonly GraphSceneFlowNode[];
  isPerson: boolean;
  keepPlaced: boolean;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
}): GraphSceneFlowNode[] {
  const currentById = new Map(current.map((node) => [node.id, node]));
  return [...positions.entries()].map(([id, position]): GraphSceneFlowNode => {
    const previous = currentById.get(id);
    const type = toNodeType({ id, isPerson });
    return previous === undefined
      ? { data: {}, id, position, type }
      : { ...previous, position: keepPlaced ? previous.position : position, type };
  });
}

function toLiveFocus({
  focus,
  value,
}: {
  focus: GraphPersonFocus;
  value: GraphSceneValue;
}): GraphPersonFocus {
  if (focus === null) return null;
  const isLive =
    focus.kind === "character" ? value.characters.has(focus.id) : value.connections.has(focus.id);
  return isLive ? focus : null;
}

function toNodeType({
  id,
  isPerson,
}: {
  id: string;
  isPerson: boolean;
}): GraphSceneFlowNode["type"] {
  if (isNetworkClusterId(id)) return GRAPH_SCENE_FLOW.clusterNode;
  return isPerson ? GRAPH_SCENE_FLOW.personNode : GRAPH_SCENE_FLOW.characterNode;
}
