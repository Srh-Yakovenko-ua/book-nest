"use client";

import type { Nullable } from "@app/shared";

import { useNodesInitialized, useStore } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import type { GraphPersonCover } from "./use-graph-person-camera";

import { useGraphScene } from "./graph-scene-context";
import { useGraphPersonCamera } from "./use-graph-person-camera";

const SELECTION_REVEAL = {
  durationMs: 300,
} as const;

export function GraphPersonSelectionReveal({ cover }: { cover: GraphPersonCover }) {
  const { connections, selection } = useGraphScene();
  const camera = useGraphPersonCamera();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const revealedKey = useRef<Nullable<string>>(null);
  const paneSize = useStore((state) => `${state.width}x${state.height}`);
  const selectionKey = selection === null ? null : `${selection.kind}:${selection.id}`;
  const revealKey = selectionKey === null ? null : `${selectionKey}@${paneSize}`;

  useEffect(() => {
    if (!initialized || revealedKey.current === revealKey) return;
    revealedKey.current = revealKey;
    if (selection === null) return;
    const connection = selection.kind === "connection" ? connections.get(selection.id) : undefined;
    const ids =
      connection === undefined ? [selection.id] : [connection.sourceId, connection.targetId];
    camera.reveal({
      cover,
      duration: prefersReducedMotion ? 0 : SELECTION_REVEAL.durationMs,
      ids: new Set(ids),
    });
  }, [camera, connections, cover, initialized, prefersReducedMotion, revealKey, selection]);

  return null;
}
