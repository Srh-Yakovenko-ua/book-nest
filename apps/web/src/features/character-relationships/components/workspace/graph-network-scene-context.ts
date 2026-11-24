"use client";

import type { CharacterGraphViewport, Nullable } from "@app/shared";

import { createContext, use } from "react";

import type { NetworkAggregateLink, NetworkIndex } from "../../model/workspace/graph-network-index";
import type { GraphPersonEmphasis } from "../../model/workspace/graph-person-emphasis";
import type { GraphPersonMiniMapState } from "./graph-person-scene-context";
import type { GraphGenealogyFocusRequest } from "./graph-tree-scene-context";
import type { GraphPersonCover } from "./use-graph-person-camera";

export type GraphNetworkCanvasScene = {
  aggregates: ReadonlyMap<string, NetworkAggregateLink>;
  cover: GraphPersonCover;
  emphasis: Nullable<GraphPersonEmphasis>;
  focusRequest: Nullable<GraphGenealogyFocusRequest>;
  index: NetworkIndex;
  miniMap: Nullable<GraphPersonMiniMapState>;
  onCameraChange: (viewport: CharacterGraphViewport) => void;
  onFocusSelected: Nullable<() => void>;
};

export const GraphNetworkSceneContext = createContext<Nullable<GraphNetworkCanvasScene>>(null);

export function useGraphNetworkScene(): GraphNetworkCanvasScene {
  const value = use(GraphNetworkSceneContext);
  if (value === null) throw new Error("GraphNetworkSceneContext is not provided");
  return value;
}
