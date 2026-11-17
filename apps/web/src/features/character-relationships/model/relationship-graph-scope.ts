import type {
  CharacterGraphLayoutScopeType,
  CharacterGraphMode,
  CharacterGraphNodeView,
  CharacterGraphStorageMode,
  Nullable,
} from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { RelationshipScope } from "./relationship-scope";

export type RelationshipGraphLayoutKey = {
  contextBookId: Nullable<string>;
  mode: CharacterGraphStorageMode;
  scopeId: string;
  scopeType: Extract<CharacterGraphLayoutScopeType, "book" | "series">;
};

export type RelationshipGraphScope = Extract<RelationshipScope, { kind: "book" | "series" }>;

type RelationshipGraphCharacterLinkArgs = {
  node: Pick<CharacterGraphNodeView, "id" | "importance">;
  scope: RelationshipGraphScope;
};

export function toRelationshipGraphCharacterHref({
  node,
  scope,
}: RelationshipGraphCharacterLinkArgs): string {
  const bookId = toCharacterPageBookId({ node, scope });
  if (bookId === null) return `/characters/${node.id}`;
  return `/characters/${node.id}?${new URLSearchParams({ bookId }).toString()}`;
}

export function toRelationshipGraphContextBookId(scope: RelationshipGraphScope): Nullable<string> {
  switch (scope.kind) {
    case "book":
      return scope.bookId;
    case "series":
      return scope.contextBookId;
    default:
      return assertNever(scope);
  }
}

export function toRelationshipGraphLayoutKey({
  mode,
  scope,
}: {
  mode: CharacterGraphMode;
  scope: RelationshipGraphScope;
}): RelationshipGraphLayoutKey {
  switch (scope.kind) {
    case "book":
      return { contextBookId: null, mode, scopeId: scope.bookId, scopeType: "book" };
    case "series":
      return {
        contextBookId: scope.contextBookId,
        mode,
        scopeId: scope.seriesId,
        scopeType: "series",
      };
    default:
      return assertNever(scope);
  }
}

function toCharacterPageBookId({
  node,
  scope,
}: RelationshipGraphCharacterLinkArgs): Nullable<string> {
  switch (scope.kind) {
    case "book": {
      const appearsInBook = node.importance !== null;
      return appearsInBook ? scope.bookId : null;
    }
    case "series":
      return null;
    default:
      return assertNever(scope);
  }
}
