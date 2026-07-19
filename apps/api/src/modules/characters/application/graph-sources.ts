import type { Nullable } from "@app/shared";

import type { GraphEdgeSource, GraphNodeSource } from "../domain/character-graph.js";
import type { RelationshipDetailsRow } from "../infrastructure/character-relationships.repository.js";
import type { GraphNodeRow } from "../infrastructure/characters.repository.js";

export function collectEndpointCharacterIds(relationships: RelationshipDetailsRow[]): string[] {
  const ids = new Set<string>();
  for (const relationship of relationships) {
    ids.add(relationship.sourceCharacterId);
    ids.add(relationship.targetCharacterId);
  }
  return [...ids];
}

export function toGraphEdgeSource(relationship: RelationshipDetailsRow): GraphEdgeSource {
  return {
    bookStates: relationship.bookStates,
    category: relationship.category,
    customType: relationship.customType,
    directionality: relationship.directionality,
    id: relationship.id,
    sourceCharacterId: relationship.sourceCharacterId,
    sourceLabel: relationship.sourceLabel,
    targetCharacterId: relationship.targetCharacterId,
    targetLabel: relationship.targetLabel,
    type: relationship.type,
    updatedAt: relationship.updatedAt,
  };
}

export function toGraphFilterSet<Value>(values: undefined | Value[]): Nullable<Set<Value>> {
  return values === undefined ? null : new Set(values);
}

export function toGraphNodeSource(node: GraphNodeRow): GraphNodeSource {
  return {
    appearances: node.bookAppearances,
    entityKind: node.entityKind,
    id: node.id,
    isFavorite: node.isFavorite,
    name: node.name,
    updatedAt: node.updatedAt,
  };
}
