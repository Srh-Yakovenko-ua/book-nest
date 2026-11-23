"use client";

import type { Nullable } from "@app/shared";

import { createContext, use } from "react";

import type { TreeLayoutRow } from "../../model/workspace/graph-tree-layout";
import type { TreePairSemantics } from "../../model/workspace/graph-tree-pairs";
import type { GraphPersonCover } from "./use-graph-person-camera";

export type GraphGenealogyCanvas = {
  collapsedIds: ReadonlySet<string>;
  focusRequest: Nullable<GraphGenealogyFocusRequest>;
  frames: readonly GraphGenealogyFrameLabel[];
  hiddenDescendantsById: ReadonlyMap<string, number>;
  highlightIds: Nullable<ReadonlySet<string>>;
  houseById: ReadonlyMap<string, GraphGenealogyHouseMark>;
  onExpand: (characterId: string) => void;
};

export type GraphGenealogyFocusRequest = {
  ids: readonly string[];
  nonce: number;
};

export type GraphGenealogyFrameLabel = {
  componentId: string;
  label: string;
  left: number;
  top: number;
};

export type GraphGenealogyHouseMark = {
  name: string;
  tone: number;
};

export type GraphTreeCanvasScene = {
  arcPairIds: ReadonlySet<string>;
  cover: GraphPersonCover;
  focusIds: ReadonlySet<string>;
  genealogy: Nullable<GraphGenealogyCanvas>;
  generationById: ReadonlyMap<string, number>;
  miniMap: Nullable<GraphTreeMiniMapState>;
  pairs: ReadonlyMap<string, TreePairSemantics>;
  rootId: Nullable<string>;
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
