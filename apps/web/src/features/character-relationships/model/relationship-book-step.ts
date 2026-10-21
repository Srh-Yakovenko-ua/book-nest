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

export type RelationshipCreateBookBlockReason = "character-without-books" | "series-without-books";

export type RelationshipCreateBookContext =
  | { book: RelationshipBookChoice; kind: "auto" }
  | { book: RelationshipBookChoice; kind: "fixed" }
  | { defaultBookId: Nullable<string>; kind: "choice"; options: readonly RelationshipBookChoice[] }
  | { kind: "blocked"; reason: RelationshipCreateBookBlockReason };

type BookStepSource = {
  bookOptions: readonly RelationshipBookOption[];
  scope: RelationshipScope;
};

type CreateBookContextSource = {
  createBookOptions: readonly RelationshipBookOption[];
  scope: RelationshipScope;
};

type ScopedCreateBooks = {
  bookOptions: readonly RelationshipBookOption[];
  contextBookId: Nullable<string>;
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
  return (
    optionIds.find((bookId) => relationship?.bookStates.some((state) => state.bookId === bookId)) ??
    null
  );
}

export function findRelationshipCreateBookTitle({
  bookId,
  context,
}: {
  bookId: Nullable<string>;
  context: RelationshipCreateBookContext;
}): Nullable<string> {
  switch (context.kind) {
    case "auto":
    case "fixed":
      return context.book.title;
    case "blocked":
      return null;
    case "choice":
      return context.options.find((option) => option.id === bookId)?.title ?? null;
    default:
      return assertNever(context);
  }
}

export function resolveRelationshipCreateBookContext({
  createBookOptions,
  scope,
}: CreateBookContextSource): RelationshipCreateBookContext {
  switch (scope.kind) {
    case "book":
      return {
        book: findBookChoice({ bookId: scope.bookId, bookOptions: createBookOptions }),
        kind: "fixed",
      };
    case "character":
      return resolveCharacterCreateBook({
        bookOptions: createBookOptions,
        contextBookId: scope.contextBookId,
      });
    case "series":
      return resolveSeriesCreateBook({
        bookOptions: createBookOptions,
        contextBookId: scope.contextBookId,
      });
    default:
      return assertNever(scope);
  }
}

export function toRelationshipCreateInitialBookId(
  context: RelationshipCreateBookContext,
): Nullable<string> {
  switch (context.kind) {
    case "auto":
      return context.book.id;
    case "blocked":
      return null;
    case "choice":
      return context.defaultBookId;
    case "fixed":
      return context.book.id;
    default:
      return assertNever(context);
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

function resolveCharacterCreateBook({
  bookOptions,
  contextBookId,
}: ScopedCreateBooks): RelationshipCreateBookContext {
  if (contextBookId !== null) {
    return { book: findBookChoice({ bookId: contextBookId, bookOptions }), kind: "fixed" };
  }
  const [onlyBook, ...otherBooks] = bookOptions;
  if (onlyBook === undefined) return { kind: "blocked", reason: "character-without-books" };
  if (otherBooks.length === 0) return { book: onlyBook, kind: "auto" };
  return { defaultBookId: null, kind: "choice", options: bookOptions };
}

function resolveSeriesCreateBook({
  bookOptions,
  contextBookId,
}: ScopedCreateBooks): RelationshipCreateBookContext {
  if (bookOptions.length === 0) return { kind: "blocked", reason: "series-without-books" };
  const hasContextBook = bookOptions.some((book) => book.id === contextBookId);
  return {
    defaultBookId: hasContextBook ? contextBookId : null,
    kind: "choice",
    options: bookOptions,
  };
}

function toRelationshipCreateBookStep({
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
