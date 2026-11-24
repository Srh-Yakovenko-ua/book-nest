"use client";

import type { Nullable, ReadingGoalActivityType, ReadingGoalActivityView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { useProfileTimeZone } from "@/features/settings";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDate, formatTimeInZone } from "@/lib/format";
import { instantToIsoDay } from "@/lib/iso-day";
import { cn } from "@/lib/utils";

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
  iconBadge: "grid size-8 shrink-0 place-items-center rounded-full bg-accent text-icon",
  iconSize: 16,
} as const;

type GoalActivityIconProps = {
  className?: string;
  type: ReadingGoalActivityType;
};

type GoalActivityRowProps = {
  item: ReadingGoalActivityView;
};

export function GoalActivityIcon({ className, type }: GoalActivityIconProps) {
  return (
    <span className={cn(GOAL_ACTIVITY_ROW.iconBadge, className)}>
      <UiIcon aria-hidden name={GOAL_ACTIVITY_ROW.icon[type]} size={GOAL_ACTIVITY_ROW.iconSize} />
    </span>
  );
}

export function GoalActivityRow({ item }: GoalActivityRowProps) {
  const locale = useLocale();
  const timeZone = useProfileTimeZone();
  const day = formatDate(instantToIsoDay({ instant: item.createdAt, timeZone }), locale);
  const time = formatTimeInZone({ instant: item.createdAt, locale, timeZone });

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <GoalActivityIcon className="mt-0.5" type={item.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <GoalActivitySummary item={item} />
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>
          {`${day} · ${time}`}
        </time>
      </div>
    </li>
  );
}

export function GoalActivitySummary({ item }: GoalActivityRowProps) {
  const tType = useTranslations("goals.activityType");
  const detail = toGoalActivityDetail(item);

  return (
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
