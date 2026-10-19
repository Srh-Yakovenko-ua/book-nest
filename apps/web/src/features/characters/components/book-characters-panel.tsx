"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import type {
  RelationshipAuthoringActions,
  RelationshipScope,
} from "@/features/character-relationships";

import {
  RelationshipGraph,
  RelationshipList,
  useRelationshipAuthoring,
} from "@/features/character-relationships";
import { assertNever } from "@/lib/assert-never";

import type { CharactersViewMode } from "../model/characters-view-mode";

import { useCharactersViewMode } from "../model/use-characters-view-mode";
import { BookCharactersTab } from "./book-characters-tab";
import { CharactersViewModes } from "./characters-view-modes";

type BookCharactersPanelProps = {
  book: BookView;
};

type BookRelationshipScope = Extract<RelationshipScope, { kind: "book" }>;

export function BookCharactersPanel({ book }: BookCharactersPanelProps) {
  const [view, setView] = useCharactersViewMode();
  const scope: BookRelationshipScope = { bookId: book.id, kind: "book" };
  const authoring = useRelationshipAuthoring({
    bookOptions: [{ id: book.id, title: book.title }],
    scope,
  });

  return (
    <div className="flex flex-col gap-5">
      <CharactersViewModes onChange={(mode) => void setView(mode)} value={view} />
      {renderView({ actions: authoring.actions, book, scope, view })}
      {authoring.dialogs}
    </div>
  );
}

function renderView({
  actions,
  book,
  scope,
  view,
}: {
  actions: RelationshipAuthoringActions;
  book: BookView;
  scope: BookRelationshipScope;
  view: CharactersViewMode;
}): ReactNode {
  switch (view) {
    case "graph":
      return (
        <RelationshipGraph onDelete={actions.onDelete} onEdit={actions.onEdit} scope={scope} />
      );
    case "list":
      return <BookCharactersTab book={book} />;
    case "relationships":
      return <RelationshipList scope={scope} {...actions} />;
    default:
      return assertNever(view);
  }
}
