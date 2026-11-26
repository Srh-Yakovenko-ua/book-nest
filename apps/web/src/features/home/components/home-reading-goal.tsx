"use client";

import type { HomeGoalRecentCompletion, HomeGoalSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_SIGNAL_TONE, goalDisplayPercent, useGoalTitle } from "@/features/reading-goals";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDateShort } from "@/lib/format";

import type { HomeReadingWidget } from "../model/home-reading";

import { HOME_CONTEXT_LINKS, homeGoalHref } from "../model/home-context-links";
import { HomeCard } from "./home-card";
import { HomeGoalCreateFlow } from "./home-goal-create-flow";
import { HomeHeaderLink } from "./home-header-link";
import { HomeSectionError } from "./home-section-error";
import { HomeStaleNotice } from "./home-stale-notice";

type HomeReadingGoalProps = {
  isRetrying: boolean;
  onRetry: () => void;
  widget: HomeReadingWidget<HomeGoalSection>;
};

type PrimaryGoal = NonNullable<HomeGoalSection["primaryGoal"]>;

const GOAL_EMPTY_ILLUSTRATION = {
  height: 174,
  src: "/illustrations/home/home-goal-empty.png",
  width: 290,
} as const;

export function HomeReadingGoal({ isRetrying, onRetry, widget }: HomeReadingGoalProps) {
  const t = useTranslations("home.goal");
  const activeGoalsCount =
    widget.kind === "fresh" || widget.kind === "stale" ? widget.data.activeGoalsCount : 0;

  return (
    <HomeCard
      action={
        activeGoalsCount === 0 ? null : (
          <HomeHeaderLink href={HOME_CONTEXT_LINKS.goals}>
            {t("all", { count: activeGoalsCount })}
          </HomeHeaderLink>
        )
      }
      className="h-full"
      icon="target"
      title={t("title")}
    >
      <ReadingGoalBody isRetrying={isRetrying} onRetry={onRetry} widget={widget} />
    </HomeCard>
  );
}

function GoalEmpty({
  recentCompletion,
}: {
  recentCompletion: HomeGoalSection["recentCompletion"];
}) {
  const t = useTranslations("home.goal.empty");

  return (
    <div className="@container/goal-empty flex flex-1 items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
        {recentCompletion === null ? null : <RecentCompletion completion={recentCompletion} />}
        <p className="text-sm text-foreground">{t("description")}</p>
        <HomeGoalCreateFlow />
      </div>
      <Image
        alt=""
        aria-hidden
        className="pointer-events-none hidden h-auto w-28 shrink-0 object-contain select-none @xs/goal-empty:block @sm/goal-empty:w-36"
        height={GOAL_EMPTY_ILLUSTRATION.height}
        loading="lazy"
        src={GOAL_EMPTY_ILLUSTRATION.src}
        unoptimized
        width={GOAL_EMPTY_ILLUSTRATION.width}
      />
    </div>
  );
}

function GoalPace({ pace }: { pace: PrimaryGoal["metrics"]["pace"] }) {
  const t = useTranslations("home.goal");
  const tPace = useTranslations("goals.pace");

  if (pace === null) {
    return (
      <Badge className="h-6 self-start px-2.5" variant="secondary">
        {t("paceUnknown")}
      </Badge>
    );
  }

  return (
    <Badge className="h-6 self-start px-2.5" variant={GOAL_SIGNAL_TONE.pace[pace]}>
      {tPace(pace)}
    </Badge>
  );
}

function PrimaryGoalProgress({ goal }: { goal: PrimaryGoal }) {
  const t = useTranslations("home.goal");
  const goalTitle = useGoalTitle();
  const locale = useLocale();
  const { metrics } = goal;
  const percent = goalDisplayPercent(metrics);
  const name = goalTitle(goal);

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-base leading-snug font-semibold">
        <Link
          className="line-clamp-2 cursor-pointer rounded-sm wrap-anywhere text-ink outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          href={homeGoalHref(goal.goalId)}
        >
          {name}
        </Link>
      </h3>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-heading text-2xl leading-none font-semibold text-ink tabular-nums">
          {t("progress", { completed: metrics.completedCount, target: goal.targetCount })}
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
          {t("percent", { percent })}
        </span>
      </div>
      <Progress
        aria-label={t("progressLabel", { percent })}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2"
        value={percent}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span>{t("remaining", { count: Math.max(metrics.remainingCount, 0) })}</span>
        <span>
          {t("deadline", { date: formatDateShort(goal.deadline, locale) })}
          {metrics.daysLeft === null ? null : (
            <> · {t("daysLeft", { count: Math.max(metrics.daysLeft, 0) })}</>
          )}
        </span>
      </div>
      <GoalPace pace={metrics.pace} />
    </div>
  );
}

function ReadingGoalBody({ isRetrying, onRetry, widget }: HomeReadingGoalProps) {
  const t = useTranslations("home.goal");
  const tCommon = useTranslations("common");

  switch (widget.kind) {
    case "error":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "fresh":
    case "stale":
      return (
        <div className="flex flex-1 flex-col gap-3">
          {widget.kind === "stale" ? (
            <HomeStaleNotice isRetrying={isRetrying} onRetry={onRetry} />
          ) : null}
          {widget.data.primaryGoal === null ? (
            <GoalEmpty recentCompletion={widget.data.recentCompletion} />
          ) : (
            <PrimaryGoalProgress goal={widget.data.primaryGoal} />
          )}
          {widget.data.primaryGoal !== null && widget.data.recentCompletion !== null ? (
            <RecentCompletion completion={widget.data.recentCompletion} />
          ) : null}
        </div>
      );
    case "loading":
      return (
        <div aria-busy className="flex flex-col gap-3">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      );
    default:
      return assertNever(widget);
  }
}

function RecentCompletion({ completion }: { completion: HomeGoalRecentCompletion }) {
  const t = useTranslations("home.goal");
  const goalTitle = useGoalTitle();
  const locale = useLocale();
  const name = goalTitle(completion);

  return (
    <p className="flex items-start gap-2 text-xs text-foreground">
      <UiIcon aria-hidden className="mt-px shrink-0 text-success" name="trophy" size={14} />
      <span className="min-w-0 wrap-anywhere">
        {t("recentCompletion", { date: formatDateShort(completion.completedAt, locale), name })}
      </span>
    </p>
  );
}
