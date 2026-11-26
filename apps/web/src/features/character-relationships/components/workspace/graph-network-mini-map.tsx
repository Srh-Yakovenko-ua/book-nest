"use client";

import { MiniMap } from "@xyflow/react";
import { useTranslations } from "next-intl";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { isNetworkClusterId } from "../../model/workspace/graph-network-index";
import { useGraphNetworkScene } from "./graph-network-scene-context";
import { useGraphScene } from "./graph-scene-context";

const NETWORK_MINI_MAP = {
  className: "overflow-hidden rounded-xl border border-border shadow-soft",
  colors: {
    background: "var(--card)",
    cluster: "var(--accent-border)",
    emphasized: "var(--foreground)",
    mask: "color-mix(in oklch, var(--secondary) 72%, transparent)",
    maskStroke: "var(--ring)",
    node: "var(--muted-foreground)",
    selected: "var(--primary)",
  },
  nodeRadius: 16,
  size: { height: 104, width: 156 },
} as const;

export function GraphNetworkMiniMap() {
  const t = useTranslations("relationships.workspace.network");
  const { selection } = useGraphScene();
  const { emphasis } = useGraphNetworkScene();
  const { colors } = NETWORK_MINI_MAP;

  function toNodeColor(node: GraphSceneFlowNode): string {
    if (selection !== null && selection.id === node.id) return colors.selected;
    if (emphasis?.characterIds.has(node.id)) return colors.emphasized;
    return isNetworkClusterId(node.id) ? colors.cluster : colors.node;
  }

  return (
    <MiniMap<GraphSceneFlowNode>
      ariaLabel={t("miniMap")}
      bgColor={colors.background}
      className={NETWORK_MINI_MAP.className}
      maskColor={colors.mask}
      maskStrokeColor={colors.maskStroke}
      maskStrokeWidth={1.5}
      nodeBorderRadius={NETWORK_MINI_MAP.nodeRadius}
      nodeColor={toNodeColor}
      pannable
      position="bottom-right"
      style={NETWORK_MINI_MAP.size}
    />
  );
}
