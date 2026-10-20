"use client";

import type { CharacterCatalogItemView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { cn } from "@/lib/utils";

import type { CharactersCatalogState } from "../model/characters-catalog-query";

import { CatalogCharacterCard } from "./catalog-character-card";
import { CharacterCardSkeleton } from "./character-card-skeleton";
import { CharactersErrorState } from "./characters-error-state";

type CharactersCatalogContentProps = {
  characters: CharacterCatalogItemView[];
  hasActiveFilters: boolean;
  isPending: boolean;
  loadMoreState: InfiniteScrollState;
  onClearFilters: () => void;
  onLoadMore: () => void;
  view: CharactersCatalogState["view"];
};

const SKELETON_COUNT = 8;

export function CharactersCatalogContent({
  characters,
  hasActiveFilters,
  isPending,
  loadMoreState,
  onClearFilters,
  onLoadMore,
  view,
}: CharactersCatalogContentProps) {
  const t = useTranslations("characters.catalog");

  if (isPending) {
    return (
      <div aria-busy className={catalogListClassName(view)}>
        {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (characters.length === 0) {
    return hasActiveFilters ? <NoResults onClear={onClearFilters} /> : <EmptyCatalog />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className={catalogListClassName(view)}>
        {characters.map((character) => (
          <li className="min-w-0" key={character.id}>
            <CatalogCharacterCard character={character} view={view} />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        errorLabel={t("loadMoreError")}
        onLoadMore={onLoadMore}
        state={loadMoreState}
      />
    </div>
  );
}

export function CharactersCatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div aria-live="assertive" role="alert">
      <CharactersErrorState onRetry={onRetry} />
    </div>
  );
}

function catalogListClassName(view: CharactersCatalogState["view"]) {
  return cn("grid grid-cols-1 gap-4", view === "grid" && "lg:grid-cols-2");
}

function EmptyCatalog() {
  const t = useTranslations("characters.catalog.empty");

  const state: EmptyStateEntry = {
    desc: t("description"),
    illu: "empty-authors",
    title: t("title"),
  };

  return <EmptyState state={state} />;
}

function NoResults({ onClear }: { onClear: () => void }) {
  const t = useTranslations("characters.catalog.noResults");

  const state: EmptyStateEntry = {
    desc: t("description"),
    illu: "empty-search",
    primary: { icon: "x", label: t("clear") },
    title: t("title"),
  };

  return <EmptyState onPrimary={onClear} state={state} />;
}
