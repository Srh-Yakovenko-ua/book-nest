import type { Edge, Node } from "@xyflow/react";

import type { RelationshipGraphEmphasis } from "./relationship-graph-path";

export const RELATIONSHIP_GRAPH_FLOW = {
  edgeType: "relationship",
  nodeType: "character",
} as const;

export type RelationshipGraphEdgeData = {
  ariaLabel: string;
  emphasis: RelationshipGraphEmphasis;
  isDirected: boolean;
  isTypeHidden: boolean;
  label: string;
  lane: number;
};

export type RelationshipGraphFlowEdge = Edge<
  RelationshipGraphEdgeData,
  typeof RELATIONSHIP_GRAPH_FLOW.edgeType
>;

export type RelationshipGraphFlowNode = Node<
  Record<string, never>,
  typeof RELATIONSHIP_GRAPH_FLOW.nodeType
>;
