"use client";

import "@xyflow/react/dist/base.css";

import type { CharacterGraphLayoutView, CharacterGraphView, Nullable } from "@app/shared";

import {
  type EdgeTypes,
  type FitViewOptions,
  type NodeOrigin,
  type NodeTypes,
  ReactFlow,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type CSSProperties, useState } from "react";

import type {
  RelationshipGraphFlowEdge,
  RelationshipGraphFlowNode,
} from "../model/relationship-graph-flow";
import type { RelationshipGraphPathState } from "../model/relationship-graph-path";
import type { RelationshipGraphCanvasLayout } from "./relationship-graph-canvas-actions";
import type { RelationshipGraphNodePresentation } from "./relationship-graph-canvas-context";

import { RELATIONSHIP_GRAPH_FLOW } from "../model/relationship-graph-flow";
import { toRelationshipGraphEdgeLanes } from "../model/relationship-graph-geometry";
import {
  computeRelationshipGraphAutoLayout,
  resolveRelationshipGraphPlacements,
} from "../model/relationship-graph-layout";
import { toRelationshipGraphEmphasis } from "../model/relationship-graph-path";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipGraphCanvasActions } from "./relationship-graph-canvas-actions";
import { RelationshipGraphCanvasContext } from "./relationship-graph-canvas-context";
import { RelationshipGraphEdge } from "./relationship-graph-edge";
import { RelationshipGraphNode } from "./relationship-graph-node";
import { toRelationshipGraphClusterTones } from "./relationship-graph-tones";

const GRAPH_CANVAS = {
  edgeTypes: { [RELATIONSHIP_GRAPH_FLOW.edgeType]: RelationshipGraphEdge },
  fitViewOptions: { padding: 0.2 },
  maxZoom: 2,
  minZoom: 0.1,
  nodeOrigin: [0.5, 0.5],
  nodeTypes: { [RELATIONSHIP_GRAPH_FLOW.nodeType]: RelationshipGraphNode },
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

export type RelationshipGraphCanvasProps = {
  activeNodeId: Nullable<string>;
  focusCharacterId: Nullable<string>;
  graph: CharacterGraphView;
  layout: RelationshipGraphCanvasLayout;
  onEdgeOpen: (edgeId: string) => void;
  onNodeOpen: (nodeId: string) => void;
  path: RelationshipGraphPathState;
  savedLayout: Nullable<CharacterGraphLayoutView>;
};

export function RelationshipGraphCanvas({
  activeNodeId,
  focusCharacterId,
  graph,
  layout,
  onEdgeOpen,
  onNodeOpen,
  path,
  savedLayout,
}: RelationshipGraphCanvasProps) {
  const t = useTranslations("relationships.graph");
  const labels = useRelationshipLabels();
  const { resolvedTheme } = useTheme();
  const autoPositions = computeRelationshipGraphAutoLayout({
    clusters: graph.clusters,
    focusCharacterId,
    nodes: graph.nodes,
  });
  const [initialFlow] = useState(() => ({
    nodes: resolveRelationshipGraphPlacements({
      auto: autoPositions,
      nodes: graph.nodes,
      saved: savedLayout?.positions ?? null,
    }).map((placement): RelationshipGraphFlowNode => ({
      data: {},
      id: placement.id,
      position: placement.position,
      type: RELATIONSHIP_GRAPH_FLOW.nodeType,
    })),
    viewport: savedLayout?.viewport ?? null,
  }));

  const highlightedNodes = path.kind === "found" ? path.nodeIds : null;
  const highlightedEdges = path.kind === "found" ? path.edgeIds : null;
  const clusterTones = toRelationshipGraphClusterTones(graph.clusters);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const lanes = toRelationshipGraphEdgeLanes(graph.edges);

  const nodes = new Map(
    graph.nodes.map((node): [string, RelationshipGraphNodePresentation] => [
      node.id,
      {
        emphasis: toRelationshipGraphEmphasis({ highlighted: highlightedNodes, id: node.id }),
        isActive: node.id === activeNodeId,
        node,
        tone: node.clusterId === null ? null : (clusterTones.get(node.clusterId) ?? null),
      },
    ]),
  );

  const edges = graph.edges.map((edge): RelationshipGraphFlowEdge => {
    const label =
      (edge.typeHidden ? null : labels.edgeType({ customType: null, type: edge.type })) ??
      t("edge.hiddenType");
    const participants = {
      label,
      source: nodeById.get(edge.source)?.name ?? "",
      target: nodeById.get(edge.target)?.name ?? "",
    };
    return {
      ariaLabel: t("edge.description", participants),
      data: {
        ariaLabel: t("edge.open", participants),
        emphasis: toRelationshipGraphEmphasis({ highlighted: highlightedEdges, id: edge.id }),
        isDirected: edge.directionality === "directed",
        isTypeHidden: edge.typeHidden || edge.type === null,
        label,
        lane: lanes.get(edge.id) ?? 0,
      },
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: RELATIONSHIP_GRAPH_FLOW.edgeType,
    };
  });

  return (
    <RelationshipGraphCanvasContext value={{ nodes, onEdgeOpen, onNodeOpen }}>
      <ReactFlow
        ariaLabelConfig={{
          "edge.a11yDescription.default": t("a11y.edge"),
          "node.a11yDescription.default": t("a11y.node"),
          "node.a11yDescription.keyboardDisabled": t("a11y.node"),
        }}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        defaultNodes={initialFlow.nodes}
        defaultViewport={initialFlow.viewport ?? undefined}
        deleteKeyCode={null}
        disableKeyboardA11y
        edges={edges}
        edgesFocusable={false}
        edgeTypes={GRAPH_CANVAS.edgeTypes}
        elementsSelectable={false}
        fitView={initialFlow.viewport === null}
        fitViewOptions={GRAPH_CANVAS.fitViewOptions}
        maxZoom={GRAPH_CANVAS.maxZoom}
        minZoom={GRAPH_CANVAS.minZoom}
        multiSelectionKeyCode={null}
        nodeOrigin={GRAPH_CANVAS.nodeOrigin}
        nodesConnectable={false}
        nodesFocusable={false}
        nodeTypes={GRAPH_CANVAS.nodeTypes}
        onEdgeClick={(_event, edge) => onEdgeOpen(edge.id)}
        preventScrolling={false}
        selectionKeyCode={null}
        style={GRAPH_CANVAS.style}
        zoomOnScroll={false}
      >
        <RelationshipGraphCanvasActions
          autoPositions={autoPositions}
          layout={layout}
          layoutVersion={graph.graphVersion}
        />
      </ReactFlow>
    </RelationshipGraphCanvasContext>
  );
}
