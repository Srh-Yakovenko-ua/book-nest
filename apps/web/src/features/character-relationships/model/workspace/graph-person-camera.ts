import type { Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";

export const GRAPH_PERSON_CAMERA = {
  detail: { detailFrom: 0.7, normalFrom: 0.45 },
  plate: { below: 52, side: 32 },
  readableZoom: 0.65,
} as const;

export type GraphPersonArea = { height: number; width: number; x: number; y: number };

export type GraphPersonBox = {
  height: number;
  hop: Nullable<number>;
  width: number;
  x: number;
  y: number;
};

export type GraphPersonDetailLevel = "detail" | "far" | "normal";

export type GraphPersonOuterRing = { center: RelationshipGraphPoint; radius: number };

export type GraphPersonViewport = { x: number; y: number; zoom: number };

type ZoomRange = { maxZoom: number; minZoom: number };

export function fitGraphPersonBounds({
  area,
  bounds,
  padding,
  zoom,
}: {
  area: GraphPersonArea;
  bounds: GraphPersonArea;
  padding: number;
  zoom: ZoomRange;
}): GraphPersonViewport {
  const usableWidth = area.width * (1 - padding * 2);
  const usableHeight = area.height * (1 - padding * 2);
  const fitted = Math.min(
    usableWidth / Math.max(bounds.width, 1),
    usableHeight / Math.max(bounds.height, 1),
  );
  const scale = Math.min(Math.max(fitted, zoom.minZoom), zoom.maxZoom);
  return {
    x: area.x + area.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: area.y + area.height / 2 - (bounds.y + bounds.height / 2) * scale,
    zoom: scale,
  };
}

export function toGraphPersonBounds({
  boxes,
  ring,
}: {
  boxes: readonly GraphPersonBox[];
  ring: Nullable<GraphPersonOuterRing>;
}): Nullable<GraphPersonArea> {
  if (boxes.length === 0) return null;
  const { below, side } = GRAPH_PERSON_CAMERA.plate;
  const left = boxes.map((box) => box.x - side);
  const right = boxes.map((box) => box.x + box.width + side);
  const top = boxes.map((box) => box.y);
  const bottom = boxes.map((box) => box.y + box.height + below);
  if (ring !== null) {
    left.push(ring.center.x - ring.radius);
    right.push(ring.center.x + ring.radius);
    top.push(ring.center.y - ring.radius);
    bottom.push(ring.center.y + ring.radius);
  }
  const x = Math.min(...left);
  const y = Math.min(...top);
  return { height: Math.max(...bottom) - y, width: Math.max(...right) - x, x, y };
}

export function toGraphPersonDetailLevel(zoom: number): GraphPersonDetailLevel {
  if (zoom >= GRAPH_PERSON_CAMERA.detail.detailFrom) return "detail";
  return zoom >= GRAPH_PERSON_CAMERA.detail.normalFrom ? "normal" : "far";
}

export function toGraphPersonInitialViewport({
  area,
  boxes,
  padding,
  ring,
  zoom,
}: {
  area: GraphPersonArea;
  boxes: readonly GraphPersonBox[];
  padding: number;
  ring: Nullable<GraphPersonOuterRing>;
  zoom: ZoomRange;
}): Nullable<GraphPersonViewport> {
  const overall = toGraphPersonBounds({ boxes, ring });
  if (overall === null) return null;
  const overview = fitGraphPersonBounds({ area, bounds: overall, padding, zoom });
  const near = boxes.filter((box) => box.hop !== null && box.hop <= 1);
  if (overview.zoom >= GRAPH_PERSON_CAMERA.readableZoom || near.length === boxes.length) {
    return overview;
  }
  const nearby = toGraphPersonBounds({ boxes: near, ring: null });
  return fitGraphPersonBounds({
    area,
    bounds: nearby ?? overall,
    padding,
    zoom: {
      maxZoom: zoom.maxZoom,
      minZoom: Math.max(zoom.minZoom, GRAPH_PERSON_CAMERA.readableZoom),
    },
  });
}

export function toGraphPersonRevealViewport({
  area,
  boxes,
  viewport,
}: {
  area: GraphPersonArea;
  boxes: readonly GraphPersonBox[];
  viewport: GraphPersonViewport;
}): Nullable<GraphPersonViewport> {
  const bounds = toGraphPersonBounds({ boxes, ring: null });
  if (bounds === null) return null;
  const { x, y, zoom } = viewport;
  const shiftX = toRevealShift({
    end: area.x + area.width,
    size: bounds.width * zoom,
    start: area.x,
    value: bounds.x * zoom + x,
  });
  const shiftY = toRevealShift({
    end: area.y + area.height,
    size: bounds.height * zoom,
    start: area.y,
    value: bounds.y * zoom + y,
  });
  if (shiftX === 0 && shiftY === 0) return null;
  return { x: x + shiftX, y: y + shiftY, zoom };
}

function toRevealShift({
  end,
  size,
  start,
  value,
}: {
  end: number;
  size: number;
  start: number;
  value: number;
}): number {
  if (size > end - start) return start + (end - start - size) / 2 - value;
  if (value < start) return start - value;
  if (value + size > end) return end - (value + size);
  return 0;
}
