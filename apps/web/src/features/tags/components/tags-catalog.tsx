"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { TagsListState, TagsNextPageState } from "../model/tags-list-state";

import { TagRow } from "./tag-row";

const CATALOG_SKELETON_ROWS = 6;

type TagsCatalogProps = {
  onAddTag: () => void;
  onClearAll: () => void;
  onClearSearch: () => void;
  onDeleteTag: (tag: TagCatalogListItem) => void;
  onEditTag: (tag: TagCatalogListItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onShowAll: () => void;
  state: TagsListState;
};

export function TagsCatalog({
  onAddTag,
  onClearAll,
  onClearSearch,
  onDeleteTag,
  onEditTag,
  onLoadMore,
  onRetry,
  onShowAll,
  state,
}: TagsCatalogProps) {
  const t = useTranslations("tags.states");

  switch (state.kind) {
    case "all-used": {
      const entry: EmptyStateEntry = {
        desc: t("allUsed.description"),
        illu: "empty-tags",
        primary: { icon: "tag", label: t("allUsed.action") },
        title: t("allUsed.title"),
      };
      return <EmptyState onPrimary={onShowAll} state={entry} />;
    }
    case "contextual-empty": {
      const entry: EmptyStateEntry = {
        desc: t("contextualEmpty.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("contextualEmpty.clearAll") },
        ...(state.hasSearch
          ? { secondary: { icon: "search", label: t("contextualEmpty.clearSearch") } }
          : {}),
        title: t("contextualEmpty.title"),
      };
      return <EmptyState onPrimary={onClearAll} onSecondary={onClearSearch} state={entry} />;
    }
    case "error": {
      const entry: EmptyStateEntry = {
        desc: t("error.description"),
        illu: "error-generic",
        primary: { icon: "refresh", label: t("error.retry") },
        title: t("error.title"),
      };
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState onPrimary={onRetry} state={entry} />
        </div>
      );
    }
    case "first-use": {
      const entry: EmptyStateEntry = {
        desc: t("firstUse.description"),
        illu: "empty-tags",
        primary: { icon: "plus", label: t("firstUse.action") },
        title: t("firstUse.title"),
      };
      return <EmptyState onPrimary={onAddTag} state={entry} />;
    }
    case "list":
      return (
        <TagsList
          onDeleteTag={onDeleteTag}
          onEditTag={onEditTag}
          onLoadMore={onLoadMore}
          state={state}
        />
      );
    case "loading":
      return <TagsListSkeleton />;
    default:
      return assertNever(state);
  }
}

function TagsList({
  onDeleteTag,
  onEditTag,
  onLoadMore,
  state,
}: {
  onDeleteTag: (tag: TagCatalogListItem) => void;
  onEditTag: (tag: TagCatalogListItem) => void;
  onLoadMore: () => void;
  state: Extract<TagsListState, { kind: "list" }>;
}) {
  const t = useTranslations("tags.catalog");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-busy={state.isRefreshing}
        className={cn(
          "flex flex-col gap-2 transition-opacity duration-200 motion-reduce:transition-none",
          state.isRefreshing && "opacity-60",
        )}
      >
        {state.items.map((tag) => (
          <li key={tag.id}>
            <TagRow onDelete={() => onDeleteTag(tag)} onEdit={() => onEditTag(tag)} tag={tag} />
          </li>
        ))}
      </ul>

      <p aria-atomic className="text-center text-sm text-muted-foreground" role="status">
        {t("counter", {
          shown: formatNumber(state.items.length, locale),
          total: formatNumber(state.total, locale),
        })}
      </p>

      <TagsLoadMore onLoadMore={onLoadMore} state={state.nextPage} />
    </div>
  );
}

function TagsListSkeleton() {
  const t = useTranslations("tags.catalog");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-2" role="status">
      {Array.from({ length: CATALOG_SKELETON_ROWS }, (_, index) => (
        <div
          className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card md:flex-row md:items-center md:gap-5"
          key={index}
        >
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function TagsLoadMore({ onLoadMore, state }: { onLoadMore: () => void; state: TagsNextPageState }) {
  const t = useTranslations("tags.catalog");

  switch (state) {
    case "error":
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">{t("loadMoreError")}</p>
          <Button onClick={onLoadMore} size="sm" variant="secondary">
            <UiIcon name="refresh" size={14} />
            {t("retry")}
          </Button>
        </div>
      );
    case "idle":
    case "loading":
      return (
        <div className="flex justify-center">
          <Button
            disabled={state === "loading"}
            loading={state === "loading"}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      );
    case "none":
      return null;
    default:
      return assertNever(state);
  }
}
