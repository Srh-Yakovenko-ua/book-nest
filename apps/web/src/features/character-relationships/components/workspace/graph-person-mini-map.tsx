"use client";

import { MiniMap } from "@xyflow/react";
import { useTranslations } from "next-intl";

import type { GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { useGraphPersonScene } from "./graph-person-scene-context";

const PERSON_MINI_MAP = {
  className: "overflow-hidden rounded-xl border border-border shadow-soft",
  colors: {
    background: "var(--card)",
    emphasized: "var(--foreground)",
    mask: "color-mix(in oklch, var(--secondary) 72%, transparent)",
    maskStroke: "var(--ring)",
    node: "var(--muted-foreground)",
    root: "var(--primary)",
  },
  nodeRadius: 64,
  revealCover: 128,
  size: { height: 104, width: 156 },
} as const;

export function GraphPersonMiniMap() {
  const t = useTranslations("relationships.workspace.canvas");
  const { emphasis, rootId } = useGraphPersonScene();
  const { colors } = PERSON_MINI_MAP;

  function toNodeColor(node: GraphSceneFlowNode): string {
    if (node.id === rootId) return colors.root;
    return emphasis?.characterIds.has(node.id) ? colors.emphasized : colors.node;
  }

  return (
    <MiniMap<GraphSceneFlowNode>
      ariaLabel={t("miniMap.label")}
      bgColor={colors.background}
      className={PERSON_MINI_MAP.className}
      maskColor={colors.mask}
      maskStrokeColor={colors.maskStroke}
      maskStrokeWidth={1.5}
      nodeBorderRadius={PERSON_MINI_MAP.nodeRadius}
      nodeColor={toNodeColor}
      pannable
      position="bottom-right"
      style={PERSON_MINI_MAP.size}
    />
  );
}

export function withGraphPersonMiniMapCover(cover: GraphPersonCover): GraphPersonCover {
  return { ...cover, bottom: Math.max(cover.bottom, PERSON_MINI_MAP.revealCover) };
}
