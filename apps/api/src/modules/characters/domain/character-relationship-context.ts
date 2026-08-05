import type {
  CharacterRelationshipContextView,
  CharacterRelationshipDetailsView,
  Nullable,
} from "@app/shared";

import type {
  RelationshipBookStateSource,
  RelationshipSource,
} from "./character-relationship.mapper.js";
import type { ReadingPositionGate } from "./reading-position.js";

import {
  pickEffectiveBookState,
  toRelationshipBookStateView,
  toRelationshipView,
} from "./character-relationship.mapper.js";
import { isHiddenByReadingPosition } from "./reading-position.js";

export type RelationshipDetailsSource = RelationshipSource & {
  bookStates: RelationshipBookStateSource[];
};

export type RelationshipReadingContext = {
  allowedBookIds: string[];
  partNumberById: Map<string, Nullable<number>>;
  positionGate?: Nullable<ReadingPositionGate>;
};

export function buildContextViews({
  context,
  includeHistory,
  rows,
}: {
  context: RelationshipReadingContext;
  includeHistory: boolean;
  rows: RelationshipDetailsSource[];
}): CharacterRelationshipContextView[] {
  const gate = context.positionGate ?? null;
  const views: CharacterRelationshipContextView[] = [];
  for (const row of rows) {
    const effective = pickEffectiveBookState({
      partNumberById: context.partNumberById,
      states: row.bookStates,
    });
    if (effective !== null && effective.hideRelationshipAsSpoiler) {
      continue;
    }
    if (effective !== null && isBookStateHiddenByReadingPosition({ gate, state: effective })) {
      continue;
    }
    const typeHidden = effective?.isTypeSpoiler ?? false;
    const visibleStates = row.bookStates.filter(
      (state) =>
        !state.hideRelationshipAsSpoiler && !isBookStateHiddenByReadingPosition({ gate, state }),
    );
    views.push({
      effectiveState:
        effective === null
          ? null
          : toRelationshipBookStateView({
              descriptionHidden: effective.isDescriptionSpoiler,
              state: effective,
            }),
      history: includeHistory
        ? visibleStates.map((state) =>
            toRelationshipBookStateView({
              descriptionHidden: state.isDescriptionSpoiler,
              state,
            }),
          )
        : [],
      relationship: toRelationshipView({ relationship: row, typeHidden }),
    });
  }
  return views;
}

export function maskDetailsForContext({
  context,
  row,
}: {
  context: RelationshipReadingContext;
  row: RelationshipDetailsSource;
}): Nullable<CharacterRelationshipDetailsView> {
  const gate = context.positionGate ?? null;
  const allowed = new Set(context.allowedBookIds);
  const allowedStates = row.bookStates.filter((state) => allowed.has(state.bookId));
  const effective = pickEffectiveBookState({
    partNumberById: context.partNumberById,
    states: allowedStates,
  });
  if (effective !== null && effective.hideRelationshipAsSpoiler) {
    return null;
  }
  if (effective !== null && isBookStateHiddenByReadingPosition({ gate, state: effective })) {
    return null;
  }
  const typeHidden = effective?.isTypeSpoiler ?? false;
  const visibleStates = allowedStates.filter(
    (state) =>
      !state.hideRelationshipAsSpoiler && !isBookStateHiddenByReadingPosition({ gate, state }),
  );
  return {
    ...toRelationshipView({ relationship: row, typeHidden }),
    bookStates: visibleStates.map((state) =>
      toRelationshipBookStateView({ descriptionHidden: state.isDescriptionSpoiler, state }),
    ),
    diagnostics: [],
  };
}

function isBookStateHiddenByReadingPosition({
  gate,
  state,
}: {
  gate: Nullable<ReadingPositionGate>;
  state: {
    bookId: string;
    introducedAudioSeconds: Nullable<number>;
    introducedChapter: Nullable<string>;
    introducedPage: Nullable<number>;
  };
}): boolean {
  return isHiddenByReadingPosition({
    content: {
      audioSeconds: state.introducedAudioSeconds,
      chapter: state.introducedChapter,
      page: state.introducedPage,
    },
    contentBookId: state.bookId,
    gate,
  });
}
