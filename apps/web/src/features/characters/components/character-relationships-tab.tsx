"use client";

import type { BookCharacterView, CharacterDetailsView } from "@app/shared";

import type { RelationshipScope } from "@/features/character-relationships";

import { RelationshipList, useRelationshipAuthoring } from "@/features/character-relationships";

import type { CharacterDetailsMode } from "../model/character-details-context";

type CharacterRelationshipsTabProps = {
  appearance: BookCharacterView | undefined;
  appearances: readonly BookCharacterView[];
  character: CharacterDetailsView;
  mode: CharacterDetailsMode;
};

export function CharacterRelationshipsTab({
  appearance,
  appearances,
  character,
  mode,
}: CharacterRelationshipsTabProps) {
  const scope = {
    characterId: character.id,
    contextBookId: mode.kind === "book" ? mode.bookId : null,
    kind: "character",
  } satisfies RelationshipScope;
  const bookOptions = appearances.map((entry) => ({ id: entry.bookId, title: entry.book.title }));
  const authoring = useRelationshipAuthoring({
    bookOptions,
    focusCharacter: {
      avatarUrl: (appearance?.portrait ?? character.avatar)?.urls.thumb ?? null,
      id: character.id,
      name: appearance?.displayName ?? character.name,
    },
    scope,
  });

  return (
    <>
      <RelationshipList bookOptions={bookOptions} scope={scope} {...authoring.actions} />
      {authoring.dialogs}
    </>
  );
}
