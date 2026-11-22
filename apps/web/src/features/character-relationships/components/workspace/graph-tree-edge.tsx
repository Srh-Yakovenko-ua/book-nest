"use client";

import type { Nullable } from "@app/shared";

import {
  EdgeLabelRenderer,
  type EdgeProps,
  type InternalNode,
  useInternalNode,
  useStore,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

import type { TreeEdgeBox, TreeEdgeGeometry } from "../../model/workspace/graph-tree-edge-geometry";
import type { TreePairSemantics } from "../../model/workspace/graph-tree-pairs";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

import {
  toTreeArcGeometry,
  toTreeLineageGeometry,
  toTreeStraightGeometry,
} from "../../model/workspace/graph-tree-edge-geometry";
import { useGraphScene } from "./graph-scene-context";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { GRAPH_TREE_LINEAGE_DASH, GRAPH_TREE_TONES } from "./graph-tree-tones";
import { useGraphTreeLabels } from "./use-graph-tree-labels";

const TREE_EDGE_STYLES = {
  badge:
    "pointer-events-none absolute flex items-center gap-0.5 rounded-full border px-1 py-0.5 text-xs leading-none font-semibold text-foreground shadow-soft",
  badgeFrom: 0.5,
  halo: "fill-none stroke-ring/30",
  hit: "cursor-pointer fill-none stroke-transparent outline-none",
  hitWidth: 18,
  kindLabelFrom: 0.75,
  width: { idle: 2, selected: 3.5 },
} as const;

export function GraphTreeEdge({ id, source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const { selection } = useGraphScene();
  const { arcPairIds, pairs } = useGraphTreeScene();
  const labels = useGraphTreeLabels();
  const zoomAllowsBadge = useStore((state) => state.transform[2] >= TREE_EDGE_STYLES.badgeFrom);
  const zoomAllowsKind = useStore((state) => state.transform[2] >= TREE_EDGE_STYLES.kindLabelFrom);
  const pair = pairs.get(id);
  const lineage = pair?.lineage ?? null;
  const [fromId, toId] = lineage === null ? [source, target] : [lineage.parentId, lineage.childId];
  const fromNode = useInternalNode<GraphSceneFlowNode>(fromId);
  const toNode = useInternalNode<GraphSceneFlowNode>(toId);
  if (pair === undefined) return null;
  const fromBox = toBox(fromNode);
  const toBoxValue = toBox(toNode);
  if (fromBox === null || toBoxValue === null) return null;

  const geometry = toGeometry({
    from: fromBox,
    isArc: arcPairIds.has(id),
    pair,
    to: toBoxValue,
  });
  const tone = GRAPH_TREE_TONES[pair.style];
  const Icon = tone.icon;
  const isSelected = selection?.kind === "connection" && selection.id === id;
  const dash =
    pair.style === "lineage" && pair.lineage !== null
      ? GRAPH_TREE_LINEAGE_DASH[pair.lineage.kind]
      : tone.dash;
  const showBadge = zoomAllowsBadge && (pair.style !== "lineage" || pair.relationshipCount > 1);
  const showKind =
    zoomAllowsKind &&
    pair.style === "lineage" &&
    pair.lineage !== null &&
    pair.lineage.kind !== "biological";

  return (
    <g>
      <title>{labels.pair(pair)}</title>
      {isSelected ? (
        <path className={TREE_EDGE_STYLES.halo} d={geometry.path} strokeWidth={10} />
      ) : null}
      <path
        className={cn("fill-none", tone.line)}
        d={geometry.path}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={isSelected ? TREE_EDGE_STYLES.width.selected : TREE_EDGE_STYLES.width.idle}
      />
      <path
        className={TREE_EDGE_STYLES.hit}
        d={geometry.path}
        strokeWidth={TREE_EDGE_STYLES.hitWidth}
      />
      {showBadge || showKind ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden
            className={cn(TREE_EDGE_STYLES.badge, tone.badge)}
            style={{
              transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)`,
            }}
          >
            <Icon className={cn("size-3.5 shrink-0", tone.iconColor)} />
            {showKind && pair.lineage !== null ? (
              <span className="px-0.5 font-medium">{labels.lineageShort(pair.lineage.kind)}</span>
            ) : null}
            {pair.relationshipCount > 1 ? (
              <span className="pr-0.5 tabular-nums">{`×${pair.relationshipCount}`}</span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

function toBox(node: InternalNode<GraphSceneFlowNode> | undefined): Nullable<TreeEdgeBox> {
  if (node === undefined) return null;
  const { height, width } = node.measured;
  if (height === undefined || width === undefined) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { height, width, x, y };
}

function toGeometry({
  from,
  isArc,
  pair,
  to,
}: {
  from: TreeEdgeBox;
  isArc: boolean;
  pair: TreePairSemantics;
  to: TreeEdgeBox;
}): TreeEdgeGeometry {
  if (pair.lineage !== null) return toTreeLineageGeometry({ child: to, parent: from });
  if (isArc) return toTreeArcGeometry({ source: from, target: to });
  return toTreeStraightGeometry({ source: from, target: to });
}
