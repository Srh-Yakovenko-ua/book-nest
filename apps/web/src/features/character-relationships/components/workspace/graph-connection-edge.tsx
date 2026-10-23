"use client";

import type { Nullable } from "@app/shared";

import { type EdgeProps, type InternalNode, useInternalNode } from "@xyflow/react";

import type { RelationshipGraphRect } from "../../model/relationship-graph-geometry";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

import { toRelationshipGraphEdgeGeometry } from "../../model/relationship-graph-geometry";
import { useGraphScene } from "./graph-scene-context";

const CONNECTION_EDGE_STYLES = {
  aggregate: "fill-none stroke-muted-foreground",
  aggregateWidth: 1.5,
  arrow: { default: "fill-muted-foreground", selected: "fill-primary" },
  hit: "cursor-pointer fill-none stroke-transparent outline-none",
  hitWidth: 24,
  line: { default: "fill-none stroke-muted-foreground", selected: "fill-none stroke-primary" },
  width: { default: 1.75, selected: 3 },
} as const;

export function GraphAggregateEdge({ source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const geometry = useEdgeGeometry({ isDirected: false, source, target });
  if (geometry === null) return null;

  return (
    <g>
      <path
        className={CONNECTION_EDGE_STYLES.aggregate}
        d={geometry.path}
        strokeDasharray="6 6"
        strokeWidth={CONNECTION_EDGE_STYLES.aggregateWidth}
      />
      <path
        className={CONNECTION_EDGE_STYLES.hit}
        d={geometry.path}
        strokeWidth={CONNECTION_EDGE_STYLES.hitWidth}
      />
    </g>
  );
}

export function GraphConnectionEdge({ id, source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const { connections, selection } = useGraphScene();
  const connection = connections.get(id);
  const isDirected = connection?.direction.kind === "directed";
  const reversed =
    connection?.direction.kind === "directed" && connection.direction.sourceId !== source;
  const geometry = useEdgeGeometry({
    isDirected,
    source: reversed ? target : source,
    target: reversed ? source : target,
  });
  if (connection === undefined || geometry === null) return null;

  const isSelected = selection?.kind === "connection" && selection.id === id;
  const tone = isSelected ? "selected" : "default";

  return (
    <g>
      <path
        className={CONNECTION_EDGE_STYLES.line[tone]}
        d={geometry.path}
        strokeWidth={CONNECTION_EDGE_STYLES.width[tone]}
      />
      {geometry.arrow === null ? null : (
        <polygon className={CONNECTION_EDGE_STYLES.arrow[tone]} points={geometry.arrow} />
      )}
      <path
        className={CONNECTION_EDGE_STYLES.hit}
        d={geometry.path}
        strokeWidth={CONNECTION_EDGE_STYLES.hitWidth}
      />
    </g>
  );
}

function toRect(node: InternalNode<GraphSceneFlowNode>): Nullable<RelationshipGraphRect> {
  const { height, width } = node.measured;
  if (height === undefined || width === undefined) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { height, width, x, y };
}

function useEdgeGeometry({
  isDirected,
  source,
  target,
}: {
  isDirected: boolean;
  source: string;
  target: string;
}) {
  const sourceNode = useInternalNode<GraphSceneFlowNode>(source);
  const targetNode = useInternalNode<GraphSceneFlowNode>(target);
  if (sourceNode === undefined || targetNode === undefined) return null;
  const sourceRect = toRect(sourceNode);
  const targetRect = toRect(targetNode);
  if (sourceRect === null || targetRect === null) return null;
  return toRelationshipGraphEdgeGeometry({
    isDirected,
    lane: 0,
    source: sourceRect,
    target: targetRect,
  });
}
