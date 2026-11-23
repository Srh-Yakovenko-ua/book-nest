"use client";

import { MiniMap } from "@xyflow/react";
import { useTranslations } from "next-intl";

import type { GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { toGraphGenealogyHouseTone } from "./graph-genealogy-tones";
import { useGraphTreeScene } from "./graph-tree-scene-context";

const TREE_MINI_MAP = {
  className: "overflow-hidden rounded-xl border border-border shadow-soft",
  colors: {
    background: "var(--card)",
    mask: "color-mix(in oklch, var(--secondary) 72%, transparent)",
    maskStroke: "var(--ring)",
    node: "var(--muted-foreground)",
    root: "var(--primary)",
  },
  nodeRadius: 32,
  revealCover: 128,
  size: { height: 104, width: 156 },
} as const;

export function GraphTreeMiniMap() {
  const t = useTranslations("relationships.workspace.tree");
  const { genealogy, rootId } = useGraphTreeScene();
  const { colors } = TREE_MINI_MAP;

  return (
    <MiniMap<GraphSceneFlowNode>
      ariaLabel={t("miniMap")}
      bgColor={colors.background}
      className={TREE_MINI_MAP.className}
      maskColor={colors.mask}
      maskStrokeColor={colors.maskStroke}
      maskStrokeWidth={1.5}
      nodeBorderRadius={TREE_MINI_MAP.nodeRadius}
      nodeColor={(node) => {
        if (node.id === rootId) return colors.root;
        const house = genealogy?.houseById.get(node.id);
        return house === undefined ? colors.node : toGraphGenealogyHouseTone(house.tone).miniMap;
      }}
      pannable
      position="bottom-right"
      style={TREE_MINI_MAP.size}
    />
  );
}

export function withGraphTreeMiniMapCover(cover: GraphPersonCover): GraphPersonCover {
  return { ...cover, bottom: Math.max(cover.bottom, TREE_MINI_MAP.revealCover) };
}
