"use client";

import type { CharacterOverviewView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { TitleLeaf } from "@/components/title-leaf";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { formatNumber } from "@/lib/format";

import { useCharactersCatalog } from "../api/use-characters-catalog";
import { useCharactersOverview } from "../api/use-characters-overview";
import {
  CHARACTERS_CATALOG_SORTS,
  CHARACTERS_CATALOG_VIEWS,
} from "../model/characters-catalog-query";
import { useCharactersCatalogQuery } from "../model/use-characters-catalog-query";
import { CharactersCatalogContent, CharactersCatalogError } from "./characters-catalog-content";
import { CharactersCatalogFilters } from "./characters-catalog-filters";
import { CharactersCatalogSidebar } from "./characters-catalog-sidebar";

export function CharactersCatalogView() {
  const t = useTranslations("characters.catalog");
  const {
    activeAdvancedCount,
    applyAdvanced,
    clearAll,
    hasActiveFilters,
    listParams,
    setFilter,
    setSearch,
    setSort,
    setView,
    state,
  } = useCharactersCatalogQuery();

  const overview = useCharactersOverview();
  const catalog = useCharactersCatalog(listParams);
  const characters = (catalog.data?.pages ?? []).flatMap((page) => page.items);
  const summaryCards = useCharactersSummaryCards(overview.data);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("subtitle")}
          </p>
        </div>
      </header>

      {overview.isError ? null : (
        <LibrarySummaryCards
          cards={summaryCards}
          isLoading={overview.isPending}
          mobileLayout="compact"
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-0 flex-1">
            <DebouncedSearchInput
              clearLabel={t("searchClear")}
              label={t("searchLabel")}
              onClear={() => setSearch("")}
              onSearch={setSearch}
              placeholder={t("searchPlaceholder")}
              value={state.q}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CharactersCatalogFilters
              activeCount={activeAdvancedCount}
              onApply={applyAdvanced}
              state={state}
            />

            <div className="w-full sm:w-52">
              <Select onValueChange={(next) => setSort(toSort(next))} value={state.sort}>
                <SelectTrigger
                  aria-label={t("sortLabel")}
                  className="w-full data-[size=default]:h-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTERS_CATALOG_SORTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`sort.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ChipGroup
              label={t("viewLabel")}
              mode="single"
              onValueChange={(next) => setView(toView(next))}
              options={CHARACTERS_CATALOG_VIEWS.map((option) => ({
                label: t(`view.${option}`),
                value: option,
              }))}
              size="sm"
              value={state.view}
            />
          </div>
        </div>

        <ChipGroup
          label={t("quickLabel")}
          mode="single"
          onValueChange={(next) => setFilter(toQuickFilter(next))}
          options={[
            { count: overview.data?.totalCount, label: t("quick.all"), value: "all" },
            {
              count: overview.data?.favoriteCount,
              label: t("quick.favorites"),
              value: "favorites",
            },
            {
              count: overview.data?.multipleBooksCount,
              label: t("quick.multipleBooks"),
              value: "multiple_books",
            },
            {
              count: overview.data?.withPersonalImpressionCount,
              label: t("quick.withImpression"),
              value: "with_impression",
            },
          ]}
          value={state.filter}
        />
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {catalog.isError ? (
            <CharactersCatalogError onRetry={() => void catalog.refetch()} />
          ) : (
            <CharactersCatalogContent
              characters={characters}
              hasActiveFilters={hasActiveFilters}
              hasNextPage={catalog.hasNextPage}
              isFetchingNextPage={catalog.isFetchingNextPage}
              isPending={catalog.isPending}
              onClearFilters={clearAll}
              onLoadMore={() => void catalog.fetchNextPage()}
              view={state.view}
            />
          )}
        </div>

        <CharactersCatalogSidebar />
      </div>
    </div>
  );
}

function toQuickFilter(value: string): "all" | "favorites" | "multiple_books" | "with_impression" {
  if (value === "favorites" || value === "multiple_books" || value === "with_impression") {
    return value;
  }
  return "all";
}

function toSort(value: string): (typeof CHARACTERS_CATALOG_SORTS)[number] {
  return CHARACTERS_CATALOG_SORTS.find((option) => option === value) ?? "name";
}

function toView(value: string): (typeof CHARACTERS_CATALOG_VIEWS)[number] {
  return CHARACTERS_CATALOG_VIEWS.find((option) => option === value) ?? "grid";
}

function useCharactersSummaryCards(overview?: CharacterOverviewView): LibrarySummaryCard[] {
  const t = useTranslations("characters.catalog.summary");
  const locale = useLocale();

  const mostFrequent = overview?.mostFrequent ?? null;
  const leaderValue =
    mostFrequent === null
      ? t("noLeader")
      : mostFrequent.leaderCount > 1
        ? t("sharedLeaders", { count: mostFrequent.leaderCount })
        : (mostFrequent.leaders[0]?.name ?? t("noLeader"));

  return [
    {
      icon: "user",
      label: t("total"),
      value: formatNumber(overview?.totalCount ?? 0, locale),
    },
    {
      icon: "book",
      label: t("multipleBooks"),
      value: formatNumber(overview?.multipleBooksCount ?? 0, locale),
    },
    {
      caption:
        mostFrequent === null
          ? undefined
          : t("appearances", { count: mostFrequent.appearanceCount }),
      icon: "star",
      label: t("mostFrequent"),
      value: leaderValue,
      valueClassName: "text-xl",
    },
    {
      icon: "note",
      label: t("withImpression"),
      value: formatNumber(overview?.withPersonalImpressionCount ?? 0, locale),
    },
  ];
}
