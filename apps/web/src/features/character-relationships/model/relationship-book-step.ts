import type { CharacterRelationshipDetailsView, Nullable } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { RelationshipBookOption } from "./relationship-adapter";
import type { RelationshipScope } from "./relationship-scope";

export type RelationshipBookChoice = {
  id: string;
  title: Nullable<string>;
};

export type RelationshipBookStep =
  | { book: RelationshipBookChoice; kind: "fixed" }
  | { kind: "optional"; options: readonly RelationshipBookChoice[] }
  | { kind: "required"; options: readonly RelationshipBookChoice[] };

type BookStepSource = {
  bookOptions: readonly RelationshipBookOption[];
  scope: RelationshipScope;
};

export function defaultRelationshipBookId({
  relationship,
  scope,
  step,
}: {
  relationship: Nullable<CharacterRelationshipDetailsView>;
  scope: RelationshipScope;
  step: RelationshipBookStep;
}): Nullable<string> {
  if (step.kind === "fixed") return step.book.id;
  const optionIds = step.options.map((option) => option.id);
  const contextBookId = scope.kind === "series" ? scope.contextBookId : null;
  if (contextBookId !== null && optionIds.includes(contextBookId)) return contextBookId;
  if (step.kind === "required") return optionIds[0] ?? null;
  return (
    optionIds.find((bookId) => relationship?.bookStates.some((state) => state.bookId === bookId)) ??
    null
  );
}

export function toRelationshipCreateBookStep({
  bookOptions,
  scope,
}: BookStepSource): RelationshipBookStep {
  switch (scope.kind) {
    case "book":
      return { book: findBookChoice({ bookId: scope.bookId, bookOptions }), kind: "fixed" };
    case "character":
      return scope.contextBookId === null
        ? { kind: "optional", options: bookOptions }
        : { book: findBookChoice({ bookId: scope.contextBookId, bookOptions }), kind: "fixed" };
    case "series":
      return {
        kind: "required",
        options: withContextBook({ bookId: scope.contextBookId, bookOptions }),
      };
    default:
      return assertNever(scope);
  }
}

export function toRelationshipEditBookStep({
  bookOptions,
  relationship,
  scope,
}: BookStepSource & { relationship: CharacterRelationshipDetailsView }): RelationshipBookStep {
  const step = toRelationshipCreateBookStep({ bookOptions, scope });
  if (step.kind === "fixed") return step;
  const listedIds = new Set(step.options.map((option) => option.id));
  const unlistedStoredBooks = relationship.bookStates
    .filter((state) => !listedIds.has(state.bookId))
    .map((state): RelationshipBookChoice => ({ id: state.bookId, title: null }));
  return { kind: "optional", options: [...step.options, ...unlistedStoredBooks] };
}

function findBookChoice({
  bookId,
  bookOptions,
}: {
  bookId: string;
  bookOptions: readonly RelationshipBookOption[];
}): RelationshipBookChoice {
  return { id: bookId, title: bookOptions.find((book) => book.id === bookId)?.title ?? null };
}

function withContextBook({
  bookId,
  bookOptions,
}: {
  bookId: Nullable<string>;
  bookOptions: readonly RelationshipBookOption[];
}): readonly RelationshipBookChoice[] {
  if (bookId === null || bookOptions.some((book) => book.id === bookId)) return bookOptions;
  return [{ id: bookId, title: null }, ...bookOptions];
}
