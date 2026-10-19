"use client";

import type { ReadingGoalBookView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateAction, EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { ChipGroup } from "@/components/ui/chip-group";
import { assertNever } from "@/lib/assert-never";

import type { GoalCursorContent } from "../model/goal-cursor-content";
import type { GoalBooksScope } from "../model/goal-detail-query";

import { useGoalBooks } from "../api/use-goal-books";
import { resolveGoalCursorContent } from "../model/goal-cursor-content";
import { GoalBookRow, GoalBookRowSkeleton } from "./goal-book-row";

const GOAL_BOOKS_TAB = {
  list: "flex flex-col gap-2",
  scopes: ["all", "counted", "remaining"],
  skeletonCount: 6,
} as const;

type GoalBooksContentProps = {
  content: GoalCursorContent<ReadingGoalBookView>;
  onLoadMore: () => void;
  onRetry: () => void;
  onShowAll: () => void;
  scope: GoalBooksScope;
};

type GoalBooksTabProps = {
  goalId: string;
  onScopeChange: (scope: GoalBooksScope) => void;
  scope: GoalBooksScope;
};

export function GoalBooksTab({ goalId, onScopeChange, scope }: GoalBooksTabProps) {
  const t = useTranslations("goals.detail.books");
  const books = useGoalBooks({ goalId, scope });

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
            label: t(`scope.${option}`),
            value: option,
          }))}
          size="sm"
          value={scope}
        />
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="info" size={14} />
        {t("snapshotHint")}
      </p>

      <section aria-label={t("listLabel")} className="flex min-w-0 flex-col gap-4">
        <GoalBooksContent
          content={content}
          onLoadMore={loadNextPage}
          onRetry={() => void books.refetch()}
          onShowAll={() => onScopeChange("all")}
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
          <EmptyState onPrimary={onRetry} state={errorState} />
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
          illu: "empty-queue",
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
