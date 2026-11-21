"use client";

import type { FocusEvent } from "react";

import { useReactFlow } from "@xyflow/react";

import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

export function useRevealOnFocus(nodeId: string): (event: FocusEvent<HTMLElement>) => void {
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();

  return (event) => {
    const target = event.currentTarget;
    if (!target.matches(":focus-visible")) return;
    const pane = target.closest(".react-flow");
    if (pane === null) return;
    const card = target.getBoundingClientRect();
    const bounds = pane.getBoundingClientRect();
    const isInside =
      card.left >= bounds.left &&
      card.right <= bounds.right &&
      card.top >= bounds.top &&
      card.bottom <= bounds.bottom;
    const miniMap = pane.querySelector(".react-flow__minimap")?.getBoundingClientRect();
    const isUnderMiniMap =
      miniMap !== undefined &&
      card.left < miniMap.right &&
      card.right > miniMap.left &&
      card.top < miniMap.bottom &&
      card.bottom > miniMap.top;
    if (isInside && !isUnderMiniMap) return;
    const node = flow.getNode(nodeId);
    if (node === undefined) return;
    void flow.setCenter(node.position.x, node.position.y, { duration: 0, zoom: flow.getZoom() });
  };
}
