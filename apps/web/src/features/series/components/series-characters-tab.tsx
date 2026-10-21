"use client";

import type { SeriesBookView, SeriesDetailsView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type {
  RelationshipAuthoringActions,
  RelationshipScope,
} from "@/features/character-relationships";
import type { CharactersViewMode } from "@/features/characters";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RelationshipGraph,
  RelationshipList,
  useRelationshipAuthoring,
} from "@/features/character-relationships";
import {
  CharactersErrorState,
  CharactersViewModes,
  useCharactersViewMode,
} from "@/features/characters";
import { assertNever } from "@/lib/assert-never";

import { seriesBooksAsOf, seriesContextBooks } from "../model/series-characters-query";
import { useSeriesCharactersContext } from "../model/use-series-characters-context";
import { SeriesCastList } from "./series-cast-list";
import { SeriesCharactersContextSelect } from "./series-characters-context-select";

type SeriesCharactersTabProps = {
  details: SeriesDetailsView;
  onAddBook: () => void;
};

type SeriesCharactersViewProps = {
  books: readonly SeriesBookView[];
  contextBook: SeriesBookView;
  seriesId: string;
  view: CharactersViewMode;
};

type SeriesRelationshipScope = Extract<RelationshipScope, { kind: "series" }> & {
  contextBookId: string;
};

export function SeriesCharactersTab({ details, onAddBook }: SeriesCharactersTabProps) {
  const t = useTranslations("series.details");
  const books = seriesContextBooks(details.books);
  const context = useSeriesCharactersContext({ books, seriesId: details.id });
  const [view, setView] = useCharactersViewMode();

  switch (context.kind) {
    case "empty":
      return <SeriesCharactersNoBooks onAddBook={onAddBook} />;
    case "error":
      return (
        <CharactersErrorState description={t("characters.context.error")} onRetry={context.retry} />
      );
    case "pending":
      return <SeriesCharactersPending />;
    case "ready":
      return (
        <div className="flex flex-col gap-5">
          <CharactersViewModes onChange={(mode) => void setView(mode)} value={view} />
          <SeriesCharactersContextSelect
            books={books}
            onChange={context.select}
            value={context.book.id}
          />
          <SeriesCharactersView
            books={books}
            contextBook={context.book}
            key={context.book.id}
            seriesId={details.id}
            view={view}
          />
        </div>
      );
    default:
      return assertNever(context);
  }
}

function renderView({
  actions,
  scope,
  view,
}: {
  actions: RelationshipAuthoringActions;
  scope: SeriesRelationshipScope;
  view: CharactersViewMode;
}): ReactNode {
  switch (view) {
    case "graph":
      return (
        <RelationshipGraph onDelete={actions.onDelete} onEdit={actions.onEdit} scope={scope} />
      );
    case "list":
      return <SeriesCastList contextBookId={scope.contextBookId} seriesId={scope.seriesId} />;
    case "relationships":
      return <RelationshipList scope={scope} {...actions} />;
    default:
      return assertNever(view);
  }
}

function SeriesCharactersNoBooks({ onAddBook }: { onAddBook: () => void }) {
  const t = useTranslations("series.details");

  const state: EmptyStateEntry = {
    desc: t("characters.noBooks.description"),
    illu: "empty-series",
    primary: { icon: "plus", label: t("booksEmpty.action") },
    title: t("characters.noBooks.title"),
  };

  return <EmptyState onPrimary={onAddBook} state={state} />;
}

function SeriesCharactersPending() {
  const t = useTranslations("series.details.characters.context");

  return (
    <div aria-busy className="flex flex-col gap-5" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-10 w-full sm:w-80" />
      <Skeleton className="h-10 w-full sm:max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function SeriesCharactersView({ books, contextBook, seriesId, view }: SeriesCharactersViewProps) {
  const scope: SeriesRelationshipScope = {
    contextBookId: contextBook.id,
    kind: "series",
    seriesId,
  };
  const authoring = useRelationshipAuthoring({
    bookOptions: seriesBooksAsOf({ books, contextBook }),
    createBookOptions: books,
    scope,
  });

  return (
    <>
      {renderView({ actions: authoring.actions, scope, view })}
      {authoring.dialogs}
    </>
  );
}
