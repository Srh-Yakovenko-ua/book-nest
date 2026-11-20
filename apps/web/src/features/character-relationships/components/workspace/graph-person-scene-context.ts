"use client";

import type { Nullable } from "@app/shared";

import { createContext, use } from "react";

import type {
  GraphPersonEmphasis,
  GraphPersonFocus,
} from "../../model/workspace/graph-person-emphasis";
import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";
import type { GraphPersonCover } from "./use-graph-person-camera";

export type GraphPersonCanvasScene = {
  cover: GraphPersonCover;
  labelPairIds: ReadonlySet<string>;
  rootId: string;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
};

export type GraphPersonSceneValue = GraphPersonCanvasScene & {
  emphasis: Nullable<GraphPersonEmphasis>;
  onFocusChange: (focus: GraphPersonFocus) => void;
};

export const GraphPersonSceneContext = createContext<Nullable<GraphPersonSceneValue>>(null);

export function useGraphPersonScene(): GraphPersonSceneValue {
  const value = use(GraphPersonSceneContext);
  if (value === null) throw new Error("GraphPersonSceneContext is not provided");
  return value;
}
