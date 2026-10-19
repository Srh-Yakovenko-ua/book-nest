"use client";

import type { Nullable, ReadingGoalActivityType, ReadingGoalActivityView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDate, formatTime } from "@/lib/format";

import type { GoalActivityDetail } from "../model/goal-activity-detail";

import { toGoalActivityDetail } from "../model/goal-activity-detail";

const GOAL_ACTIVITY_ROW = {
  icon: {
    book_counted: "check-circle",
    book_uncounted: "x-circle",
    deadline_changed: "calendar",
    goal_archived: "inbox",
    goal_completed: "trophy",
    goal_created: "target",
    goal_expired: "calendar-x",
    goal_renamed: "edit",
    target_changed: "hash",
  } satisfies Record<ReadingGoalActivityType, UiIconName>,
  iconBadge: "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-icon",
  iconSize: 16,
} as const;

type GoalActivityRowProps = {
  item: ReadingGoalActivityView;
};

export function GoalActivityRow({ item }: GoalActivityRowProps) {
  const tType = useTranslations("goals.activityType");
  const locale = useLocale();
  const detail = toGoalActivityDetail(item);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={GOAL_ACTIVITY_ROW.iconBadge}>
        <UiIcon
          aria-hidden
          name={GOAL_ACTIVITY_ROW.icon[item.type]}
          size={GOAL_ACTIVITY_ROW.iconSize}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium text-ink">{tType(item.type)}</p>
          {item.book === null ? null : (
            <Link
              className="w-fit max-w-full rounded-sm text-sm break-words text-muted-foreground no-underline outline-none hover:text-primary hover:underline focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={`/books/${item.book.id}`}
            >
              {item.book.title}
            </Link>
          )}
          {detail === null ? null : <GoalActivityDetailText detail={detail} />}
        </div>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>
          {`${formatDate(item.createdAt, locale)} · ${formatTime(item.createdAt, locale)}`}
        </time>
      </div>
    </li>
  );
}

export function GoalActivityRowSkeleton() {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/3 rounded-md" />
        <Skeleton className="h-3 w-2/3 rounded-md" />
      </div>
    </li>
  );
}

function GoalActivityDetailText({ detail }: { detail: GoalActivityDetail }) {
  const t = useTranslations("goals.detail.activity.detail");
  const tResult = useTranslations("goals.result");
  const locale = useLocale();

  function describe(): Nullable<string> {
    switch (detail.type) {
      case "book_counted":
        return t("bookCounted", {
          completed: detail.metadata.completedCount,
          date: formatDate(detail.metadata.finishedAt, locale),
          target: detail.metadata.targetCount,
        });
      case "book_uncounted":
        return t(`bookUncounted.${detail.metadata.reason}`, {
          date: formatDate(detail.metadata.previousFinishedAt, locale),
        });
      case "deadline_changed":
        return t("deadlineChanged", {
          from: formatDate(detail.metadata.from, locale),
          to: formatDate(detail.metadata.to, locale),
        });
      case "goal_archived":
        return tResult(detail.metadata.result ?? "none");
      case "goal_completed": {
        if (detail.metadata.completedAt === null) return null;
        const date = formatDate(detail.metadata.completedAt, locale);
        const days = detail.metadata.daysBeforeDeadline;
        return days === null
          ? t("goalCompleted", { date })
          : t("goalCompletedEarly", { date, days });
      }
      case "goal_created":
        return t("goalCreated", {
          deadline: formatDate(detail.metadata.deadline, locale),
          snapshot: detail.metadata.snapshotBookCount,
          target: detail.metadata.targetCount,
        });
      case "goal_expired":
        return t("goalExpired", {
          completed: detail.metadata.completedCount,
          deadline: formatDate(detail.metadata.deadline, locale),
          target: detail.metadata.targetCount,
        });
      case "goal_renamed": {
        const { from, to } = detail.metadata;
        if (from !== null && to !== null) return t("nameChanged", { from, to });
        if (to !== null) return t("nameAdded", { to });
        if (from !== null) return t("nameRemoved", { from });
        return null;
      }
      case "target_changed":
        return t("targetChanged", { from: detail.metadata.from, to: detail.metadata.to });
      default:
        return assertNever(detail);
    }
  }

  const sentence = describe();
  if (sentence === null) return null;

  return <p className="text-xs leading-relaxed break-words text-muted-foreground">{sentence}</p>;
}
