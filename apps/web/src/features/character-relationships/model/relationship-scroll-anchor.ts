import type { Nullable } from "@app/shared";

import type {
  BookTabCardAttribute,
  BookTabScrollAnchor,
  BookTabScrollScope,
} from "@/lib/book-tab-scroll-anchor";

import type { RelationshipListCriteria } from "./relationship-list-query";
import type { RelationshipScopeKey } from "./relationship-scope";

export type RelationshipScrollEntry = {
  anchor: BookTabScrollAnchor;
  renderedCount: number;
};

export const RELATIONSHIP_SCROLL = {
  cardAttribute: "data-relationship-id",
} as const satisfies { cardAttribute: BookTabCardAttribute };

const relationshipScrollEntries = new Map<string, RelationshipScrollEntry>();

export const relationshipScrollMemory = {
  forget: (scope: BookTabScrollScope): void => {
    relationshipScrollEntries.delete(toEntryKey(scope));
  },
  read: (scope: BookTabScrollScope): Nullable<RelationshipScrollEntry> =>
    relationshipScrollEntries.get(toEntryKey(scope)) ?? null,
  save: (entry: RelationshipScrollEntry): void => {
    relationshipScrollEntries.set(toEntryKey(entry.anchor), entry);
  },
};

export function toRelationshipScrollScope({
  criteria,
  scopeKey,
}: {
  criteria: RelationshipListCriteria;
  scopeKey: RelationshipScopeKey;
}): BookTabScrollScope {
  return { bookId: scopeKey.scopeId, criteriaKey: JSON.stringify({ criteria, scopeKey }) };
}

function toEntryKey({ bookId, criteriaKey }: BookTabScrollScope): string {
  return JSON.stringify([bookId, criteriaKey]);
}
