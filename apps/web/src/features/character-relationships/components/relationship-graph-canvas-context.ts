"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { createContext, use } from "react";

import type { RelationshipGraphEmphasis } from "../model/relationship-graph-path";
import type { RelationshipGraphTone } from "./relationship-graph-tones";

export type RelationshipGraphCanvasValue = {
  nodes: ReadonlyMap<string, RelationshipGraphNodePresentation>;
  onEdgeOpen: (edgeId: string) => void;
  onNodeOpen: (nodeId: string) => void;
};

export type RelationshipGraphNodePresentation = {
  emphasis: RelationshipGraphEmphasis;
  isActive: boolean;
  node: CharacterGraphNodeView;
  tone: Nullable<RelationshipGraphTone>;
};

export const RelationshipGraphCanvasContext =
  createContext<Nullable<RelationshipGraphCanvasValue>>(null);

export function useRelationshipGraphCanvas(): RelationshipGraphCanvasValue {
  const value = use(RelationshipGraphCanvasContext);
  if (value === null) throw new Error("RelationshipGraphCanvasContext is not provided");
  return value;
}
