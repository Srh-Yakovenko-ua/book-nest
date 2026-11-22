"use client";

import type { Nullable } from "@app/shared";

import { createContext, use } from "react";

import type { TreeLayoutRow } from "../../model/workspace/graph-tree-layout";
import type { TreePairSemantics } from "../../model/workspace/graph-tree-pairs";
import type { GraphPersonCover } from "./use-graph-person-camera";

export type GraphTreeCanvasScene = {
  arcPairIds: ReadonlySet<string>;
  cover: GraphPersonCover;
  focusIds: ReadonlySet<string>;
  generationById: ReadonlyMap<string, number>;
  miniMap: Nullable<GraphTreeMiniMapState>;
  pairs: ReadonlyMap<string, TreePairSemantics>;
  rootId: string;
  rows: readonly TreeLayoutRow[];
  sideIds: ReadonlySet<string>;
};

export type GraphTreeMiniMapState = {
  isOpen: boolean;
  onToggle: () => void;
};

export const GraphTreeSceneContext = createContext<Nullable<GraphTreeCanvasScene>>(null);

export function useGraphTreeScene(): GraphTreeCanvasScene {
  const value = use(GraphTreeSceneContext);
  if (value === null) throw new Error("GraphTreeSceneContext is not provided");
  return value;
}
