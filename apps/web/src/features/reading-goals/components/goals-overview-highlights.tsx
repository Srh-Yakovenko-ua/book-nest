"use client";

import type {
  Nullable,
  ReadingGoalAttentionItem,
  ReadingGoalAttentionSeverity,
  ReadingGoalBestResult,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type GoalsOverviewHighlightsProps = {
  attention: ReadingGoalAttentionItem[];
  bestResult: Nullable<ReadingGoalBestResult>;
};

const ATTENTION_SEVERITY_TONE = {
  critical: "text-error",
  high: "text-warning",
  medium: "text-muted-foreground",
} as const satisfies Record<ReadingGoalAttentionSeverity, string>;

export function GoalsOverviewHighlights({ attention, bestResult }: GoalsOverviewHighlightsProps) {
  if (attention.length === 0 && bestResult === null) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {attention.length === 0 ? null : <AttentionCard items={attention} />}
      {bestResult === null ? null : <BestResultCard result={bestResult} />}
    </div>
  );
}

function AttentionCard({ items }: { items: ReadingGoalAttentionItem[] }) {
  const t = useTranslations("goals.catalog.attention");

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card">
      <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-warning" name="alert-triangle" size={18} />
        {t("title")}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.goalId}>
            <AttentionLink item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttentionLink({ item }: { item: ReadingGoalAttentionItem }) {
  const t = useTranslations("goals.catalog.attention");
  const remainingCount = numericMessageValue(item, "remainingCount");
  const name =
    item.goalName ??
    (item.listName === null ? t("untitled") : t("listGoal", { name: item.listName }));

  return (
    <Link
      className="group/attention -mx-2 flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 no-underline transition-colors outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      href={`/goals/${item.goalId}`}
    >
      <UiIcon
        aria-hidden
        className={cn("mt-0.5 shrink-0", ATTENTION_SEVERITY_TONE[item.severity])}
        name="alert-circle"
        size={16}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium break-words text-ink group-hover/attention:text-primary">
          {name}
        </span>
        <span className="text-xs text-muted-foreground">
          <AttentionReason item={item} />
          {remainingCount === null ? null : ` · ${t("remaining", { count: remainingCount })}`}
        </span>
      </span>
    </Link>
  );
}

function AttentionReason({ item }: { item: ReadingGoalAttentionItem }) {
  const t = useTranslations("goals.catalog.attention.reasons");

  switch (item.reason) {
    case "behind_schedule":
      return t("behindSchedule");
    case "deadline_soon": {
      const daysLeft = numericMessageValue(item, "daysLeft");
      return daysLeft === null ? t("deadlineSoon") : t("deadlineSoonDays", { count: daysLeft });
    }
    case "no_recent_progress": {
      const idleDays = numericMessageValue(item, "daysSinceLastCounted");
      return idleDays === null
        ? t("noRecentProgress")
        : t("noRecentProgressDays", { count: idleDays });
    }
    case "required_pace_high":
      return t("requiredPaceHigh");
    default:
      return assertNever(item.reason);
  }
}

function BestResultCard({ result }: { result: ReadingGoalBestResult }) {
  const t = useTranslations("goals.catalog.bestResult");
  const locale = useLocale();

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card">
      <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-success" name="trophy" size={18} />
        {t("title")}
      </h3>
      <Link
        className="line-clamp-2 w-fit rounded-sm text-sm font-medium break-words text-ink no-underline outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={`/goals/${result.goalId}`}
      >
        {result.goalName ?? t("fallbackName", { count: result.targetCount })}
      </Link>
      <p className="text-xs text-muted-foreground">
        {t("summary", {
          count: result.daysBeforeDeadline,
          date: formatDate(result.completedAt, locale),
        })}
      </p>
    </section>
  );
}

function numericMessageValue(item: ReadingGoalAttentionItem, key: string): Nullable<number> {
  const value = item.messageData[key];
  return typeof value === "number" ? value : null;
}
