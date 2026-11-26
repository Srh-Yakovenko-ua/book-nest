"use client";

import type { Nullable } from "@app/shared";

import { useNodesInitialized } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { GENEALOGY_CAMERA } from "../../model/workspace/graph-genealogy-camera";
import { useGraphCameraState } from "./graph-camera-state-context";
import { useGraphScene } from "./graph-scene-context";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useGraphTreeCamera } from "./use-graph-tree-camera";

const GENEALOGY_FOCUS = {
  durationMs: 350,
} as const;

export function GraphGenealogyCameraFocus() {
  const { characters } = useGraphScene();
  const { cover, genealogy } = useGraphTreeScene();
  const camera = useGraphTreeCamera();
  const cameraStateRef = useGraphCameraState();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const handled = useRef<Nullable<number>>(null);
  const request = genealogy?.focusRequest ?? null;

  useEffect(() => {
    if (request === null || handled.current === request.nonce) return;
    if (!request.ids.some((id) => characters.has(id))) {
      handled.current = request.nonce;
      return;
    }
    if (!initialized) return;
    const frame = requestAnimationFrame(() => {
      const focused = camera.focus({
        cover,
        duration: prefersReducedMotion ? 0 : GENEALOGY_FOCUS.durationMs,
        ids: new Set(request.ids),
        zoom: GENEALOGY_CAMERA.focusZoom,
      });
      if (!focused) return;
      handled.current = request.nonce;
      cameraStateRef.current = { ...cameraStateRef.current, mode: "manual" };
    });
    return () => cancelAnimationFrame(frame);
  }, [camera, cameraStateRef, characters, cover, initialized, prefersReducedMotion, request]);

  return null;
}
