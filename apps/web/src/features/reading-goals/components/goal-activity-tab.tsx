"use client";

import type { Nullable, ReadingGoalActivityView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertNever } from "@/lib/assert-never";

import type { GoalCursorContent } from "../model/goal-cursor-content";
import type { GoalActivityType } from "../model/goal-detail-query";

import { useGoalActivity } from "../api/use-goal-activity";
import { resolveGoalCursorContent } from "../model/goal-cursor-content";
import { GOAL_DETAIL_QUERY } from "../model/goal-detail-query";
import { GoalActivityRow, GoalActivityRowSkeleton } from "./goal-activity-row";

const GOAL_ACTIVITY_TAB = {
  allTypes: "all",
  list: "flex flex-col divide-y divide-border rounded-xl border border-border bg-card",
  skeletonCount: 6,
} as const;

type GoalActivityContentProps = {
  content: GoalCursorContent<ReadingGoalActivityView>;
  isFiltered: boolean;
  onLoadMore: () => void;
  onResetType: () => void;
  onRetry: () => void;
};

type GoalActivityTabProps = {
  activityType: Nullable<GoalActivityType>;
  goalId: string;
  onActivityTypeChange: (activityType: Nullable<GoalActivityType>) => void;
};

export function GoalActivityTab({
  activityType,
  goalId,
  onActivityTypeChange,
}: GoalActivityTabProps) {
  const t = useTranslations("goals.detail.activity");
  const tType = useTranslations("goals.activityType");
  const tCommon = useTranslations("common");
  const activity = useGoalActivity({ activityType, goalId });

  const content = resolveGoalCursorContent({
    hasNextPage: activity.hasNextPage,
    isError: activity.isError,
    isFetchingNextPage: activity.isFetchingNextPage,
    isFetchNextPageError: activity.isFetchNextPageError,
    isPending: activity.isPending,
    items: activity.data?.pages.flatMap((page) => page.items) ?? [],
  });

  function loadNextPage() {
    if (!activity.hasNextPage || activity.isFetchingNextPage) return;
    void activity.fetchNextPage();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full sm:w-72">
        <Select
          onValueChange={(next) =>
            onActivityTypeChange(
              GOAL_DETAIL_QUERY.activityTypeOptions.find((type) => type === next) ?? null,
            )
          }
          value={activityType ?? GOAL_ACTIVITY_TAB.allTypes}
        >
          <SelectTrigger
            aria-label={t("filterLabel")}
            className="h-10 w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={activityType !== null}
            onClear={() => onActivityTypeChange(null)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GOAL_ACTIVITY_TAB.allTypes}>{t("allTypes")}</SelectItem>
            {GOAL_DETAIL_QUERY.activityTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {tType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section aria-label={t("listLabel")} className="flex min-w-0 flex-col gap-4">
        <GoalActivityContent
          content={content}
          isFiltered={activityType !== null}
          onLoadMore={loadNextPage}
          onResetType={() => onActivityTypeChange(null)}
          onRetry={() => void activity.refetch()}
        />
      </section>
    </div>
  );
}

function GoalActivityContent({
  content,
  isFiltered,
  onLoadMore,
  onResetType,
  onRetry,
}: GoalActivityContentProps) {
  const t = useTranslations("goals.detail.activity");

  switch (content.kind) {
    case "empty": {
      if (isFiltered) {
        const filteredState: EmptyStateEntry = {
          desc: t("filteredEmpty.description"),
          illu: "empty-search",
          illuSize: "sm",
          primary: { icon: "x", label: t("filteredEmpty.showAll") },
          title: t("filteredEmpty.title"),
        };
        return <EmptyState onPrimary={onResetType} state={filteredState} />;
      }
      const emptyState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-notes",
        illuSize: "sm",
        title: t("empty.title"),
      };
      return <EmptyState state={emptyState} />;
    }
    case "error": {
      const errorState: EmptyStateEntry = {
        desc: t("error.description"),
        illu: "error-generic",
        illuSize: "sm",
        primary: { icon: "refresh", label: t("error.retry") },
        title: t("error.title"),
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
          <ul className={GOAL_ACTIVITY_TAB.list}>
            {content.items.map((item) => (
              <GoalActivityRow item={item} key={item.id} />
            ))}
          </ul>
          <InfiniteScrollFooter
            errorLabel={t("loadMoreError")}
            onLoadMore={onLoadMore}
            state={content.footer}
          />
        </>
      );
    case "loading":
      return (
        <ul aria-busy className={GOAL_ACTIVITY_TAB.list}>
          {Array.from({ length: GOAL_ACTIVITY_TAB.skeletonCount }, (_, index) => (
            <GoalActivityRowSkeleton key={index} />
          ))}
        </ul>
      );
    default:
      return assertNever(content);
  }
}
