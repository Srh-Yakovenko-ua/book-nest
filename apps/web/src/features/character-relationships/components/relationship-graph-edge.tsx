"use client";

import type { Nullable } from "@app/shared";

import {
  EdgeLabelRenderer,
  type EdgeProps,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type {
  RelationshipGraphFlowEdge,
  RelationshipGraphFlowNode,
} from "../model/relationship-graph-flow";
import type { RelationshipGraphRect } from "../model/relationship-graph-geometry";
import type { RelationshipGraphEmphasis } from "../model/relationship-graph-path";

import { toRelationshipGraphEdgeGeometry } from "../model/relationship-graph-geometry";
import { useRelationshipGraphCanvas } from "./relationship-graph-canvas-context";

const GRAPH_EDGE_STYLES = {
  emphasis: {
    default: {
      arrow: "fill-muted-foreground",
      label: "border-border text-muted-foreground",
      line: "stroke-muted-foreground",
      width: 1.5,
    },
    dimmed: {
      arrow: "fill-border",
      label: "border-border text-muted-foreground opacity-40",
      line: "stroke-border",
      width: 1,
    },
    path: {
      arrow: "fill-primary",
      label: "border-primary text-primary",
      line: "stroke-primary",
      width: 3,
    },
  },
  hitWidth: 18,
  label:
    "nodrag nopan pointer-events-auto absolute top-0 left-0 flex max-w-40 cursor-pointer items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
  typeHiddenLabel: "italic",
} as const satisfies {
  emphasis: Record<
    RelationshipGraphEmphasis,
    { arrow: string; label: string; line: string; width: number }
  >;
  hitWidth: number;
  label: string;
  typeHiddenLabel: string;
};

export function RelationshipGraphEdge({
  data,
  id,
  source,
  target,
}: EdgeProps<RelationshipGraphFlowEdge>) {
  const sourceNode = useInternalNode<RelationshipGraphFlowNode>(source);
  const targetNode = useInternalNode<RelationshipGraphFlowNode>(target);
  const { onEdgeOpen } = useRelationshipGraphCanvas();
  if (data === undefined || sourceNode === undefined || targetNode === undefined) return null;

  const sourceRect = toRect(sourceNode);
  const targetRect = toRect(targetNode);
  if (sourceRect === null || targetRect === null) return null;

  const geometry = toRelationshipGraphEdgeGeometry({
    isDirected: data.isDirected,
    lane: data.lane,
    source: sourceRect,
    target: targetRect,
  });
  if (geometry === null) return null;

  const tone = GRAPH_EDGE_STYLES.emphasis[data.emphasis];

  return (
    <>
      <path className={cn("fill-none", tone.line)} d={geometry.path} strokeWidth={tone.width} />
      {geometry.arrow === null ? null : <polygon className={tone.arrow} points={geometry.arrow} />}
      <path
        className="cursor-pointer fill-none stroke-transparent"
        d={geometry.path}
        strokeWidth={GRAPH_EDGE_STYLES.hitWidth}
      />
      <EdgeLabelRenderer>
        <button
          aria-label={data.ariaLabel}
          className={cn(
            GRAPH_EDGE_STYLES.label,
            tone.label,
            data.isTypeHidden && GRAPH_EDGE_STYLES.typeHiddenLabel,
          )}
          onClick={(event) => {
            event.stopPropagation();
            onEdgeOpen(id);
          }}
          style={{
            transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)`,
          }}
          type="button"
        >
          {data.isTypeHidden ? <UiIcon name="eye-off" size={12} /> : null}
          <span className="truncate">{data.label}</span>
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

function toRect(node: InternalNode<RelationshipGraphFlowNode>): Nullable<RelationshipGraphRect> {
  const { height, width } = node.measured;
  if (height === undefined || width === undefined) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { height, width, x, y };
}
