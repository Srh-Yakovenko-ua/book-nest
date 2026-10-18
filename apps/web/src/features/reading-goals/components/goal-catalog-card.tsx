"use client";

import type { ReadingGoalListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { formatDate, formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

import { GOAL_SIGNAL_TONE, GOAL_STATUS_BADGE } from "../model/goal-status";

type GoalCatalogItemProps = {
  goal: ReadingGoalListItem;
};

const GOAL_CARD = {
  surface:
    "relative flex min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
} as const satisfies { surface: string };

export function GoalCatalogCard({ goal }: GoalCatalogItemProps) {
  return (
    <article
      className={cn("group/goal-card h-full flex-col gap-3.5 p-4", GOAL_CARD.surface)}
      data-slot="goal-card"
    >
      <GoalBadges goal={goal} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <GoalTitle
          className="line-clamp-2 text-[1.0625rem]"
          goal={goal}
          linkClassName="group-hover/goal-card:text-primary"
        />
        <GoalSourceList list={goal.list} />
      </div>
      <GoalProgress goal={goal} />
      <GoalSignals goal={goal} />
      <GoalTimeline className="mt-auto" goal={goal} />
    </article>
  );
}

export function GoalCatalogRow({ goal }: GoalCatalogItemProps) {
  return (
    <article
      className={cn(
        "group/goal-row flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:gap-5",
        GOAL_CARD.surface,
      )}
      data-slot="goal-row"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <GoalBadges goal={goal} />
        <GoalTitle
          className="line-clamp-2 text-sm"
          goal={goal}
          linkClassName="group-hover/goal-row:text-primary"
        />
        <GoalSourceList list={goal.list} />
      </div>
      <div className="flex min-w-0 flex-col gap-2 md:w-60 md:shrink-0">
        <GoalProgress goal={goal} />
        <GoalSignals goal={goal} />
      </div>
      <GoalTimeline className="md:w-44 md:shrink-0 md:flex-col md:items-start" goal={goal} />
    </article>
  );
}

function GoalBadges({ goal }: GoalCatalogItemProps) {
  const tStatus = useTranslations("goals.status");
  const tResult = useTranslations("goals.result");
  const badge = GOAL_STATUS_BADGE[goal.status];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className="h-6 gap-1.5 px-2.5" variant={badge.tone}>
        <UiIcon aria-hidden name={badge.icon} size={12} />
        {tStatus(goal.status)}
      </Badge>
      {goal.status === "archived" ? (
        <Badge className="h-6 px-2.5" variant="outline">
          {tResult(goal.result ?? "none")}
        </Badge>
      ) : null}
    </div>
  );
}

function GoalProgress({ goal }: GoalCatalogItemProps) {
  const t = useTranslations("goals.catalog.card");
  const percent = Math.round(goal.progressPercent);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Progress
          aria-label={t("progressLabel", { percent })}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-2 flex-1"
          value={percent}
        />
        <span className="shrink-0 text-xs font-semibold text-primary tabular-nums">{percent}%</span>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("progress", { completed: goal.completedCount, target: goal.targetCount })}
      </p>
    </div>
  );
}

function GoalSignals({ goal }: GoalCatalogItemProps) {
  const tPace = useTranslations("goals.pace");
  const tRisk = useTranslations("goals.risk");
  const { pace, riskLevel } = goal;

  if (pace === null && riskLevel === "none") return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pace === null ? null : (
        <Badge className="h-6 px-2.5" variant={GOAL_SIGNAL_TONE.pace[pace]}>
          {tPace(pace)}
        </Badge>
      )}
      {riskLevel === "none" ? null : (
        <Badge className="h-6 px-2.5" variant={GOAL_SIGNAL_TONE.risk[riskLevel]}>
          {tRisk(riskLevel)}
        </Badge>
      )}
    </div>
  );
}

function GoalSourceList({ list }: { list: ReadingGoalListItem["list"] }) {
  const t = useTranslations("goals.catalog.card");

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
      <UiIcon aria-hidden className="shrink-0 text-icon" name="list" size={14} />
      {list === null ? (
        <span className="italic">{t("listDeleted")}</span>
      ) : (
        <>
          <span className="sr-only">{t("sourceList")}</span>
          <Link
            className="relative z-10 flex min-w-0 rounded-sm text-muted-foreground no-underline outline-none hover:text-primary hover:underline focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/lists/${list.id}`}
          >
            <TruncatedText text={list.name} />
          </Link>
        </>
      )}
    </p>
  );
}

function GoalTimeline({ className, goal }: GoalCatalogItemProps & { className?: string }) {
  const t = useTranslations("goals.catalog.card");
  const locale = useLocale();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={15} />
        {t("deadline", { date: formatDate(goal.deadline, locale) })}
      </span>
      <GoalTimelineNote goal={goal} />
    </div>
  );
}

function GoalTimelineNote({ goal }: GoalCatalogItemProps) {
  const t = useTranslations("goals.catalog.card");
  const locale = useLocale();

  if (goal.completedAt !== null) {
    return <span>{t("completedOn", { date: formatDate(goal.completedAt, locale) })}</span>;
  }
  if (goal.daysLeft === null || goal.daysLeft < 0) return null;
  return <span className="tabular-nums">{t("daysLeft", { count: goal.daysLeft })}</span>;
}

function GoalTitle({
  className,
  goal,
  linkClassName,
}: GoalCatalogItemProps & { className: string; linkClassName: string }) {
  const tGoals = useTranslations("goals");
  const locale = useLocale();

  return (
    <h3 className={cn("font-heading leading-tight font-bold break-words text-ink", className)}>
      <Link
        className={cn(
          "text-ink no-underline transition-colors outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:text-primary",
          linkClassName,
        )}
        href={`/goals/${goal.id}`}
      >
        {goal.name ??
          tGoals("fallbackName", {
            count: goal.targetCount,
            date: formatDateLong(goal.deadline, locale),
          })}
      </Link>
    </h3>
  );
}
