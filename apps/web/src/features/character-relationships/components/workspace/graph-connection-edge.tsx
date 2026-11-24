"use client";

import type { Nullable } from "@app/shared";

import {
  EdgeLabelRenderer,
  type EdgeProps,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

import type { RelationshipGraphRect } from "../../model/relationship-graph-geometry";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

import { toRelationshipGraphEdgeGeometry } from "../../model/relationship-graph-geometry";
import { isNetworkClusterId } from "../../model/workspace/graph-network-index";
import { useGraphNetworkScene } from "./graph-network-scene-context";
import { useGraphScene } from "./graph-scene-context";

export const CONNECTION_EDGE_STYLES = {
  aggregate: {
    default: "fill-none stroke-muted-foreground",
    selected: "fill-none stroke-primary",
  },
  aggregateWidth: { max: 6, min: 1.5, perPair: 0.5 },
  arrow: { default: "fill-muted-foreground", selected: "fill-primary" },
  badge: {
    base: "pointer-events-none absolute hidden min-w-6 items-center justify-center rounded-full border bg-card px-1.5 text-xs font-semibold tabular-nums shadow-sm zoom-details:flex zoom-exploration:flex",
    default: "border-border text-foreground",
    selected: "border-primary text-primary",
  },
  dash: "6 6",
  dimmed: { dash: "2 4", opacity: 0.75, width: 1 },
  group: "transition-opacity duration-200 motion-reduce:transition-none",
  hit: "cursor-pointer fill-none stroke-transparent outline-none",
  hitWidth: 24,
  line: { default: "fill-none stroke-muted-foreground", selected: "fill-none stroke-primary" },
  opacity: { idle: 1, memberLink: 0.75 },
  width: { default: 1.75, selected: 3 },
} as const;

type EdgeStroke = Readonly<{ dash: string | undefined; opacity: number; width: number }>;

export function GraphAggregateEdge({ id, source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const { selection } = useGraphScene();
  const { aggregates, emphasis } = useGraphNetworkScene();
  const geometry = useEdgeGeometry({ isDirected: false, source, target });
  const aggregate = aggregates.get(id);
  if (geometry === null || aggregate === undefined) return null;

  const isSelected = selection?.kind === "aggregate" && selection.id === id;
  const isEmphasized = isSelected || (emphasis?.connectionIds.has(id) ?? false);
  const isMemberLink = !isNetworkClusterId(source) || !isNetworkClusterId(target);
  const tone = isEmphasized ? "selected" : "default";
  const stroke = toAggregateStroke({
    hasEmphasis: emphasis !== null,
    isEmphasized,
    isMemberLink,
    isSelected,
    pairCount: aggregate.pairCount,
  });

  return (
    <g className={CONNECTION_EDGE_STYLES.group} opacity={stroke.opacity}>
      <path
        className={CONNECTION_EDGE_STYLES.aggregate[tone]}
        d={geometry.path}
        strokeDasharray={stroke.dash}
        strokeLinecap="round"
        strokeWidth={stroke.width}
      />
      <path
        className={CONNECTION_EDGE_STYLES.hit}
        d={geometry.path}
        strokeWidth={CONNECTION_EDGE_STYLES.hitWidth}
      />
      {isMemberLink && !isEmphasized ? null : (
        <EdgeLabelRenderer>
          <span
            aria-hidden
            className={cn(CONNECTION_EDGE_STYLES.badge.base, CONNECTION_EDGE_STYLES.badge[tone])}
            style={{
              transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)`,
            }}
          >
            {aggregate.pairCount}
          </span>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

export function GraphConnectionEdge({ id, source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const { connections, selection } = useGraphScene();
  const { emphasis } = useGraphNetworkScene();
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
  const isEmphasized = isSelected || (emphasis?.connectionIds.has(id) ?? false);
  const tone = isEmphasized ? "selected" : "default";
  const isDimmed = emphasis !== null && !isEmphasized;
  const stroke: EdgeStroke = isDimmed
    ? CONNECTION_EDGE_STYLES.dimmed
    : {
        dash: undefined,
        opacity: CONNECTION_EDGE_STYLES.opacity.idle,
        width: CONNECTION_EDGE_STYLES.width[tone],
      };

  return (
    <g className={CONNECTION_EDGE_STYLES.group} opacity={stroke.opacity}>
      <path
        className={CONNECTION_EDGE_STYLES.line[tone]}
        d={geometry.path}
        strokeDasharray={stroke.dash}
        strokeWidth={stroke.width}
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

function toAggregateStroke({
  hasEmphasis,
  isEmphasized,
  isMemberLink,
  isSelected,
  pairCount,
}: {
  hasEmphasis: boolean;
  isEmphasized: boolean;
  isMemberLink: boolean;
  isSelected: boolean;
  pairCount: number;
}): EdgeStroke {
  const { dash, opacity } = CONNECTION_EDGE_STYLES;
  const { max, min, perPair } = CONNECTION_EDGE_STYLES.aggregateWidth;
  const width = Math.min(max, min + (pairCount - 1) * perPair);
  if (isEmphasized) return { dash, opacity: opacity.idle, width: isSelected ? width + 1 : width };
  if (hasEmphasis) return CONNECTION_EDGE_STYLES.dimmed;
  if (isMemberLink) return { dash, opacity: opacity.memberLink, width: min };
  return { dash, opacity: opacity.idle, width };
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
