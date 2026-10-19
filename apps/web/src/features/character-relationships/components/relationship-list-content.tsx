"use client";

import type { CharacterRelationshipListItemView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";
import type { EmptyStateAction } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { useRelationshipList } from "../api/use-relationship-list";
import type { RelationshipActions } from "../model/relationship-adapter";
import type { RelationshipScope } from "../model/relationship-scope";

import {
  isGlobalCharacterScope,
  toRelationshipFocusCharacterId,
} from "../model/relationship-scope";
import { RelationshipCard } from "./relationship-card";
import { RelationshipCardSkeleton } from "./relationship-card-skeleton";
import { RelationshipsErrorState } from "./relationships-error-state";

const RELATIONSHIP_LIST_GRID = {
  className: "grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start",
  skeletonCount: 4,
} as const;

type RelationshipListContentProps = {
  actions: RelationshipActions;
  items: CharacterRelationshipListItemView[];
  list: RelationshipListQuery;
  onClearCriteria: () => void;
  onCreate?: () => void;
  onOpen: (relationshipId: string) => void;
  scope: RelationshipScope;
  totalCount: number;
  view: RelationshipListView;
};

type RelationshipListQuery = ReturnType<typeof useRelationshipList>;

type RelationshipListView = "emptyScope" | "error" | "loading" | "noResults" | "results";

export function RelationshipListContent({
  actions,
  items,
  list,
  onClearCriteria,
  onCreate,
  onOpen,
  scope,
  totalCount,
  view,
}: RelationshipListContentProps) {
  const t = useTranslations("relationships.list");
  const focusCharacterId: Nullable<string> = toRelationshipFocusCharacterId(scope);
  const createAction: EmptyStateAction | undefined =
    onCreate === undefined ? undefined : { icon: "plus", label: t("empty.create") };

  function renderView() {
    switch (view) {
      case "emptyScope":
        return (
          <EmptyState
            onPrimary={onCreate}
            state={{
              desc: t(`empty.${scope.kind}.description`),
              illu: "empty-notes",
              primary: createAction,
              title: t(`empty.${scope.kind}.title`),
            }}
          />
        );
      case "error":
        return (
          <RelationshipsErrorState
            description={t("error.description")}
            onRetry={() => void list.refetch()}
            retryLabel={t("error.retry")}
            title={t("error.title")}
          />
        );
      case "loading":
        return (
          <div className={RELATIONSHIP_LIST_GRID.className}>
            {Array.from({ length: RELATIONSHIP_LIST_GRID.skeletonCount }, (_, index) => (
              <RelationshipCardSkeleton key={index} />
            ))}
          </div>
        );
      case "noResults":
        return (
          <EmptyState
            onPrimary={onClearCriteria}
            state={{
              desc: t("noResults.description"),
              illu: "empty-search",
              primary: { icon: "x", label: t("noResults.clear") },
              title: t("noResults.title"),
            }}
          />
        );
      case "results":
        return (
          <div className="flex flex-col gap-4">
            <ul className={RELATIONSHIP_LIST_GRID.className}>
              {items.map((item) => (
                <li className="flex min-w-0" key={item.relationship.id}>
                  <RelationshipCard
                    actions={actions}
                    focusCharacterId={focusCharacterId}
                    item={item}
                    onOpen={onOpen}
                    showBookSummaries={isGlobalCharacterScope(scope)}
                  />
                </li>
              ))}
            </ul>
            <InfiniteScrollFooter
              allShownLabel={t("allShown")}
              errorLabel={t("loadMoreError")}
              onLoadMore={() => void list.fetchNextPage()}
              state={toLoadMoreState(list)}
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
        {view === "loading" ? t("loading") : null}
        {view === "results" ? t("count", { count: totalCount }) : null}
      </p>
      {renderView()}
    </>
  );
}

export function toRelationshipListView({
  hasActiveCriteria,
  items,
  list,
}: {
  hasActiveCriteria: boolean;
  items: CharacterRelationshipListItemView[];
  list: RelationshipListQuery;
}): RelationshipListView {
  if (list.isLoadingError) return "error";
  if (list.isPending) return "loading";
  if (items.length > 0) return "results";
  return hasActiveCriteria ? "noResults" : "emptyScope";
}

function toLoadMoreState(list: RelationshipListQuery): InfiniteScrollState {
  if (list.isFetchingNextPage) return "loading";
  if (list.isFetchNextPageError) return "error";
  return list.hasNextPage ? "idle" : "none";
}
