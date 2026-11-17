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
    const isVisible =
      card.left >= bounds.left &&
      card.right <= bounds.right &&
      card.top >= bounds.top &&
      card.bottom <= bounds.bottom;
    if (isVisible) return;
    const node = flow.getNode(nodeId);
    if (node === undefined) return;
    void flow.setCenter(node.position.x, node.position.y, { duration: 0, zoom: flow.getZoom() });
  };
}
