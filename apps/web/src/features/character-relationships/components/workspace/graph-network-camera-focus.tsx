"use client";

import type { Nullable } from "@app/shared";

import {
  type InternalNode,
  useNodesInitialized,
  useReactFlow,
  useStore,
  useStoreApi,
} from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { useGraphCameraState } from "./graph-camera-state-context";
import { useGraphNetworkScene } from "./graph-network-scene-context";
import { withGraphPersonMiniMapCover } from "./graph-person-mini-map";
import { useGraphScene } from "./graph-scene-context";
import { useGraphPersonCamera } from "./use-graph-person-camera";

const NETWORK_FOCUS = {
  durationMs: 350,
  maxZoom: 1,
  zoom: 0.9,
} as const;

export function GraphNetworkCameraFocus() {
  const { characters, clusters } = useGraphScene();
  const { cover, focusRequest, miniMap } = useGraphNetworkScene();
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const store = useStoreApi<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const camera = useGraphPersonCamera();
  const cameraStateRef = useGraphCameraState();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const handled = useRef<Nullable<number>>(null);
  const settling = useRef<Nullable<{ hasRelaid: boolean; nonce: number }>>(null);
  const lastFrame = useRef<Nullable<string>>(null);
  const focusCover = miniMap?.isOpen ? withGraphPersonMiniMapCover(cover) : cover;
  const frameKey = [cover.top, cover.right, cover.bottom, cover.left, width, height].join(":");

  useEffect(() => {
    if (focusRequest === null || handled.current === focusRequest.nonce) return;
    const { nonce } = focusRequest;
    const hasRelaid = settling.current?.nonce === nonce && settling.current.hasRelaid;
    if (!initialized) {
      settling.current = { hasRelaid: true, nonce };
      return;
    }
    settling.current = { hasRelaid, nonce };
    if (!focusRequest.ids.some((id) => characters.has(id) || clusters.has(id))) {
      if (hasRelaid) handled.current = nonce;
      return;
    }
    const frame = requestAnimationFrame(() => {
      const center = toMeasuredCenter({
        ids: new Set(focusRequest.ids),
        nodes: store.getState().nodeLookup.values(),
      });
      if (center === null) return;
      const { height: paneHeight, width: paneWidth } = store.getState();
      const area = toArea({ cover: focusCover, height: paneHeight, width: paneWidth });
      const zoom = Math.min(Math.max(flow.getZoom(), NETWORK_FOCUS.zoom), NETWORK_FOCUS.maxZoom);
      void flow.setViewport(
        {
          x: area.x + area.width / 2 - center.x * zoom,
          y: area.y + area.height / 2 - center.y * zoom,
          zoom,
        },
        { duration: prefersReducedMotion ? 0 : NETWORK_FOCUS.durationMs },
      );
      handled.current = nonce;
      cameraStateRef.current = { mode: "manual", target: null };
    });
    return () => cancelAnimationFrame(frame);
  }, [
    cameraStateRef,
    characters,
    clusters,
    flow,
    focusCover,
    focusRequest,
    initialized,
    prefersReducedMotion,
    store,
  ]);

  useEffect(() => {
    if (!initialized) return;
    const previous = lastFrame.current;
    lastFrame.current = frameKey;
    if (previous === null || previous === frameKey) return;
    if (cameraStateRef.current.mode !== "auto") return;
    camera.fitAll({ cover, duration: 0 });
  }, [camera, cameraStateRef, cover, frameKey, initialized]);

  return null;
}

function toArea({
  cover,
  height,
  width,
}: {
  cover: GraphPersonCover;
  height: number;
  width: number;
}) {
  return {
    height: Math.max(height - cover.top - cover.bottom, 1),
    width: Math.max(width - cover.left - cover.right, 1),
    x: cover.left,
    y: cover.top,
  };
}

function toMeasuredCenter({
  ids,
  nodes,
}: {
  ids: ReadonlySet<string>;
  nodes: Iterable<InternalNode<GraphSceneFlowNode>>;
}): Nullable<{ x: number; y: number }> {
  const bounds = { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity };
  let found = 0;
  for (const node of nodes) {
    if (!ids.has(node.id)) continue;
    const { height, width } = node.measured;
    if (height === undefined || width === undefined) return null;
    const { x, y } = node.internals.positionAbsolute;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x + width);
    bounds.maxY = Math.max(bounds.maxY, y + height);
    found += 1;
  }
  if (found === 0) return null;
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}
