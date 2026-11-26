"use client";

import type { Nullable, ReadingGoalBookView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import type { EmptyStateAction, EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { ChipGroup } from "@/components/ui/chip-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { assertNever } from "@/lib/assert-never";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import type { GoalBooksScopeCounts } from "../model/goal-books-scope-counts";
import type { GoalCursorContent } from "../model/goal-cursor-content";
import type { GoalBooksScope } from "../model/goal-detail-query";

import { useGoalBooks } from "../api/use-goal-books";
import { resolveGoalCursorContent } from "../model/goal-cursor-content";
import { GoalBookRow, GoalBookRowSkeleton } from "./goal-book-row";

const GOAL_BOOKS_TAB = {
  list: "grid grid-cols-1 gap-2 xl:grid-cols-2",
  scopes: ["all", "counted", "remaining"],
  skeletonCount: 6,
} as const;

type GoalBooksContentProps = {
  content: GoalCursorContent<ReadingGoalBookView>;
  onLoadMore: () => void;
  onRetry: () => void;
  onShowAll: () => void;
  retryButtonRef: Ref<HTMLButtonElement>;
  scope: GoalBooksScope;
};

type GoalBooksTabProps = {
  counts: GoalBooksScopeCounts;
  goalId: string;
  listFocusRequest: Nullable<number>;
  onScopeChange: (scope: GoalBooksScope) => void;
  scope: GoalBooksScope;
};

export function GoalBooksTab({
  counts,
  goalId,
  listFocusRequest,
  onScopeChange,
  scope,
}: GoalBooksTabProps) {
  const t = useTranslations("goals.detail.books");
  const books = useGoalBooks({ goalId, scope });
  const listRegionRef = useRef<HTMLElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(listRegionRef);

  useEffect(() => {
    if (listFocusRequest !== null) listRegionRef.current?.focus();
  }, [listFocusRequest]);

  const content = resolveGoalCursorContent({
    hasNextPage: books.hasNextPage,
    isError: books.isError,
    isFetchingNextPage: books.isFetchingNextPage,
    isFetchNextPageError: books.isFetchNextPageError,
    isPending: books.isPending,
    items: books.data?.pages.flatMap((page) => page.items) ?? [],
  });

  function loadNextPage() {
    if (!books.hasNextPage || books.isFetchingNextPage) return;
    void books.fetchNextPage();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 -my-1 no-scrollbar min-w-0 overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("scopeLabel")}
          mode="single"
          onValueChange={(next) => {
            const nextScope = GOAL_BOOKS_TAB.scopes.find((option) => option === next);
            if (nextScope !== undefined) onScopeChange(nextScope);
          }}
          options={GOAL_BOOKS_TAB.scopes.map((option) => ({
            count: counts[option],
            label: t(`scope.${option}`),
            value: option,
          }))}
          size="sm"
          value={scope}
        />
      </div>

      <GoalBooksSnapshotNote />

      <section
        aria-label={t("listLabel")}
        className={cn("flex min-w-0 flex-col gap-4", RETRY_FOCUS_RING.onTarget)}
        ref={listRegionRef}
        tabIndex={-1}
      >
        <GoalBooksContent
          content={content}
          onLoadMore={loadNextPage}
          onRetry={withRetryFocus(() => void books.refetch())}
          onShowAll={() => onScopeChange("all")}
          retryButtonRef={retryButtonRef}
          scope={scope}
        />
      </section>
    </div>
  );
}

function GoalBooksContent({
  content,
  onLoadMore,
  onRetry,
  onShowAll,
  retryButtonRef,
  scope,
}: GoalBooksContentProps) {
  const t = useTranslations("goals.detail");

  switch (content.kind) {
    case "empty":
      return <GoalBooksEmpty onShowAll={onShowAll} scope={scope} />;
    case "error": {
      const errorState: EmptyStateEntry = {
        desc: t("books.error.description"),
        illu: "error-generic",
        illuSize: "sm",
        primary: { icon: "refresh", label: t("books.error.retry") },
        title: t("books.error.title"),
      };
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState onPrimary={onRetry} primaryRef={retryButtonRef} state={errorState} />
        </div>
      );
    }
    case "items":
      return (
        <>
          <ul className={GOAL_BOOKS_TAB.list}>
            {content.items.map((book) => (
              <GoalBookRow book={book} key={book.id} />
            ))}
          </ul>
          <InfiniteScrollFooter
            errorLabel={t("books.loadMoreError")}
            onLoadMore={onLoadMore}
            state={content.footer}
          />
        </>
      );
    case "loading":
      return (
        <ul aria-busy className={GOAL_BOOKS_TAB.list}>
          {Array.from({ length: GOAL_BOOKS_TAB.skeletonCount }, (_, index) => (
            <GoalBookRowSkeleton key={index} />
          ))}
        </ul>
      );
    default:
      return assertNever(content);
  }
}

function GoalBooksEmpty({ onShowAll, scope }: Pick<GoalBooksContentProps, "onShowAll" | "scope">) {
  const t = useTranslations("goals.detail");
  const showAll: EmptyStateAction = { icon: "list", label: t("books.empty.showAll") };

  function emptyState(): EmptyStateEntry {
    switch (scope) {
      case "all":
        return {
          desc: t("books.empty.all.description"),
          illu: "empty-lists",
          illuSize: "sm",
          title: t("books.empty.all.title"),
        };
      case "counted":
        return {
          desc: t("countedEmptyHint"),
          illu: "reading-goals/goal-no-counted-books-yet",
          illuSize: "sm",
          primary: showAll,
          title: t("countedEmpty"),
        };
      case "remaining":
        return {
          desc: t("books.empty.remaining.description"),
          illu: "empty-all-books",
          illuSize: "sm",
          primary: showAll,
          title: t("books.empty.remaining.title"),
        };
      default:
        return assertNever(scope);
    }
  }

  return <EmptyState onPrimary={onShowAll} state={emptyState()} />;
}

function GoalBooksSnapshotNote() {
  const t = useTranslations("goals.detail.books");

  return (
    <Collapsible className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <UiIcon aria-hidden className="shrink-0 text-icon" name="info" size={14} />
        <span>{t("snapshotSummary")}</span>
        <CollapsibleTrigger className="group inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("snapshotMore")}
          <UiIcon
            aria-hidden
            className="group-data-[state=open]:rotate-180 motion-safe:transition-transform"
            name="chevron-down"
            size={14}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <p className="pl-5.5">{t("snapshotHint")}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
