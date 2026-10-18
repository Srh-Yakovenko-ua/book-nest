"use client";

import type { CharacterSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import {
  CharacterCardSkeleton,
  CharactersErrorState,
  CharacterSummaryCard,
} from "@/features/characters";

import { useSeriesCharactersInfinite } from "../api/use-series-characters-infinite";
import { SERIES_CHARACTERS_QUERY, toSeriesCastParams } from "../model/series-characters-query";

const CAST_GRID = {
  className: "grid grid-cols-1 gap-4 @2xl/cast:grid-cols-2",
  skeletonCount: 6,
} as const;

type SeriesCastListProps = {
  contextBookId: string;
  seriesId: string;
};

type SeriesCastQuery = ReturnType<typeof useSeriesCharactersInfinite>;

export function SeriesCastList({ contextBookId, seriesId }: SeriesCastListProps) {
  const t = useTranslations("series.details.characters.cast");
  const [search, setSearch] = useQueryState(
    SERIES_CHARACTERS_QUERY.search.urlKey,
    SERIES_CHARACTERS_QUERY.search.parser,
  );
  const cast = useSeriesCharactersInfinite({
    params: toSeriesCastParams({ contextBookId, search }),
    seriesId,
  });

  const items = (cast.data?.pages ?? []).flatMap((page) => page.items);
  const hasSearch = search.trim().length > 0;
  const isEmptyCast = cast.isSuccess && items.length === 0 && !hasSearch;

  return (
    <div className="@container/cast flex flex-col gap-5">
      {isEmptyCast ? null : (
        <DebouncedSearchInput
          clearLabel={t("searchClear")}
          label={t("searchLabel")}
          onClear={() => void setSearch(null)}
          onSearch={(value) => void setSearch(value)}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
      )}
      <SeriesCastContent
        cast={cast}
        hasSearch={hasSearch}
        items={items}
        onClearSearch={() => void setSearch(null)}
      />
    </div>
  );
}

function SeriesCastContent({
  cast,
  hasSearch,
  items,
  onClearSearch,
}: {
  cast: SeriesCastQuery;
  hasSearch: boolean;
  items: CharacterSummaryView[];
  onClearSearch: () => void;
}) {
  const t = useTranslations("series.details.characters.cast");
  const tStates = useTranslations("characters.states");

  if (cast.isError && cast.data === undefined) {
    return <CharactersErrorState onRetry={() => void cast.refetch()} />;
  }

  if (cast.isPending) {
    return (
      <div aria-busy className={CAST_GRID.className} role="status">
        <span className="sr-only">{tStates("loading")}</span>
        {Array.from({ length: CAST_GRID.skeletonCount }, (_, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0 && !hasSearch) {
    const empty: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-authors",
      title: t("empty.title"),
    };
    return <EmptyState state={empty} />;
  }

  if (items.length === 0) {
    const noResults: EmptyStateEntry = {
      desc: t("noResults.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("noResults.clear") },
      title: t("noResults.title"),
    };
    return <EmptyState onPrimary={onClearSearch} state={noResults} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className={CAST_GRID.className}>
        {items.map((character) => (
          <li className="flex" key={character.characterId}>
            <CharacterSummaryCard character={character} />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        errorLabel={tStates("loadMoreError")}
        onLoadMore={() => void cast.fetchNextPage()}
        state={toLoadMoreState(cast)}
      />
    </div>
  );
}

function toLoadMoreState(cast: SeriesCastQuery): InfiniteScrollState {
  if (cast.isFetchingNextPage) return "loading";
  if (cast.isFetchNextPageError) return "error";
  return cast.hasNextPage ? "idle" : "none";
}
