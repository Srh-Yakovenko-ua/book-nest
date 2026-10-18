import type { Nullable, RelationshipReaderScope } from "@app/shared";

import type { CharacterRelationshipsControllerListParams } from "@/shared/api/generated/model";

import { assertNever } from "@/lib/assert-never";

export type RelationshipScope =
  | { bookId: string; kind: "book" }
  | { characterId: string; contextBookId: Nullable<string>; kind: "character" }
  | { contextBookId: Nullable<string>; kind: "series"; seriesId: string };

export type RelationshipScopeKey = {
  contextBookId: Nullable<string>;
  kind: RelationshipReaderScope;
  scopeId: string;
};

type RelationshipScopeParams = Pick<
  CharacterRelationshipsControllerListParams,
  "contextBookId" | "scope" | "scopeId"
>;

export function canRevealRelationshipDescription(scope: RelationshipScope): boolean {
  return !isGlobalCharacterScope(scope);
}

export function isGlobalCharacterScope(scope: RelationshipScope): boolean {
  return scope.kind === "character" && scope.contextBookId === null;
}

export function toRelationshipFocusCharacterId(scope: RelationshipScope): Nullable<string> {
  return scope.kind === "character" ? scope.characterId : null;
}

export function toRelationshipScopeKey(scope: RelationshipScope): RelationshipScopeKey {
  switch (scope.kind) {
    case "book":
      return { contextBookId: null, kind: "book", scopeId: scope.bookId };
    case "character":
      return { contextBookId: scope.contextBookId, kind: "character", scopeId: scope.characterId };
    case "series":
      return { contextBookId: scope.contextBookId, kind: "series", scopeId: scope.seriesId };
    default:
      return assertNever(scope);
  }
}

export function toRelationshipScopeParams(scope: RelationshipScope): RelationshipScopeParams {
  const { contextBookId, kind, scopeId } = toRelationshipScopeKey(scope);

  return {
    scope: kind,
    scopeId,
    ...(contextBookId === null ? {} : { contextBookId }),
  };
}
