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

import { anchorGraphPersonViewport } from "../../model/workspace/graph-person-camera";
import {
  GRAPH_CAMERA_STATE,
  toPendingCameraTarget,
  useGraphCameraState,
} from "./graph-camera-state-context";
import { useGraphScene } from "./graph-scene-context";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useGraphTreeCamera } from "./use-graph-tree-camera";

const TREE_CAMERA_FOLLOW = {
  revealMs: 300,
  settleMs: 160,
} as const;

export function GraphTreeCameraFollow() {
  const { connections, selection } = useGraphScene();
  const { cover } = useGraphTreeScene();
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const camera = useGraphTreeCamera();
  const cameraStateRef = useGraphCameraState();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const lastPane = useRef<Nullable<GraphPersonPaneSize>>(null);
  const revealedKey = useRef<Nullable<string>>(null);
  const settleTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  const selectionKey = selection === null ? null : `${selection.kind}:${selection.id}`;

  useEffect(() => {
    if (!initialized) return;
    const previous = lastPane.current;
    const next = { height, width };
    lastPane.current = next;
    const resized = previous !== null && (previous.width !== width || previous.height !== height);
    const isNewSelection = revealedKey.current !== selectionKey;
    if (!resized && !isNewSelection) return;
    revealedKey.current = selectionKey;
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    const ids = toSelectionIds({ connections, selection });
    const revealMs = prefersReducedMotion ? 0 : TREE_CAMERA_FOLLOW.revealMs;
    const now = performance.now();
    const pending = toPendingCameraTarget(cameraStateRef.current, now);
    const base = pending?.viewport ?? flow.getViewport();
    const anchored =
      previous !== null && resized
        ? anchorGraphPersonViewport({ next, previous, viewport: base })
        : base;
    const remaining =
      pending === null ? 0 : Math.max(0, pending.until - GRAPH_CAMERA_STATE.targetSlackMs - now);
    if (isNewSelection) {
      const revealed = ids === null ? null : camera.toReveal({ cover, ids, viewport: anchored });
      if (revealed !== null) {
        cameraStateRef.current = { ...cameraStateRef.current, mode: "manual" };
        camera.move(revealed, revealMs);
        return;
      }
      if (resized) camera.move(anchored, remaining);
      return;
    }
    if (cameraStateRef.current.mode !== "auto") camera.move(anchored, remaining);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      if (cameraStateRef.current.mode === "auto") {
        camera.fitAll({ cover, duration: 0 });
        return;
      }
      const settled =
        toPendingCameraTarget(cameraStateRef.current, performance.now())?.viewport ??
        flow.getViewport();
      const revealed = ids === null ? null : camera.toReveal({ cover, ids, viewport: settled });
      if (revealed !== null) camera.move(revealed, revealMs);
    }, TREE_CAMERA_FOLLOW.settleMs);
  }, [
    camera,
    cameraStateRef,
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

  useEffect(
    () => () => {
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    },
    [],
  );

  return null;
}

function toSelectionIds({
  connections,
  selection,
}: {
  connections: GraphSceneValue["connections"];
  selection: GraphSceneSelection;
}): Nullable<ReadonlySet<string>> {
  if (selection === null) return null;
  if (selection.kind === "character") return new Set([selection.id]);
  const connection = connections.get(selection.id);
  return connection === undefined ? null : new Set([connection.sourceId, connection.targetId]);
}
