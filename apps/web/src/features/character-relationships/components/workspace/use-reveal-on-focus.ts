"use client";

import type { Nullable } from "@app/shared";
import type { FocusEvent } from "react";

import { useReactFlow } from "@xyflow/react";
import { use } from "react";

import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { GraphNetworkSceneContext } from "./graph-network-scene-context";

type Box = { bottom: number; left: number; right: number; top: number };

export function useRevealOnFocus(nodeId: string): (event: FocusEvent<HTMLElement>) => void {
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const cover = use(GraphNetworkSceneContext)?.cover ?? null;

  return (event) => {
    const target = event.currentTarget;
    if (!target.matches(":focus-visible")) return;
    const pane = target.closest(".react-flow");
    if (pane === null) return;
    const card = withPaneScrollReset({ pane, rect: target.getBoundingClientRect() });
    const bounds = toVisibleBounds({ cover, pane: pane.getBoundingClientRect() });
    const isInside =
      card.left >= bounds.left &&
      card.right <= bounds.right &&
      card.top >= bounds.top &&
      card.bottom <= bounds.bottom;
    const miniMapElement = pane.querySelector(".react-flow__minimap");
    const miniMap =
      miniMapElement === null
        ? null
        : withPaneScrollReset({ pane, rect: miniMapElement.getBoundingClientRect() });
    const isUnderMiniMap =
      miniMap !== null &&
      card.left < miniMap.right &&
      card.right > miniMap.left &&
      card.top < miniMap.bottom &&
      card.bottom > miniMap.top;
    if (isInside && !isUnderMiniMap) return;
    const node = flow.getNode(nodeId);
    if (node === undefined) return;
    const zoom = flow.getZoom();
    if (cover === null) {
      void flow.setCenter(node.position.x, node.position.y, { duration: 0, zoom });
      return;
    }
    void flow.setCenter(
      node.position.x - (cover.left - cover.right) / 2 / zoom,
      node.position.y - (cover.top - cover.bottom) / 2 / zoom,
      { duration: 0, zoom },
    );
  };
}

function toVisibleBounds({
  cover,
  pane,
}: {
  cover: Nullable<GraphPersonCover>;
  pane: DOMRect;
}): Box {
  if (cover === null) {
    return { bottom: pane.bottom, left: pane.left, right: pane.right, top: pane.top };
  }
  return {
    bottom: pane.bottom - cover.bottom,
    left: pane.left + cover.left,
    right: pane.right - cover.right,
    top: pane.top + cover.top,
  };
}

function withPaneScrollReset({ pane, rect }: { pane: Element; rect: DOMRect }): Box {
  return {
    bottom: rect.bottom + pane.scrollTop,
    left: rect.left + pane.scrollLeft,
    right: rect.right + pane.scrollLeft,
    top: rect.top + pane.scrollTop,
  };
}
