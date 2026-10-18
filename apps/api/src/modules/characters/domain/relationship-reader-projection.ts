import type {
  CharacterRelationshipSafeContextBookStateView,
  CharacterRelationshipSafeContextView,
  CharacterRelationshipSafeDetailsView,
  Nullable,
  ReadingPosition,
  RelationshipBookStateStatus,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipIntensity,
  RelationshipType,
  SafeBookStateView,
  SafeParticipantView,
  SafeRelationshipEdgeView,
} from "@app/shared";

import {
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { max } from "date-fns";

import type {
  RelationshipBookStateSource,
  RelationshipSource,
} from "./character-relationship.mapper.js";
import type { ContentPosition } from "./reading-position.js";

import { assertNever } from "../../../core/assert-never.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { pickEffectiveBookState } from "./character-relationship.mapper.js";
import { contentDeclaresPosition, hasReaderReachedContent } from "./reading-position.js";

export type MaskedEdgeSemantics = {
  category: Nullable<RelationshipCategory>;
  customType: Nullable<string>;
  directionality: Nullable<RelationshipDirectionality>;
  isCanonical: Nullable<boolean>;
  sourceLabel: Nullable<string>;
  targetLabel: Nullable<string>;
  type: Nullable<RelationshipType>;
};

export type PermittedBookState = {
  book: ReaderBook;
  endReached: boolean;
  state: RelationshipBookStateSource;
};

export type ReaderBook = {
  id: string;
  partNumber: Nullable<number>;
  position: ReaderBookPosition;
  seriesId: Nullable<string>;
  title: string;
};

export type ReaderBookPosition =
  { kind: "finished" } | { kind: "position"; reader: ReadingPosition } | { kind: "unknown" };

export type ReaderEdgeSemanticsSource = {
  category: string;
  customType: Nullable<string>;
  directionality: string;
  isCanonical: boolean;
  sourceLabel: Nullable<string>;
  targetLabel: Nullable<string>;
  type: string;
};

export type ReaderProgressSource = {
  currentPage: Nullable<number>;
  finishedAt: Nullable<Date>;
};

export type ReaderScope =
  | { bookId: string; kind: "direct" }
  | { contextBookId: Nullable<string>; kind: "as_of" }
  | { kind: "global" };

export type RelationshipReaderContext = {
  books: ReadonlyMap<string, ReaderBook>;
  scope: ReaderScope;
};

export type RelationshipReaderProjection = {
  effective: Nullable<PermittedBookState>;
  history: PermittedBookState[];
  typeHidden: boolean;
  visibleChangedAt: Date;
};

export type RelationshipReveal = {
  descriptionBookStateId: Nullable<string>;
  type: boolean;
};

export type SafeEdgeSource = ReaderEdgeSemanticsSource & {
  createdAt: Date;
  id: string;
};

export type SafeParticipants = {
  source: SafeParticipantView;
  target: SafeParticipantView;
};

export type StateVisibility = { endReached: boolean; kind: "visible" } | { kind: "omitted" };

type ProjectableRelationship = {
  bookStates: RelationshipBookStateSource[];
  createdAt: Date;
  updatedAt: Date;
};

type VisibilityGatedState = Pick<
  RelationshipBookStateSource,
  | "endedAudioSeconds"
  | "endedChapter"
  | "endedPage"
  | "hideRelationshipAsSpoiler"
  | "introducedAudioSeconds"
  | "introducedChapter"
  | "introducedPage"
>;

export function evaluateStateVisibility({
  position,
  state,
}: {
  position: ReaderBookPosition;
  state: VisibilityGatedState;
}): StateVisibility {
  if (state.hideRelationshipAsSpoiler) {
    return { kind: "omitted" };
  }
  if (!hasReaderReachedMarker({ content: introductionMarkersOf(state), position })) {
    return { kind: "omitted" };
  }
  return {
    endReached: hasReaderReachedMarker({ content: endMarkersOf(state), position }),
    kind: "visible",
  };
}

export function hasReaderReachedMarker({
  content,
  position,
}: {
  content: ContentPosition;
  position: ReaderBookPosition;
}): boolean {
  if (!contentDeclaresPosition(content)) {
    return true;
  }
  switch (position.kind) {
    case "finished":
      return true;
    case "position":
      return hasReaderReachedContent({ content, reader: position.reader });
    case "unknown":
      return false;
    default:
      return assertNever(position);
  }
}

export function isBookStateDescriptionHidden({
  revealed,
  state,
}: {
  revealed: boolean;
  state: Pick<RelationshipBookStateSource, "description" | "isDescriptionSpoiler">;
}): boolean {
  if (revealed || !state.isDescriptionSpoiler || state.description === null) {
    return false;
  }
  return state.description.trim().length > 0;
}

export function isPermittedBookState({
  bookStateId,
  projection,
}: {
  bookStateId: string;
  projection: RelationshipReaderProjection;
}): boolean {
  if (projection.effective !== null && projection.effective.state.id === bookStateId) {
    return true;
  }
  return projection.history.some((permitted) => permitted.state.id === bookStateId);
}

export function maskBookStateStatus({
  endReached,
  status,
}: {
  endReached: boolean;
  status: string;
}): Nullable<RelationshipBookStateStatus> {
  const parsed = RelationshipBookStateStatusSchema.parse(status);
  if (!endReached && parsed === "ended") {
    return null;
  }
  return parsed;
}

export function maskEdgeSemantics({
  relationship,
  typeHidden,
}: {
  relationship: ReaderEdgeSemanticsSource;
  typeHidden: boolean;
}): MaskedEdgeSemantics {
  if (typeHidden) {
    return {
      category: null,
      customType: null,
      directionality: null,
      isCanonical: null,
      sourceLabel: null,
      targetLabel: null,
      type: null,
    };
  }
  return {
    category: RelationshipCategorySchema.parse(relationship.category),
    customType: relationship.customType,
    directionality: RelationshipDirectionalitySchema.parse(relationship.directionality),
    isCanonical: relationship.isCanonical,
    sourceLabel: relationship.sourceLabel,
    targetLabel: relationship.targetLabel,
    type: RelationshipTypeSchema.parse(relationship.type),
  };
}

export function maskIntensity({
  intensity,
  typeHidden,
}: {
  intensity: Nullable<string>;
  typeHidden: boolean;
}): Nullable<RelationshipIntensity> {
  if (typeHidden || intensity === null) {
    return null;
  }
  return RelationshipIntensitySchema.parse(intensity);
}

export function projectRelationshipForReader({
  context,
  relationship,
}: {
  context: RelationshipReaderContext;
  relationship: ProjectableRelationship;
}): Nullable<RelationshipReaderProjection> {
  switch (context.scope.kind) {
    case "as_of":
      return projectAsOf({ books: context.books, relationship });
    case "direct":
      return projectDirect({ bookId: context.scope.bookId, books: context.books, relationship });
    case "global":
      return projectGlobal({ books: context.books, relationship });
    default:
      return assertNever(context.scope);
  }
}

export function readerAllowedBookIds(context: RelationshipReaderContext): string[] {
  return [...context.books.keys()];
}

export function readerPartNumberById(
  context: RelationshipReaderContext,
): Map<string, Nullable<number>> {
  return partNumbersOf(context.books);
}

export function resolveReaderBookPosition({
  explicit,
  progress,
}: {
  explicit: ReadingPosition | undefined;
  progress: Nullable<ReaderProgressSource>;
}): ReaderBookPosition {
  if (explicit !== undefined) {
    return { kind: "position", reader: explicit };
  }
  if (progress === null) {
    return { kind: "unknown" };
  }
  if (progress.finishedAt !== null) {
    return { kind: "finished" };
  }
  if (progress.currentPage !== null && progress.currentPage > 0) {
    return { kind: "position", reader: { page: progress.currentPage } };
  }
  return { kind: "unknown" };
}

export function toSafeBookStateView({
  permitted,
  revealDescription,
  typeHidden,
}: {
  permitted: PermittedBookState;
  revealDescription: boolean;
  typeHidden: boolean;
}): SafeBookStateView {
  const { book, endReached, state } = permitted;
  const descriptionHidden = isBookStateDescriptionHidden({ revealed: revealDescription, state });
  return {
    bookId: state.bookId,
    bookTitle: book.title,
    description: descriptionHidden ? null : state.description,
    descriptionHidden,
    endedAudioSeconds: endReached ? state.endedAudioSeconds : null,
    endedChapter: endReached ? state.endedChapter : null,
    endedPage: endReached ? state.endedPage : null,
    id: state.id,
    intensity: maskIntensity({ intensity: state.intensity, typeHidden }),
    introducedAudioSeconds: state.introducedAudioSeconds,
    introducedChapter: state.introducedChapter,
    introducedPage: state.introducedPage,
    partNumber: book.partNumber,
    status: maskBookStateStatus({ endReached, status: state.status }),
  };
}

export function toSafeRelationshipContextView({
  includeHistory,
  projection,
  relationship,
}: {
  includeHistory: boolean;
  projection: RelationshipReaderProjection;
  relationship: RelationshipSource;
}): CharacterRelationshipSafeContextView {
  const { typeHidden } = projection;
  return {
    effectiveState:
      projection.effective === null
        ? null
        : toSafeContextBookStateView({ permitted: projection.effective, typeHidden }),
    history: includeHistory
      ? projection.history.map((permitted) => toSafeContextBookStateView({ permitted, typeHidden }))
      : [],
    relationship: {
      ...maskEdgeSemantics({ relationship, typeHidden }),
      createdAt: relationship.createdAt.toISOString(),
      id: relationship.id,
      sourceCharacterId: relationship.sourceCharacterId,
      sourceCharacterName: relationship.sourceCharacter.name,
      targetCharacterId: relationship.targetCharacterId,
      targetCharacterName: relationship.targetCharacter.name,
      typeHidden,
      updatedAt: projection.visibleChangedAt.toISOString(),
    },
  };
}

export function toSafeRelationshipDetailsView({
  participants,
  projection,
  relationship,
  reveal,
}: {
  participants: SafeParticipants;
  projection: RelationshipReaderProjection;
  relationship: SafeEdgeSource;
  reveal: RelationshipReveal;
}): CharacterRelationshipSafeDetailsView {
  const typeHidden = projection.typeHidden && !reveal.type;
  const toStateView = (permitted: PermittedBookState): SafeBookStateView =>
    toSafeBookStateView({
      permitted,
      revealDescription: permitted.state.id === reveal.descriptionBookStateId,
      typeHidden,
    });
  return {
    effectiveState: projection.effective === null ? null : toStateView(projection.effective),
    history: projection.history.map(toStateView),
    relationship: toSafeRelationshipEdgeView({
      participants,
      projection,
      relationship,
      revealType: reveal.type,
    }),
  };
}

export function toSafeRelationshipEdgeView({
  participants,
  projection,
  relationship,
  revealType,
}: {
  participants: SafeParticipants;
  projection: RelationshipReaderProjection;
  relationship: SafeEdgeSource;
  revealType: boolean;
}): SafeRelationshipEdgeView {
  const typeHidden = projection.typeHidden && !revealType;
  return {
    ...maskEdgeSemantics({ relationship, typeHidden }),
    createdAt: relationship.createdAt.toISOString(),
    id: relationship.id,
    source: participants.source,
    target: participants.target,
    typeHidden,
    visibleChangedAt: projection.visibleChangedAt.toISOString(),
  };
}

function compareAsOfHistory(left: PermittedBookState, right: PermittedBookState): number {
  return (
    comparePartNumberAscNullsLast(left.book.partNumber, right.book.partNumber) ||
    UKRAINIAN_COLLATION.compare(left.book.title, right.book.title) ||
    compareStrings(left.book.id, right.book.id)
  );
}

function compareGlobalHistory(left: PermittedBookState, right: PermittedBookState): number {
  return standaloneRank(left.book) - standaloneRank(right.book) || compareAsOfHistory(left, right);
}

function comparePartNumberAscNullsLast(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function computeVisibleChangedAt({
  history,
  relationship,
  typeHidden,
}: {
  history: PermittedBookState[];
  relationship: ProjectableRelationship;
  typeHidden: boolean;
}): Date {
  const candidates = [relationship.createdAt];
  if (!typeHidden) {
    candidates.push(relationship.updatedAt);
  }
  for (const permitted of history) {
    if (isFullyUnmasked({ permitted, typeHidden })) {
      candidates.push(permitted.state.updatedAt);
    }
  }
  return max(candidates);
}

function endMarkersOf(state: VisibilityGatedState): ContentPosition {
  return {
    audioSeconds: state.endedAudioSeconds,
    chapter: state.endedChapter,
    page: state.endedPage,
  };
}

function finishProjection({
  effective,
  history,
  relationship,
  typeHidden,
}: {
  effective: Nullable<PermittedBookState>;
  history: PermittedBookState[];
  relationship: ProjectableRelationship;
  typeHidden: boolean;
}): RelationshipReaderProjection {
  return {
    effective,
    history,
    typeHidden,
    visibleChangedAt: computeVisibleChangedAt({ history, relationship, typeHidden }),
  };
}

function introductionMarkersOf(state: VisibilityGatedState): ContentPosition {
  return {
    audioSeconds: state.introducedAudioSeconds,
    chapter: state.introducedChapter,
    page: state.introducedPage,
  };
}

function isFullyUnmasked({
  permitted,
  typeHidden,
}: {
  permitted: PermittedBookState;
  typeHidden: boolean;
}): boolean {
  return (
    permitted.endReached &&
    !typeHidden &&
    !permitted.state.isTypeSpoiler &&
    !permitted.state.isDescriptionSpoiler
  );
}

function partNumbersOf(books: ReadonlyMap<string, ReaderBook>): Map<string, Nullable<number>> {
  return new Map([...books.values()].map((book) => [book.id, book.partNumber]));
}

function permitBookState({
  books,
  state,
}: {
  books: ReadonlyMap<string, ReaderBook>;
  state: RelationshipBookStateSource;
}): Nullable<PermittedBookState> {
  const book = books.get(state.bookId);
  if (book === undefined) {
    return null;
  }
  const visibility = evaluateStateVisibility({ position: book.position, state });
  if (visibility.kind === "omitted") {
    return null;
  }
  return { book, endReached: visibility.endReached, state };
}

function permitBookStates({
  books,
  states,
}: {
  books: ReadonlyMap<string, ReaderBook>;
  states: RelationshipBookStateSource[];
}): PermittedBookState[] {
  return states.flatMap((state) => {
    const permitted = permitBookState({ books, state });
    return permitted === null ? [] : [permitted];
  });
}

function projectAsOf({
  books,
  relationship,
}: {
  books: ReadonlyMap<string, ReaderBook>;
  relationship: ProjectableRelationship;
}): Nullable<RelationshipReaderProjection> {
  const allowedStates = relationship.bookStates.filter((state) => books.has(state.bookId));
  const effectiveState = pickEffectiveBookState({
    partNumberById: partNumbersOf(books),
    states: allowedStates,
  });
  if (effectiveState === null) {
    return null;
  }
  const effective = permitBookState({ books, state: effectiveState });
  if (effective === null) {
    return null;
  }
  return finishProjection({
    effective,
    history: permitBookStates({ books, states: allowedStates }).sort(compareAsOfHistory),
    relationship,
    typeHidden: effectiveState.isTypeSpoiler,
  });
}

function projectDirect({
  bookId,
  books,
  relationship,
}: {
  bookId: string;
  books: ReadonlyMap<string, ReaderBook>;
  relationship: ProjectableRelationship;
}): Nullable<RelationshipReaderProjection> {
  const state = relationship.bookStates.find((candidate) => candidate.bookId === bookId);
  if (state === undefined) {
    return null;
  }
  const effective = permitBookState({ books, state });
  if (effective === null) {
    return null;
  }
  return finishProjection({
    effective,
    history: [effective],
    relationship,
    typeHidden: state.isTypeSpoiler,
  });
}

function projectGlobal({
  books,
  relationship,
}: {
  books: ReadonlyMap<string, ReaderBook>;
  relationship: ProjectableRelationship;
}): Nullable<RelationshipReaderProjection> {
  if (relationship.bookStates.length === 0) {
    return finishProjection({ effective: null, history: [], relationship, typeHidden: false });
  }
  const history = permitBookStates({ books, states: relationship.bookStates }).sort(
    compareGlobalHistory,
  );
  if (history.length === 0) {
    return null;
  }
  return finishProjection({
    effective: null,
    history,
    relationship,
    typeHidden: history.some((permitted) => permitted.state.isTypeSpoiler),
  });
}

function standaloneRank(book: ReaderBook): number {
  return book.seriesId === null ? 1 : 0;
}

function toSafeContextBookStateView({
  permitted,
  typeHidden,
}: {
  permitted: PermittedBookState;
  typeHidden: boolean;
}): CharacterRelationshipSafeContextBookStateView {
  const { endReached, state } = permitted;
  const descriptionHidden = isBookStateDescriptionHidden({ revealed: false, state });
  const visibleUpdatedAt = isFullyUnmasked({ permitted, typeHidden })
    ? state.updatedAt
    : state.createdAt;
  return {
    bookId: state.bookId,
    createdAt: state.createdAt.toISOString(),
    description: descriptionHidden ? null : state.description,
    descriptionHidden,
    endedAudioSeconds: endReached ? state.endedAudioSeconds : null,
    endedChapter: endReached ? state.endedChapter : null,
    endedPage: endReached ? state.endedPage : null,
    hideRelationshipAsSpoiler: state.hideRelationshipAsSpoiler,
    id: state.id,
    intensity: maskIntensity({ intensity: state.intensity, typeHidden }),
    introducedAudioSeconds: state.introducedAudioSeconds,
    introducedChapter: state.introducedChapter,
    introducedPage: state.introducedPage,
    isDescriptionSpoiler: state.isDescriptionSpoiler,
    isTypeSpoiler: state.isTypeSpoiler,
    relationshipId: state.relationshipId,
    status: maskBookStateStatus({ endReached, status: state.status }),
    updatedAt: visibleUpdatedAt.toISOString(),
  };
}
