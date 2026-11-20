"use client";

import type { Nullable } from "@app/shared";

import { useReactFlow, useStoreApi } from "@xyflow/react";

import type {
  GraphPersonArea,
  GraphPersonBox,
  GraphPersonOuterRing,
} from "../../model/workspace/graph-person-camera";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

import {
  fitGraphPersonBounds,
  toGraphPersonBounds,
  toGraphPersonInitialViewport,
  toGraphPersonRevealViewport,
} from "../../model/workspace/graph-person-camera";
import { toGraphPersonRings } from "../../model/workspace/graph-person-rings";
import { useGraphScene } from "./graph-scene-context";

const PERSON_CAMERA_VIEW = {
  fitPadding: 0.06,
  maxZoom: 1,
  revealMargin: 12,
} as const;

export type GraphPersonControlsPosition = "bottom-center" | "top-left" | "top-right";

export type GraphPersonCover = { bottom: number; left: number; right: number; top: number };

export const GRAPH_PERSON_NO_COVER: GraphPersonCover = { bottom: 0, left: 0, right: 0, top: 0 };

export const GRAPH_PERSON_CONTROLS_COVER: Record<GraphPersonControlsPosition, GraphPersonCover> = {
  "bottom-center": { ...GRAPH_PERSON_NO_COVER, bottom: 64 },
  "top-left": { ...GRAPH_PERSON_NO_COVER, left: 64 },
  "top-right": { ...GRAPH_PERSON_NO_COVER, right: 64 },
};

export function useGraphPersonCamera() {
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const store = useStoreApi<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const { characters } = useGraphScene();

  function toBoxes(ids: Nullable<ReadonlySet<string>>): GraphPersonBox[] {
    return [...store.getState().nodeLookup.values()].flatMap((node) => {
      if (ids !== null && !ids.has(node.id)) return [];
      const { height, width } = node.measured;
      if (height === undefined || width === undefined) return [];
      const { x, y } = node.internals.positionAbsolute;
      return [{ height, hop: characters.get(node.id)?.hop ?? null, width, x, y }];
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

  function toOuterRing(): Nullable<GraphPersonOuterRing> {
    const nodes = flow.getNodes();
    const rings = toGraphPersonRings({
      hops: new Map(
        nodes.flatMap((node) => {
          const hop = characters.get(node.id)?.hop;
          return hop === undefined || hop === null ? [] : [[node.id, hop] as const];
        }),
      ),
      positions: new Map(nodes.map((node) => [node.id, node.position] as const)),
    });
    const [outer] = [...(rings?.radii ?? [])].sort((left, right) => right.radius - left.radius);
    return rings === null || outer === undefined
      ? null
      : { center: rings.center, radius: outer.radius };
  }

  function toZoomRange() {
    return { maxZoom: PERSON_CAMERA_VIEW.maxZoom, minZoom: store.getState().minZoom };
  }

  function initialize(cover: GraphPersonCover) {
    const viewport = toGraphPersonInitialViewport({
      area: toArea(cover),
      boxes: toBoxes(null),
      padding: PERSON_CAMERA_VIEW.fitPadding,
      ring: toOuterRing(),
      zoom: toZoomRange(),
    });
    if (viewport !== null) void flow.setViewport(viewport);
  }

  function fitAll({ cover, duration }: { cover: GraphPersonCover; duration: number }) {
    const bounds = toGraphPersonBounds({ boxes: toBoxes(null), ring: toOuterRing() });
    if (bounds === null) return;
    void flow.setViewport(
      fitGraphPersonBounds({
        area: toArea(cover),
        bounds,
        padding: PERSON_CAMERA_VIEW.fitPadding,
        zoom: toZoomRange(),
      }),
      { duration },
    );
  }

  function reveal({
    cover,
    duration,
    ids,
  }: {
    cover: GraphPersonCover;
    duration: number;
    ids: ReadonlySet<string>;
  }) {
    const margin = PERSON_CAMERA_VIEW.revealMargin;
    const viewport = toGraphPersonRevealViewport({
      area: toArea({
        bottom: cover.bottom + margin,
        left: cover.left + margin,
        right: cover.right + margin,
        top: cover.top + margin,
      }),
      boxes: toBoxes(ids),
      viewport: flow.getViewport(),
    });
    if (viewport !== null) void flow.setViewport(viewport, { duration });
  }

  function center({
    cover,
    duration,
    id,
    zoom,
  }: {
    cover: GraphPersonCover;
    duration: number;
    id: string;
    zoom: number;
  }) {
    const node = flow.getNode(id);
    if (node === undefined) return;
    const area = toArea(cover);
    void flow.setViewport(
      {
        x: area.x + area.width / 2 - node.position.x * zoom,
        y: area.y + area.height / 2 - node.position.y * zoom,
        zoom,
      },
      { duration },
    );
  }

  return { center, fitAll, initialize, reveal };
}
