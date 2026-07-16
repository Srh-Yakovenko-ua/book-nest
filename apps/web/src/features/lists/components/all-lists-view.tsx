"use client";

import type { CustomListCard } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ListCard } from "./list-card";

const SKELETON_COUNT = 6;

type AllListsViewProps = {
  hasActiveSearch: boolean;
  hasAnyLists: boolean;
  isError: boolean;
  isPending: boolean;
  lists: CustomListCard[];
  onClearSearch: () => void;
  onCreateList: () => void;
  onDeleteList: (list: CustomListCard) => void;
  onEditList: (list: CustomListCard) => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
  sidebar: ReactNode;
  toolbar: ReactNode;
};

export function AllListsView({
  hasActiveSearch,
  hasAnyLists,
  isError,
  isPending,
  lists,
  onClearSearch,
  onCreateList,
  onDeleteList,
  onEditList,
  onOpenLibrary,
  onRetry,
  sidebar,
  toolbar,
}: AllListsViewProps) {
  const t = useTranslations("lists.catalog");
  const showToolbar = !isError && (isPending || hasAnyLists);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={onCreateList}>
          <UiIcon name="plus" size={16} />
          {t("create")}
        </Button>
      </header>

      {showToolbar ? toolbar : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="sr-only">{t("title")}</h2>
          <ListsContent
            hasActiveSearch={hasActiveSearch}
            hasAnyLists={hasAnyLists}
            isError={isError}
            isPending={isPending}
            lists={lists}
            onClearSearch={onClearSearch}
            onCreateList={onCreateList}
            onDeleteList={onDeleteList}
            onEditList={onEditList}
            onOpenLibrary={onOpenLibrary}
            onRetry={onRetry}
          />
        </div>
        {showToolbar ? sidebar : null}
      </div>
    </div>
  );
}

function ListCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card">
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-3.5 w-full" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="aspect-[3/4] w-full rounded-md" key={index} />
        ))}
      </div>
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  );
}

function ListsContent({
  hasActiveSearch,
  hasAnyLists,
  isError,
  isPending,
  lists,
  onClearSearch,
  onCreateList,
  onDeleteList,
  onEditList,
  onOpenLibrary,
  onRetry,
}: {
  hasActiveSearch: boolean;
  hasAnyLists: boolean;
  isError: boolean;
  isPending: boolean;
  lists: CustomListCard[];
  onClearSearch: () => void;
  onCreateList: () => void;
  onDeleteList: (list: CustomListCard) => void;
  onEditList: (list: CustomListCard) => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("lists.catalog");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return <ListsGridSkeleton />;
  }

  if (lists.length === 0) {
    if (!hasAnyLists) {
      const emptyState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-lists",
        primary: { icon: "plus", label: t("empty.create") },
        secondary: { icon: "book", label: t("empty.secondary") },
        title: t("empty.title"),
      };
      return <EmptyState onPrimary={onCreateList} onSecondary={onOpenLibrary} state={emptyState} />;
    }
    if (hasActiveSearch) {
      const noResultsState: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearSearch} state={noResultsState} />;
    }
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {lists.map((list) => (
        <ListCard
          key={list.id}
          list={list}
          onDelete={() => onDeleteList(list)}
          onEdit={() => onEditList(list)}
        />
      ))}
    </div>
  );
}

function ListsGridSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <ListCardSkeleton key={index} />
      ))}
    </div>
  );
}
