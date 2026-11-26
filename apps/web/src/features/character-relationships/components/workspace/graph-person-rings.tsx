"use client";

import { useNodes, useViewport } from "@xyflow/react";
import { useTranslations } from "next-intl";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { toGraphPersonRings } from "../../model/workspace/graph-person-rings";
import { useGraphScene } from "./graph-scene-context";

const PERSON_RINGS = {
  minZoom: 0.2,
} as const;

export function GraphPersonRings() {
  const t = useTranslations("relationships.workspace.rings");
  const { characters } = useGraphScene();
  const nodes = useNodes<GraphSceneFlowNode>();
  const { x, y, zoom } = useViewport();
  if (zoom < PERSON_RINGS.minZoom) return null;

  const rings = toGraphPersonRings({
    hops: new Map(
      nodes.flatMap((node) => {
        const hop = characters.get(node.id)?.hop;
        return hop === undefined || hop === null ? [] : [[node.id, hop] as const];
      }),
    ),
    positions: new Map(nodes.map((node) => [node.id, node.position] as const)),
  });
  if (rings === null) return null;
  const centerX = rings.center.x * zoom + x;
  const centerY = rings.center.y * zoom + y;

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 size-full">
      {rings.radii.map((ring) => (
        <g key={ring.hop}>
          <circle
            className="fill-none stroke-border"
            cx={centerX}
            cy={centerY}
            r={ring.radius * zoom}
            strokeDasharray="4 7"
            strokeWidth={1.25}
          />
          <text
            className="fill-muted-foreground stroke-card text-xs font-medium"
            dominantBaseline="middle"
            paintOrder="stroke"
            strokeWidth={5}
            textAnchor="middle"
            x={centerX + Math.cos(ring.labelAngle) * ring.radius * zoom}
            y={centerY + Math.sin(ring.labelAngle) * ring.radius * zoom}
          >
            {t("hop", { hop: ring.hop })}
          </text>
        </g>
      ))}
    </svg>
  );
}
