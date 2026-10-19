import type { Nullable } from "@app/shared";

import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";
import type { RelationshipGraphPathQuery } from "../model/relationship-graph-path";
import type { RelationshipGraphLayoutKey } from "../model/relationship-graph-scope";
import type { RelationshipListCriteria } from "../model/relationship-list-query";
import type { RelationshipReveal } from "../model/relationship-reveal";
import type { RelationshipScopeKey } from "../model/relationship-scope";

const RELATIONSHIPS_ROOT = "character-relationships";

const RELATIONSHIP_KEY_SEGMENTS = {
  details: "details",
  editable: "editable",
  graph: "graph",
  graphLayout: "graph-layout",
  list: "list",
  participants: "participants",
  path: "path",
} as const;

export type RelationshipParticipantPool = "book" | "global";

export const relationshipKeys = {
  all: [RELATIONSHIPS_ROOT] as const,
  details: ({
    relationshipId,
    reveal,
    scopeKey,
  }: {
    relationshipId: string;
    reveal: RelationshipReveal;
    scopeKey: RelationshipScopeKey;
  }) =>
    [
      RELATIONSHIPS_ROOT,
      RELATIONSHIP_KEY_SEGMENTS.details,
      relationshipId,
      scopeKey,
      reveal,
    ] as const,
  editable: (relationshipId: string) =>
    [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.editable, relationshipId] as const,
  graph: ({
    criteria,
    scopeKey,
  }: {
    criteria: RelationshipGraphCriteria;
    scopeKey: RelationshipScopeKey;
  }) => [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.graph, scopeKey, criteria] as const,
  graphLayout: (layoutKey: RelationshipGraphLayoutKey) =>
    [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.graphLayout, layoutKey] as const,
  list: ({
    criteria,
    scopeKey,
  }: {
    criteria: RelationshipListCriteria;
    scopeKey: RelationshipScopeKey;
  }) => [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.list, scopeKey, criteria] as const,
  participants: ({
    bookId,
    pool,
    query,
  }: {
    bookId: Nullable<string>;
    pool: RelationshipParticipantPool;
    query: string;
  }) => [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.participants, pool, bookId, query] as const,
  path: (pathQuery: RelationshipGraphPathQuery) =>
    [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.path, pathQuery] as const,
};
