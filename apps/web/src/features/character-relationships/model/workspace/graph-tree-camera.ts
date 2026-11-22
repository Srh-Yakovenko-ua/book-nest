import type { Nullable } from "@app/shared";

import type { GraphPersonArea, GraphPersonViewport } from "./graph-person-camera";

import { fitGraphPersonBounds } from "./graph-person-camera";

export const TREE_CAMERA = {
  fitPadding: 0.06,
  focusZoom: 0.9,
  maxZoom: 1,
  rail: 196,
  readableZoom: 0.72,
} as const;

export type TreeCameraBox = GraphPersonArea & { id: string };

type ZoomRange = { maxZoom: number; minZoom: number };

export function toTreeBounds({
  boxes,
  withRail,
}: {
  boxes: readonly TreeCameraBox[];
  withRail: boolean;
}): Nullable<GraphPersonArea> {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x)) - (withRail ? TREE_CAMERA.rail : 0);
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { height: bottom - top, width: right - left, x: left, y: top };
}

export function toTreeCenterViewport({
  area,
  box,
  zoom,
}: {
  area: GraphPersonArea;
  box: GraphPersonArea;
  zoom: number;
}): GraphPersonViewport {
  return {
    x: area.x + area.width / 2 - (box.x + box.width / 2) * zoom,
    y: area.y + area.height / 2 - (box.y + box.height / 2) * zoom,
    zoom,
  };
}

export function toTreeFitViewport({
  area,
  boxes,
  withRail,
  zoom,
}: {
  area: GraphPersonArea;
  boxes: readonly TreeCameraBox[];
  withRail: boolean;
  zoom: ZoomRange;
}): Nullable<GraphPersonViewport> {
  const bounds = toTreeBounds({ boxes, withRail });
  if (bounds === null) return null;
  return fitGraphPersonBounds({ area, bounds, padding: TREE_CAMERA.fitPadding, zoom });
}

export function toTreeInitialViewport({
  area,
  boxes,
  focusIds,
  rootId,
  zoom,
}: {
  area: GraphPersonArea;
  boxes: readonly TreeCameraBox[];
  focusIds: ReadonlySet<string>;
  rootId: string;
  zoom: ZoomRange;
}): Nullable<GraphPersonViewport> {
  const overview = toTreeFitViewport({
    area,
    boxes,
    withRail: true,
    zoom: { maxZoom: Math.min(zoom.maxZoom, TREE_CAMERA.maxZoom), minZoom: zoom.minZoom },
  });
  if (overview === null || overview.zoom >= TREE_CAMERA.readableZoom) return overview;
  const readable = { maxZoom: TREE_CAMERA.maxZoom, minZoom: TREE_CAMERA.readableZoom };
  const near = toTreeFitViewport({
    area,
    boxes: boxes.filter((box) => focusIds.has(box.id)),
    withRail: false,
    zoom: readable,
  });
  const root = boxes.find((box) => box.id === rootId);
  if (near === null || root === undefined) return near ?? overview;
  if (near.zoom > TREE_CAMERA.readableZoom) return near;
  return toTreeCenterViewport({ area, box: root, zoom: TREE_CAMERA.readableZoom });
}
