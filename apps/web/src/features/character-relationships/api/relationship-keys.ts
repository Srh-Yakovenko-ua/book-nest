import type { Nullable, RelationshipDirectionality } from "@app/shared";

import type { BookCharactersControllerListSort } from "@/shared/api/generated/model";

import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";
import type { RelationshipGraphPathQuery } from "../model/relationship-graph-path";
import type { RelationshipGraphLayoutKey } from "../model/relationship-graph-scope";
import type { RelationshipListCriteria } from "../model/relationship-list-query";
import type { RelationshipReveal } from "../model/relationship-reveal";
import type { RelationshipScopeKey } from "../model/relationship-scope";

const RELATIONSHIP_KEY_ROOTS = {
  customTypes: "character-relationship-custom-types",
  relationships: "character-relationships",
  roleSuggestions: "character-relationship-role-suggestions",
  roster: "character-relationship-roster",
} as const;

const RELATIONSHIPS_ROOT = RELATIONSHIP_KEY_ROOTS.relationships;

const RELATIONSHIP_KEY_SEGMENTS = {
  details: "details",
  editable: "editable",
  graph: "graph",
  graphLayout: "graph-layout",
  list: "list",
  path: "path",
} as const;

export const relationshipKeys = {
  all: [RELATIONSHIPS_ROOT] as const,
  customTypes: ({
    directionality,
    term,
  }: {
    directionality: Nullable<RelationshipDirectionality>;
    term: string;
  }) => [RELATIONSHIP_KEY_ROOTS.customTypes, directionality, term] as const,
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
  dictionaries: {
    customTypes: [RELATIONSHIP_KEY_ROOTS.customTypes] as const,
    roleSuggestions: [RELATIONSHIP_KEY_ROOTS.roleSuggestions] as const,
  },
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
  path: (pathQuery: RelationshipGraphPathQuery) =>
    [RELATIONSHIPS_ROOT, RELATIONSHIP_KEY_SEGMENTS.path, pathQuery] as const,
  roleSuggestions: (term: string) => [RELATIONSHIP_KEY_ROOTS.roleSuggestions, term] as const,
  roster: ({
    bookId,
    sort,
    term,
  }: {
    bookId: Nullable<string>;
    sort: BookCharactersControllerListSort;
    term: string;
  }) => [RELATIONSHIP_KEY_ROOTS.roster, bookId, sort, term] as const,
};
