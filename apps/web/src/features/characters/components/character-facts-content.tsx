"use client";

import type { CharacterFactView, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useTranslations } from "next-intl";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { useCharacterFactsInfinite } from "../api/use-character-facts-infinite";

import { CharacterFactCard } from "./character-fact-card";
import { CharacterFactCardSkeleton } from "./character-fact-card-skeleton";
import { CharactersErrorState } from "./characters-error-state";

const FACTS_GRID = {
  className: "grid grid-cols-1 gap-4 md:grid-cols-2",
  skeletonCount: 4,
} as const;

type CharacterFactsContentProps = {
  addButtonRef: RefObject<Nullable<HTMLButtonElement>>;
  facts: CharacterFactsQuery;
  hasSearch: boolean;
  items: CharacterFactView[];
  onAdd: () => void;
  onClearSearch: () => void;
  onDelete: FactAction;
  onEdit: FactAction;
  totalCount: number;
};

type CharacterFactsQuery = ReturnType<typeof useCharacterFactsInfinite>;

type FactAction = (fact: CharacterFactView, trigger: Nullable<HTMLElement>) => void;

type FactsView = "emptyBook" | "emptySearch" | "error" | "loading" | "results";

export function CharacterFactsContent({
  addButtonRef,
  facts,
  hasSearch,
  items,
  onAdd,
  onClearSearch,
  onDelete,
  onEdit,
  totalCount,
}: CharacterFactsContentProps) {
  const t = useTranslations("characters.facts");
  const view = toFactsView({ facts, hasSearch, items });

  function statusText(): string {
    switch (view) {
      case "emptyBook":
      case "error":
      case "loading":
        return "";
      case "emptySearch":
        return t("emptySearch.title");
      case "results":
        return t("count", { count: totalCount });
      default:
        return assertNever(view);
    }
  }

  function renderView() {
    switch (view) {
      case "emptyBook":
        return (
          <EmptyState
            onPrimary={onAdd}
            primaryRef={addButtonRef}
            state={{
              desc: t("empty.description"),
              illu: "empty-notes",
              primary: { icon: "plus", label: t("add") },
              title: t("empty.title"),
            }}
          />
        );
      case "emptySearch":
        return (
          <EmptyState
            onPrimary={onClearSearch}
            state={{
              desc: t("emptySearch.description"),
              illu: "empty-search",
              primary: { icon: "x", label: t("emptySearch.clear") },
              title: t("emptySearch.title"),
            }}
          />
        );
      case "error":
        return (
          <CharactersErrorState description={t("error")} onRetry={() => void facts.refetch()} />
        );
      case "loading":
        return (
          <div className={FACTS_GRID.className}>
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: FACTS_GRID.skeletonCount }, (_, index) => (
              <CharacterFactCardSkeleton key={index} />
            ))}
          </div>
        );
      case "results":
        return (
          <div className="flex flex-col gap-4">
            <ul className={FACTS_GRID.className}>
              {items.map((fact) => (
                <li className="flex" key={fact.id}>
                  <CharacterFactCard fact={fact} onDelete={onDelete} onEdit={onEdit} />
                </li>
              ))}
            </ul>
            <InfiniteScrollFooter
              allShownLabel={t("allShown")}
              errorLabel={t("loadMoreError")}
              onLoadMore={() => void facts.fetchNextPage()}
              state={toLoadMoreState(facts)}
            />
          </div>
        );
      default:
        return assertNever(view);
    }
  }

  return (
    <>
      <p
        aria-busy={view === "loading"}
        aria-live="polite"
        className={cn("text-sm text-muted-foreground", view !== "results" && "sr-only")}
        role="status"
      >
        {statusText()}
      </p>
      {renderView()}
    </>
  );
}

function toFactsView({
  facts,
  hasSearch,
  items,
}: {
  facts: CharacterFactsQuery;
  hasSearch: boolean;
  items: CharacterFactView[];
}): FactsView {
  if (facts.isLoadingError) return "error";
  if (facts.isPending) return "loading";
  if (items.length > 0) return "results";
  return hasSearch ? "emptySearch" : "emptyBook";
}

function toLoadMoreState(facts: CharacterFactsQuery): InfiniteScrollState {
  if (facts.isFetchNextPageError) return "error";
  if (facts.isFetchingNextPage) return "loading";
  return facts.hasNextPage ? "idle" : "none";
}
