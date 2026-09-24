"use client";

import type { CharacterGlobalSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { CharactersCatalogState } from "../model/characters-catalog-query";

import { getCharacterDetailsPath } from "../model/character-routes";
import { CharacterCardSkeleton } from "./character-card-skeleton";
import { CharactersErrorState } from "./characters-error-state";

type CharactersCatalogContentProps = {
  characters: CharacterGlobalSummaryView[];
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  onClearFilters: () => void;
  onLoadMore: () => void;
  view: CharactersCatalogState["view"];
};

const SKELETON_COUNT = 8;

export function CharactersCatalogContent({
  characters,
  hasActiveFilters,
  hasNextPage,
  isFetchingNextPage,
  isPending,
  onClearFilters,
  onLoadMore,
  view,
}: CharactersCatalogContentProps) {
  const t = useTranslations("characters.catalog");

  if (isPending) {
    return (
      <div aria-busy className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
        <span className="sr-only">{t("states.loading")}</span>
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
      <ul
        className={cn(
          "grid gap-4",
          view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
        )}
      >
        {characters.map((character) => (
          <li key={character.id}>
            <CatalogRow character={character} view={view} />
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <Button
          className="self-center"
          disabled={isFetchingNextPage}
          loading={isFetchingNextPage}
          onClick={onLoadMore}
          variant="secondary"
        >
          {t("loadMore")}
        </Button>
      ) : null}
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

function CatalogRow({
  character,
  view,
}: {
  character: CharacterGlobalSummaryView;
  view: CharactersCatalogState["view"];
}) {
  const t = useTranslations("characters.catalog");

  return (
    <Link
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-hover motion-reduce:transition-none",
        view === "grid" ? "h-full" : "",
      )}
      href={getCharacterDetailsPath({ characterId: character.id })}
    >
      <Avatar
        className="size-12 shrink-0 bg-gradient-to-br from-accent-border to-primary text-primary-foreground"
        size="lg"
      >
        {character.avatar === null ? null : (
          <AvatarImage alt={character.name} src={character.avatar.urls.thumb} />
        )}
        <AvatarFallback className="bg-transparent font-heading text-lg font-bold text-primary-foreground">
          {character.name.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-heading text-base text-ink">{character.name}</span>
        <span className="text-xs text-muted-foreground">
          {t("appearanceCount", { count: character.appearanceCount })}
        </span>
        {character.tags.length === 0 ? null : (
          <span className="flex flex-wrap gap-1.5 pt-1">
            {character.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </span>
        )}
      </div>

      {character.isFavorite ? (
        <span className="shrink-0 text-brand">
          <UiIcon name="heart-fill" size={18} />
        </span>
      ) : null}
    </Link>
  );
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
