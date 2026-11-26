"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { createContext, use } from "react";

import type { GraphPersonViewport } from "../../model/workspace/graph-person-camera";

export const GRAPH_CAMERA_STATE = {
  targetSlackMs: 300,
} as const;

export type GraphCameraState = {
  mode: "auto" | "manual";
  target: Nullable<GraphCameraTarget>;
};

type GraphCameraTarget = {
  until: number;
  viewport: GraphPersonViewport;
};

export const GraphCameraStateContext = createContext<Nullable<RefObject<GraphCameraState>>>(null);

export function toPendingCameraTarget(
  state: GraphCameraState,
  now: number,
): Nullable<GraphCameraTarget> {
  return state.target !== null && state.target.until > now ? state.target : null;
}

export function useGraphCameraState(): RefObject<GraphCameraState> {
  const value = use(GraphCameraStateContext);
  if (value === null) throw new Error("GraphCameraStateContext is not provided");
  return value;
}
