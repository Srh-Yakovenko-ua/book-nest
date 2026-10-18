import type { Nullable } from "@app/shared";

import type { RelationshipBookOption } from "./relationship-adapter";
import type { RelationshipParticipant } from "./relationship-form-schema";
import type { RelationshipScope } from "./relationship-scope";

export type RelationshipAuthoringContext = {
  bookOptions?: readonly RelationshipBookOption[];
} & (
  | {
      focusCharacter: RelationshipParticipant;
      scope: Extract<RelationshipScope, { kind: "character" }>;
    }
  | { scope: Exclude<RelationshipScope, { kind: "character" }> }
);

export type RelationshipAuthoringSubject = {
  bookOptions: readonly RelationshipBookOption[];
  focusCharacter: Nullable<RelationshipParticipant>;
  scope: RelationshipScope;
};

export type RelationshipDraftState = {
  isDirty: boolean;
  isPending: boolean;
};

export type RelationshipEditorTarget =
  { mode: "create" } | { mode: "edit"; relationshipId: string };

export function relationshipRosterBookId(scope: RelationshipScope): Nullable<string> {
  return scope.kind === "book" ? scope.bookId : scope.contextBookId;
}

export function toRelationshipAuthoringSubject(
  context: RelationshipAuthoringContext,
): RelationshipAuthoringSubject {
  return {
    bookOptions: context.bookOptions ?? [],
    focusCharacter: "focusCharacter" in context ? context.focusCharacter : null,
    scope: context.scope,
  };
}
