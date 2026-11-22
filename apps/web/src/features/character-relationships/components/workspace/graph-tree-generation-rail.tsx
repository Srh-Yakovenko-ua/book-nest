"use client";

import { useStore, ViewportPortal } from "@xyflow/react";

import { TREE_CAMERA } from "../../model/workspace/graph-tree-camera";
import { TREE_LAYOUT } from "../../model/workspace/graph-tree-layout";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useGraphTreeLabels } from "./use-graph-tree-labels";

const GENERATION_RAIL = {
  bandInset: 14,
  bandPadding: 32,
  labelGap: 20,
  labelInset: 12,
  minRowHeight: 48,
} as const;

export function GraphTreeGenerationRail() {
  const { rows } = useGraphTreeScene();
  const labels = useGraphTreeLabels();
  const translateX = useStore((state) => state.transform[0]);
  const zoom = useStore((state) => state.transform[2]);
  const extent = useStore((state) => {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const node of state.nodeLookup.values()) {
      const width = node.measured.width ?? 0;
      left = Math.min(left, node.internals.positionAbsolute.x);
      right = Math.max(right, node.internals.positionAbsolute.x + width);
    }
    return Number.isFinite(left) && Number.isFinite(right) ? `${left}:${right}` : "";
  });
  const [leftText, rightText] = extent.split(":");
  if (leftText === undefined || rightText === undefined) return null;
  const left = Number(leftText) - TREE_CAMERA.rail;
  const width = Number(rightText) - left + GENERATION_RAIL.bandPadding;
  const height = TREE_LAYOUT.rowStep - GENERATION_RAIL.bandInset * 2;
  const confirmed = rows.flatMap((row) =>
    row.generation === null ? [] : [{ generation: row.generation, row: row.row, y: row.y }],
  );
  const showLabels = TREE_LAYOUT.rowStep * zoom >= GENERATION_RAIL.minRowHeight;
  const labelLeft = Math.max(
    GENERATION_RAIL.labelInset,
    left * zoom + translateX + GENERATION_RAIL.labelGap,
  );

  return (
    <ViewportPortal>
      <div aria-hidden className="pointer-events-none">
        {confirmed.map((row) => (
          <div
            className="absolute -z-10 rounded-3xl bg-secondary/40 dark:bg-secondary/25"
            key={row.row}
            style={{ height, left, top: row.y - height / 2, width }}
          />
        ))}
        {showLabels
          ? confirmed.map((row) => (
              <div
                className="absolute -z-5 flex origin-left flex-col gap-0.5 rounded-xl bg-card/85 px-2.5 py-1 shadow-soft"
                key={`label-${row.row}`}
                style={{
                  left: (labelLeft - translateX) / zoom,
                  top: row.y,
                  transform: `translateY(-50%) scale(${1 / zoom})`,
                }}
              >
                <span className="font-heading text-sm leading-tight font-semibold text-ink">
                  {labels.generation(row.generation)}
                </span>
                <span className="text-xs leading-tight text-muted-foreground">
                  {labels.generationCaption(row.generation)}
                </span>
              </div>
            ))
          : null}
      </div>
    </ViewportPortal>
  );
}
