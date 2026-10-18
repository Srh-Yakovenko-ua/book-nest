"use client";

import type { ReactNode, RefObject } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { GoalsCatalogContent } from "../model/goals-catalog-content";
import type { GoalsViewMode } from "../model/goals-query";

import { GoalCatalogCard, GoalCatalogRow } from "./goal-catalog-card";

const GOALS_LAYOUT = {
  grid: "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3",
  list: "flex flex-col gap-3",
  skeletonCount: 6,
} as const;

type GoalsCatalogViewProps = {
  content: GoalsCatalogContent;
  createButtonRef: RefObject<HTMLButtonElement | null>;
  onClearStatus: () => void;
  onCreate: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  overview: ReactNode;
  toolbar: ReactNode;
  view: GoalsViewMode;
};

export function GoalsCatalogView({
  content,
  createButtonRef,
  onClearStatus,
  onCreate,
  onLoadMore,
  onRetry,
  overview,
  toolbar,
  view,
}: GoalsCatalogViewProps) {
  const t = useTranslations("goals.catalog");
  const hasNoGoals = content.kind === "empty";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={onCreate} ref={createButtonRef}>
          <UiIcon name="plus" size={16} />
          {t("create")}
        </Button>
      </header>

      {hasNoGoals ? null : overview}

      {hasNoGoals || content.kind === "error" ? null : toolbar}

      <section className="flex min-w-0 flex-col gap-6">
        <h2 className="sr-only">{t("listHeading")}</h2>
        <GoalsContent
          content={content}
          onClearStatus={onClearStatus}
          onCreate={onCreate}
          onLoadMore={onLoadMore}
          onRetry={onRetry}
          view={view}
        />
      </section>
    </div>
  );
}

function GoalCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card">
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-5 w-4/5 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
    </div>
  );
}

function GoalsContent({
  content,
  onClearStatus,
  onCreate,
  onLoadMore,
  onRetry,
  view,
}: Omit<GoalsCatalogViewProps, "createButtonRef" | "overview" | "toolbar">) {
  const t = useTranslations("goals.catalog");

  switch (content.kind) {
    case "empty": {
      const emptyState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-lists",
        primary: { icon: "plus", label: t("empty.create") },
        title: t("empty.title"),
      };
      return <EmptyState onPrimary={onCreate} state={emptyState} />;
    }
    case "error": {
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
    case "filtered-empty": {
      const filteredState: EmptyStateEntry = {
        desc: t("filteredEmpty.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("filteredEmpty.showAll") },
        title: t("filteredEmpty.title"),
      };
      return <EmptyState onPrimary={onClearStatus} state={filteredState} />;
    }
    case "goals":
      return (
        <>
          <div className={GOALS_LAYOUT[view]}>
            {content.goals.map((goal) =>
              view === "list" ? (
                <GoalCatalogRow goal={goal} key={goal.id} />
              ) : (
                <GoalCatalogCard goal={goal} key={goal.id} />
              ),
            )}
          </div>
          <InfiniteScrollFooter
            errorLabel={t("loadMoreError")}
            onLoadMore={onLoadMore}
            state={content.footer}
          />
        </>
      );
    case "loading":
      return (
        <div aria-busy className={GOALS_LAYOUT[view]}>
          {Array.from({ length: GOALS_LAYOUT.skeletonCount }, (_, index) => (
            <GoalCardSkeleton key={index} />
          ))}
        </div>
      );
    default:
      return assertNever(content);
  }
}
