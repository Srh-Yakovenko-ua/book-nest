"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type {
  RelationshipAuthoringActions,
  RelationshipScope,
} from "@/features/character-relationships";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  getBookGraphWorkspacePath,
  RelationshipList,
  useRelationshipAuthoring,
} from "@/features/character-relationships";
import { Link, useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { CharactersViewMode } from "../model/characters-view-mode";

import { CHARACTERS_VIEW } from "../model/characters-view-mode";
import { useCharactersViewMode } from "../model/use-characters-view-mode";
import { BookCharactersTab } from "./book-characters-tab";
import { CharactersViewModes } from "./characters-view-modes";

type BookCharactersPanelProps = {
  book: BookView;
};

type BookRelationshipScope = Extract<RelationshipScope, { kind: "book" }>;

export function BookCharactersPanel({ book }: BookCharactersPanelProps) {
  const t = useTranslations("characters.viewModes");
  const [view, setView] = useCharactersViewMode();
  const router = useRouter();
  const scope: BookRelationshipScope = { bookId: book.id, kind: "book" };
  const authoring = useRelationshipAuthoring({
    bookOptions: [{ id: book.id, title: book.title }],
    scope,
  });
  const graphPath = getBookGraphWorkspacePath(book.id);

  useEffect(() => {
    if (view === "graph") router.replace(graphPath);
  }, [graphPath, router, view]);

  if (view === "graph") return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CharactersViewModes
          modes={CHARACTERS_VIEW.bookModes}
          onChange={(mode) => void setView(mode)}
          value={view}
        />
        <Button asChild className="w-full sm:w-fit" variant="outline">
          <Link href={graphPath}>
            <UiIcon name="share" size={16} />
            {t("openGraph")}
            <UiIcon name="arrow-up-right" size={14} />
          </Link>
        </Button>
      </div>
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
  view: Exclude<CharactersViewMode, "graph">;
}): ReactNode {
  switch (view) {
    case "list":
      return <BookCharactersTab book={book} />;
    case "relationships":
      return <RelationshipList scope={scope} {...actions} />;
    default:
      return assertNever(view);
  }
}
