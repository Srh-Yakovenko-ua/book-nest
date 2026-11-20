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

import type { GraphPersonCircle } from "../../model/workspace/graph-person-edge-geometry";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

import { toGraphPersonDetailLevel } from "../../model/workspace/graph-person-camera";
import { toGraphPersonEdgeGeometry } from "../../model/workspace/graph-person-edge-geometry";
import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { useGraphPersonScene } from "./graph-person-scene-context";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";
import { useGraphScene } from "./graph-scene-context";
import { useGraphPairLabel } from "./use-graph-pair-label";

const PERSON_EDGE_STYLES = {
  group: "transition-opacity duration-200 motion-reduce:transition-none",
  halo: "fill-none stroke-ring/25",
  hit: "cursor-pointer fill-none stroke-transparent outline-none",
  hitWidth: 24,
  labelCharWidth: 6.5,
  labelPadding: 40,
  opacity: { dimmed: 0.3, emphasized: 1, idle: 1 },
  width: { emphasized: 3, idle: 2, selected: 3.5 },
} as const;

export function GraphPersonEdge({ id, source, target }: EdgeProps<GraphSceneFlowEdge>) {
  const { connections, selection } = useGraphScene();
  const { emphasis, labelPairIds, onFocusChange, semantics } = useGraphPersonScene();
  const toLabel = useGraphPairLabel();
  const zoomAllowsLabel = useStore(
    (state) => toGraphPersonDetailLevel(state.transform[2]) === "detail",
  );
  const connection = connections.get(id);
  const pair = semantics.get(id);
  const isDirected = connection?.direction.kind === "directed" && pair?.tone !== "masked";
  const reversed =
    isDirected &&
    connection?.direction.kind === "directed" &&
    connection.direction.sourceId !== source;
  const sourceNode = useInternalNode<GraphSceneFlowNode>(reversed ? target : source);
  const targetNode = useInternalNode<GraphSceneFlowNode>(reversed ? source : target);
  if (connection === undefined || pair === undefined) return null;
  const sourceCircle = toCircle(sourceNode);
  const targetCircle = toCircle(targetNode);
  if (sourceCircle === null || targetCircle === null) return null;
  const geometry = toGraphPersonEdgeGeometry({
    isDirected,
    source: sourceCircle,
    target: targetCircle,
  });
  if (geometry === null) return null;

  const tone = GRAPH_PERSON_TONES[pair.tone];
  const isSelected = selection?.kind === "connection" && selection.id === id;
  const isEmphasized = isSelected || (emphasis?.connectionIds.has(id) ?? false);
  const isDimmed = emphasis !== null && !emphasis.connectionIds.has(id) && !isSelected;
  const strokeWidth = isSelected
    ? PERSON_EDGE_STYLES.width.selected
    : PERSON_EDGE_STYLES.width[isEmphasized ? "emphasized" : "idle"];
  const opacity = isDimmed
    ? PERSON_EDGE_STYLES.opacity.dimmed
    : PERSON_EDGE_STYLES.opacity[isEmphasized ? "emphasized" : "idle"];
  const labelWidth =
    toLabel(pair).length * PERSON_EDGE_STYLES.labelCharWidth + PERSON_EDGE_STYLES.labelPadding;
  const showLabel =
    zoomAllowsLabel && !isDimmed && labelPairIds.has(id) && geometry.freeLength >= labelWidth;

  return (
    <g
      className={PERSON_EDGE_STYLES.group}
      onMouseEnter={() => onFocusChange({ id, kind: "connection" })}
      onMouseLeave={() => onFocusChange(null)}
      opacity={opacity}
    >
      {isSelected ? (
        <path className={PERSON_EDGE_STYLES.halo} d={geometry.path} strokeWidth={10} />
      ) : null}
      <path
        className={cn("fill-none", tone.line)}
        d={geometry.path}
        strokeDasharray={tone.dash}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
      {geometry.arrow === null ? null : <polygon className={tone.arrow} points={geometry.arrow} />}
      <path
        className={PERSON_EDGE_STYLES.hit}
        d={geometry.path}
        strokeWidth={PERSON_EDGE_STYLES.hitWidth}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden
            className="pointer-events-none absolute max-w-40"
            style={{
              transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)`,
            }}
          >
            <GraphPersonRelationChip semantics={pair} size="canvas" />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

function toCircle(node: InternalNode<GraphSceneFlowNode> | undefined): Nullable<GraphPersonCircle> {
  if (node === undefined) return null;
  const { height, width } = node.measured;
  if (height === undefined || width === undefined) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { center: { x: x + width / 2, y: y + height / 2 }, radius: Math.min(width, height) / 2 };
}
