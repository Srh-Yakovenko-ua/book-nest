"use client";

import type { Nullable } from "@app/shared";

import { useNodesInitialized, useReactFlow, useStore } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import type { GraphPersonPaneSize } from "../../model/workspace/graph-person-camera";
import type {
  GraphSceneFlowEdge,
  GraphSceneFlowNode,
  GraphSceneSelection,
  GraphSceneValue,
} from "./graph-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

import { anchorGraphPersonViewport } from "../../model/workspace/graph-person-camera";
import { useGraphScene } from "./graph-scene-context";
import { useGraphPersonCamera } from "./use-graph-person-camera";

const CAMERA_FOLLOW = {
  revealMs: 300,
} as const;

export function GraphPersonCameraFollow({ cover }: { cover: GraphPersonCover }) {
  const { connections, selection } = useGraphScene();
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const camera = useGraphPersonCamera();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const lastPane = useRef<Nullable<GraphPersonPaneSize>>(null);
  const revealedKey = useRef<Nullable<string>>(null);
  const selectionKey = selection === null ? null : `${selection.kind}:${selection.id}`;

  useEffect(() => {
    if (!initialized) return;
    const previous = lastPane.current;
    const next = { height, width };
    lastPane.current = next;
    const resized = previous !== null && (previous.width !== width || previous.height !== height);
    if (!resized && revealedKey.current === selectionKey) return;
    revealedKey.current = selectionKey;
    const current = flow.getViewport();
    const anchored =
      previous !== null && resized
        ? anchorGraphPersonViewport({ next, previous, viewport: current })
        : current;
    const revealed =
      selection === null
        ? null
        : camera.toReveal({
            cover,
            ids: toSelectionIds({ connections, selection }),
            viewport: anchored,
          });
    if (revealed !== null) {
      void flow.setViewport(revealed, {
        duration: prefersReducedMotion ? 0 : CAMERA_FOLLOW.revealMs,
      });
      return;
    }
    if (resized) void flow.setViewport(anchored);
  }, [
    camera,
    connections,
    cover,
    flow,
    height,
    initialized,
    prefersReducedMotion,
    selection,
    selectionKey,
    width,
  ]);

  return null;
}

function toSelectionIds({
  connections,
  selection,
}: {
  connections: GraphSceneValue["connections"];
  selection: NonNullable<GraphSceneSelection>;
}): ReadonlySet<string> {
  if (selection.kind === "character") return new Set([selection.id]);
  const connection = connections.get(selection.id);
  return new Set(connection === undefined ? [] : [connection.sourceId, connection.targetId]);
}
