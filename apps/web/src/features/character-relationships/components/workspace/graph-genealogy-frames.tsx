"use client";

import { useStore, ViewportPortal } from "@xyflow/react";

import { useGraphTreeScene } from "./graph-tree-scene-context";

const GENEALOGY_FRAMES = {
  gap: 28,
} as const;

export function GraphGenealogyFrames() {
  const { genealogy } = useGraphTreeScene();
  const zoom = useStore((state) => state.transform[2]);
  const frames = genealogy?.frames ?? [];
  if (frames.length < 2) return null;

  return (
    <ViewportPortal>
      <div aria-hidden className="pointer-events-none">
        {frames.map((frame) => (
          <div
            className="absolute origin-bottom-left rounded-full border border-border bg-card/90 px-3 py-1 font-heading text-sm font-semibold whitespace-nowrap text-ink shadow-soft"
            key={frame.componentId}
            style={{
              left: frame.left,
              top: frame.top - GENEALOGY_FRAMES.gap / zoom,
              transform: `translateY(-100%) scale(${1 / zoom})`,
            }}
          >
            {frame.label}
          </div>
        ))}
      </div>
    </ViewportPortal>
  );
}
