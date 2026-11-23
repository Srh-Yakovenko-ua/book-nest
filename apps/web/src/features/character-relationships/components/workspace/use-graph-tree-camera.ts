"use client";

import type { Nullable } from "@app/shared";

import { useReactFlow, useStoreApi } from "@xyflow/react";

import type {
  GraphPersonArea,
  GraphPersonViewport,
} from "../../model/workspace/graph-person-camera";
import type { TreeCameraBox } from "../../model/workspace/graph-tree-camera";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { toGraphPersonRevealViewport } from "../../model/workspace/graph-person-camera";
import {
  toTreeCenterViewport,
  toTreeFitViewport,
  toTreeInitialViewport,
  TREE_CAMERA,
} from "../../model/workspace/graph-tree-camera";

const TREE_CAMERA_VIEW = {
  revealMargin: 12,
} as const;

export function useGraphTreeCamera() {
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const store = useStoreApi<GraphSceneFlowNode, GraphSceneFlowEdge>();

  function toBoxes(ids: Nullable<ReadonlySet<string>>): TreeCameraBox[] {
    return [...store.getState().nodeLookup.values()].flatMap((node) => {
      if (ids !== null && !ids.has(node.id)) return [];
      const { height, width } = node.measured;
      if (height === undefined || width === undefined) return [];
      const { x, y } = node.internals.positionAbsolute;
      return [{ height, id: node.id, width, x, y }];
    });
  }

  function toArea(cover: GraphPersonCover): GraphPersonArea {
    const { height, width } = store.getState();
    return {
      height: Math.max(height - cover.top - cover.bottom, 1),
      width: Math.max(width - cover.left - cover.right, 1),
      x: cover.left,
      y: cover.top,
    };
  }

  function toZoomRange() {
    const { maxZoom, minZoom } = store.getState();
    return { maxZoom, minZoom };
  }

  function initialize({
    cover,
    focusIds,
    rootId,
  }: {
    cover: GraphPersonCover;
    focusIds: ReadonlySet<string>;
    rootId: string;
  }) {
    const viewport = toTreeInitialViewport({
      area: toArea(cover),
      boxes: toBoxes(null),
      focusIds,
      rootId,
      zoom: toZoomRange(),
    });
    if (viewport !== null) void flow.setViewport(viewport);
  }

  function fitAll({ cover, duration }: { cover: GraphPersonCover; duration: number }) {
    const viewport = toTreeFitViewport({
      area: toArea(cover),
      boxes: toBoxes(null),
      withRail: true,
      zoom: { maxZoom: TREE_CAMERA.maxZoom, minZoom: store.getState().minZoom },
    });
    if (viewport !== null) void flow.setViewport(viewport, { duration });
  }

  function center({
    cover,
    duration,
    rootId,
  }: {
    cover: GraphPersonCover;
    duration: number;
    rootId: string;
  }) {
    const [root] = toBoxes(new Set([rootId]));
    if (root === undefined) return;
    void flow.setViewport(
      toTreeCenterViewport({
        area: toArea(cover),
        box: root,
        zoom: Math.max(flow.getZoom(), TREE_CAMERA.focusZoom),
      }),
      { duration },
    );
  }

  function centerAt({ cover, id, zoom }: { cover: GraphPersonCover; id: string; zoom: number }) {
    const [box] = toBoxes(new Set([id]));
    if (box === undefined) return;
    void flow.setViewport(toTreeCenterViewport({ area: toArea(cover), box, zoom }));
  }

  function focus({
    cover,
    duration,
    ids,
    zoom,
  }: {
    cover: GraphPersonCover;
    duration: number;
    ids: ReadonlySet<string>;
    zoom: number;
  }): boolean {
    const boxes = toBoxes(ids);
    const [single] = boxes;
    if (single === undefined) return false;
    if (boxes.length === 1) {
      void flow.setViewport(
        toTreeCenterViewport({
          area: toArea(cover),
          box: single,
          zoom: Math.max(flow.getZoom(), zoom),
        }),
        { duration },
      );
      return true;
    }
    const viewport = toTreeFitViewport({
      area: toArea(cover),
      boxes,
      withRail: false,
      zoom: { maxZoom: TREE_CAMERA.maxZoom, minZoom: store.getState().minZoom },
    });
    if (viewport !== null) void flow.setViewport(viewport, { duration });
    return true;
  }

  function toReveal({
    cover,
    ids,
    viewport,
  }: {
    cover: GraphPersonCover;
    ids: ReadonlySet<string>;
    viewport: GraphPersonViewport;
  }): Nullable<GraphPersonViewport> {
    const margin = TREE_CAMERA_VIEW.revealMargin;
    return toGraphPersonRevealViewport({
      area: toArea({
        bottom: cover.bottom + margin,
        left: cover.left + margin,
        right: cover.right + margin,
        top: cover.top + margin,
      }),
      boxes: toBoxes(ids).map((box) => ({ ...box, hop: null })),
      viewport,
    });
  }

  return { center, centerAt, fitAll, focus, initialize, toReveal };
}
