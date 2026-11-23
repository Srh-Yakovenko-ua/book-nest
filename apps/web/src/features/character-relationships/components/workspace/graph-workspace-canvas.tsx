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
  type Viewport,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type CSSProperties, useRef, useState } from "react";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { GraphConnection } from "../../model/workspace/graph-connections";
import type { NetworkAggregate } from "../../model/workspace/graph-network-scene";
import type { GraphPersonFocus } from "../../model/workspace/graph-person-emphasis";
import type { GraphCameraState } from "./graph-camera-state-context";
import type { GraphPersonCanvasScene } from "./graph-person-scene-context";
import type {
  GraphSceneFlowEdge,
  GraphSceneFlowNode,
  GraphSceneValue,
} from "./graph-scene-context";
import type { GraphTreeCanvasScene } from "./graph-tree-scene-context";
import type { GraphWorkspaceCanvasControlsProps } from "./graph-workspace-canvas-controls";

import { GENEALOGY_CAMERA } from "../../model/workspace/graph-genealogy-camera";
import { isNetworkClusterId } from "../../model/workspace/graph-network-scene";
import { toGraphPersonEmphasis } from "../../model/workspace/graph-person-emphasis";
import { GraphCameraStateContext } from "./graph-camera-state-context";
import { GraphCharacterNode } from "./graph-character-node";
import { GraphClusterNode } from "./graph-cluster-node";
import { GraphAggregateEdge, GraphConnectionEdge } from "./graph-connection-edge";
import { GraphGenealogyCameraFocus } from "./graph-genealogy-camera-focus";
import { GraphGenealogyFrames } from "./graph-genealogy-frames";
import { GraphGenealogyLandmarks } from "./graph-genealogy-landmarks";
import { GraphGenealogyNode } from "./graph-genealogy-node";
import { GraphPersonCameraFollow } from "./graph-person-camera-follow";
import { GraphPersonEdge } from "./graph-person-edge";
import { GraphPersonMiniMap, withGraphPersonMiniMapCover } from "./graph-person-mini-map";
import { GraphPersonNode } from "./graph-person-node";
import { GraphPersonRings } from "./graph-person-rings";
import { GraphPersonSceneContext } from "./graph-person-scene-context";
import { GRAPH_SCENE_FLOW, GraphSceneContext } from "./graph-scene-context";
import { GraphTreeCameraFollow } from "./graph-tree-camera-follow";
import { GraphTreeEdge } from "./graph-tree-edge";
import { GraphTreeGenerationRail } from "./graph-tree-generation-rail";
import { GraphTreeMiniMap } from "./graph-tree-mini-map";
import { GraphTreeNode } from "./graph-tree-node";
import { GraphTreeSceneContext } from "./graph-tree-scene-context";
import { GraphWorkspaceCanvasControls } from "./graph-workspace-canvas-controls";

const WORKSPACE_CANVAS = {
  edgeTypes: {
    [GRAPH_SCENE_FLOW.aggregateEdge]: GraphAggregateEdge,
    [GRAPH_SCENE_FLOW.connectionEdge]: GraphConnectionEdge,
    [GRAPH_SCENE_FLOW.personEdge]: GraphPersonEdge,
    [GRAPH_SCENE_FLOW.treeEdge]: GraphTreeEdge,
  },
  fitViewOptions: { maxZoom: 1, padding: 0.2 },
  genealogyViewport: { x: 0, y: 0, zoom: GENEALOGY_CAMERA.minZoom },
  maxZoom: 2,
  minZoom: 0.1,
  nodeOrigin: [0.5, 0.5],
  nodeTypes: {
    [GRAPH_SCENE_FLOW.characterNode]: GraphCharacterNode,
    [GRAPH_SCENE_FLOW.clusterNode]: GraphClusterNode,
    [GRAPH_SCENE_FLOW.genealogyNode]: GraphGenealogyNode,
    [GRAPH_SCENE_FLOW.personNode]: GraphPersonNode,
    [GRAPH_SCENE_FLOW.treeNode]: GraphTreeNode,
  },
  style: { backgroundColor: "transparent" },
} satisfies {
  edgeTypes: EdgeTypes;
  fitViewOptions: FitViewOptions;
  genealogyViewport: Viewport;
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
  tree?: Nullable<GraphTreeCanvasScene>;
  value: GraphSceneValue;
  viewport: Nullable<CharacterGraphViewport>;
};

type CanvasMode = "default" | "genealogy" | "person" | "tree";

const CANVAS_EDGE_TYPES = {
  default: GRAPH_SCENE_FLOW.connectionEdge,
  genealogy: GRAPH_SCENE_FLOW.treeEdge,
  person: GRAPH_SCENE_FLOW.personEdge,
  tree: GRAPH_SCENE_FLOW.treeEdge,
} as const satisfies Record<CanvasMode, GraphSceneFlowEdge["type"]>;

const CANVAS_NODE_TYPES = {
  default: GRAPH_SCENE_FLOW.characterNode,
  genealogy: GRAPH_SCENE_FLOW.genealogyNode,
  person: GRAPH_SCENE_FLOW.personNode,
  tree: GRAPH_SCENE_FLOW.treeNode,
} as const satisfies Record<CanvasMode, GraphSceneFlowNode["type"]>;

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
  tree = null,
  value,
  viewport,
}: GraphWorkspaceCanvasProps) {
  const t = useTranslations("relationships.workspace.canvas");
  const { resolvedTheme } = useTheme();
  const [focus, setFocus] = useState<GraphPersonFocus>(null);
  const cameraStateRef = useRef<GraphCameraState>({ mode: "manual", target: null });
  const mode = toCanvasMode({ person, tree });
  const capturesWheel = mode === "default";
  const [synced, setSynced] = useState<SyncedNodes>(() => ({
    layoutKey,
    nodes: reconcileNodes({ current: [], keepPlaced: false, mode, positions }),
    placementKey,
  }));
  if (synced.layoutKey !== layoutKey || synced.placementKey !== placementKey) {
    setSynced({
      layoutKey,
      nodes: reconcileNodes({
        current: synced.nodes,
        keepPlaced: synced.placementKey === placementKey,
        mode,
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
      type: CANVAS_EDGE_TYPES[mode],
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
      <GraphCameraStateContext value={cameraStateRef}>
        <GraphTreeSceneContext value={tree}>
          <GraphPersonSceneContext value={personValue}>
            <ReactFlow
              aria-label={t("label")}
              ariaLabelConfig={{
                "edge.a11yDescription.default": t("a11yEdge"),
                "node.a11yDescription.default": t("a11yNode"),
                "node.a11yDescription.keyboardDisabled": t("a11yNode"),
              }}
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              defaultViewport={
                mode === "genealogy" ? WORKSPACE_CANVAS.genealogyViewport : undefined
              }
              deleteKeyCode={null}
              disableKeyboardA11y
              edges={edges}
              edgesFocusable={false}
              edgeTypes={WORKSPACE_CANVAS.edgeTypes}
              elementsSelectable={false}
              fitViewOptions={WORKSPACE_CANVAS.fitViewOptions}
              maxZoom={WORKSPACE_CANVAS.maxZoom}
              minZoom={mode === "genealogy" ? GENEALOGY_CAMERA.minZoom : WORKSPACE_CANVAS.minZoom}
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
              onMoveStart={(event) => {
                if (event instanceof Event)
                  cameraStateRef.current = { mode: "manual", target: null };
              }}
              onNodesChange={changeNodes}
              onPaneClick={onPaneClick}
              preventScrolling={capturesWheel}
              selectionKeyCode={null}
              style={WORKSPACE_CANVAS.style}
              zoomOnScroll={capturesWheel}
            >
              {person === null ? null : (
                <>
                  <GraphPersonRings />
                  <GraphPersonCameraFollow
                    cover={
                      person.miniMap?.isOpen
                        ? withGraphPersonMiniMapCover(person.cover)
                        : person.cover
                    }
                  />
                  {person.miniMap?.isOpen ? <GraphPersonMiniMap /> : null}
                </>
              )}
              {tree === null ? null : (
                <>
                  <GraphTreeGenerationRail />
                  <GraphTreeCameraFollow />
                  {tree.miniMap?.isOpen ? <GraphTreeMiniMap /> : null}
                  {tree.genealogy === null ? null : (
                    <>
                      <GraphGenealogyFrames />
                      <GraphGenealogyCameraFocus />
                      <GraphGenealogyLandmarks />
                    </>
                  )}
                </>
              )}
              <GraphWorkspaceCanvasControls {...controls} sceneKey={sceneKey} viewport={viewport} />
            </ReactFlow>
          </GraphPersonSceneContext>
        </GraphTreeSceneContext>
      </GraphCameraStateContext>
    </GraphSceneContext>
  );
}

function reconcileNodes({
  current,
  keepPlaced,
  mode,
  positions,
}: {
  current: readonly GraphSceneFlowNode[];
  keepPlaced: boolean;
  mode: CanvasMode;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
}): GraphSceneFlowNode[] {
  const currentById = new Map(current.map((node) => [node.id, node]));
  return [...positions.entries()].map(([id, position]): GraphSceneFlowNode => {
    const previous = currentById.get(id);
    const type = toNodeType({ id, mode });
    return previous === undefined
      ? { data: {}, id, position, type }
      : { ...previous, position: keepPlaced ? previous.position : position, type };
  });
}

function toCanvasMode({
  person,
  tree,
}: {
  person: Nullable<GraphPersonCanvasScene>;
  tree: Nullable<GraphTreeCanvasScene>;
}): CanvasMode {
  if (tree !== null) return tree.genealogy === null ? "tree" : "genealogy";
  return person === null ? "default" : "person";
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

function toNodeType({ id, mode }: { id: string; mode: CanvasMode }): GraphSceneFlowNode["type"] {
  if (isNetworkClusterId(id)) return GRAPH_SCENE_FLOW.clusterNode;
  return CANVAS_NODE_TYPES[mode];
}
